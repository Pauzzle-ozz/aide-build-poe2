// Serveur local : API REST + WebSocket (synchro temps réel interface <-> Claude) + fichiers statiques.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import { WebSocketServer } from 'ws';
import { loadData, norm, matchScore, ROOT, DATA_DIR } from './data.mjs';
import { BuildStore, SANDBOX_ID } from './store.mjs';
import { applyOp, resolveNode, resolveGem, resolveClass } from './ops.mjs';
import { summarizeBuild, normalizeBuild } from '../core/build-model.mjs';
import { canSupport } from '../core/gems-logic.mjs';
import { makeGlossary } from './glossary.mjs';
import { decodePobCode, encodePobCode, resolvePobInput, pobXmlToBuild, buildToPobXml, itemFromText } from './pob.mjs';

export async function createApp() {
  const data = loadData();
  const store = new BuildStore(data);
  const glossary = makeGlossary(data);
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  const summary = (b, lang = 'fr') => summarizeBuild(b, { graph: data.graph, gemsById: data.gemsById, lang });
  const wrap = (fn) => async (req, res) => {
    try {
      const out = await fn(req, res);
      if (out !== undefined) res.json(out);
    } catch (e) {
      res.status(400).json({ error: String(e.message || e) });
    }
  };

  // ---------- Données de jeu
  app.use('/data', express.static(DATA_DIR, { maxAge: '1h', index: false, dotfiles: 'deny', setHeaders: (res) => res.set('Cache-Control', 'no-cache') }));

  // Proxy + cache disque des images poe2db (icônes d'objets / gemmes)
  const IMG_CACHE = path.join(DATA_DIR, 'cache', 'img');
  fs.mkdirSync(IMG_CACHE, { recursive: true });
  app.get('/img', async (req, res) => {
    try {
      const u = new URL(String(req.query.u || ''));
      if (u.protocol !== 'https:' || u.hostname !== 'cdn.poe2db.tw') return res.status(400).end();
      const file = path.join(IMG_CACHE, crypto.createHash('sha1').update(u.href).digest('hex') + path.extname(u.pathname));
      if (!fs.existsSync(file)) {
        const r = await fetch(u.href, { headers: { 'User-Agent': 'aide-build-poe2/0.1', Referer: 'https://poe2db.tw/' } });
        if (!r.ok) return res.status(404).end();
        fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
      }
      res.set('Cache-Control', 'public, max-age=604800');
      res.sendFile(file);
    } catch {
      res.status(404).end();
    }
  });

  // ---------- Builds
  app.get('/api/state', wrap(() => ({
    activeBuildId: store.state.activeBuildId,
    sandboxId: SANDBOX_ID,
    inSandbox: store.state.activeBuildId === SANDBOX_ID,
    lastBuildId: store.state.lastBuildId,
    uiClients: clients.size,
    treeVersion: data.tree.version,
    root: ROOT,
  })));

  // ---------- Bac à sable (espace libre, jamais dans la liste des builds)
  app.post('/api/sandbox/open', wrap((req) => {
    if (req.body?.fromBuild) store.resetSandbox({ fromBuild: store.resolve(req.body.fromBuild).id });
    else if (req.body?.reset) store.resetSandbox({ cls: req.body.class });
    store.setActive(SANDBOX_ID);
    return store.get(SANDBOX_ID);
  }));
  app.post('/api/sandbox/reset', wrap((req) => store.resetSandbox({ cls: req.body?.class })));
  app.post('/api/sandbox/save', wrap((req) => {
    const b = store.saveSandboxAs(req.body?.name);
    if (req.body?.activate !== false) store.setActive(b.id);
    return b;
  }));
  app.post('/api/sandbox/leave', wrap(() => ({ activeBuildId: store.leaveSandbox() })));
  app.get('/api/builds', wrap(() => store.list()));
  app.post('/api/builds', wrap((req) => {
    const b = store.create(req.body || {}, { source: req.body?.source || 'ui' });
    if (req.body?.activate !== false) store.setActive(b.id);
    return b;
  }));
  app.get('/api/builds/:id', wrap((req) => store.resolve(req.params.id === 'active' ? null : req.params.id)));
  app.put('/api/builds/:id', wrap((req) => {
    const b = { ...req.body, id: req.params.id };
    data.graph.sanitize(b);
    // build existant : la modification part dans le brouillon (à valider)
    return store.exists(b.id) ? store.commit(normalizeBuild(b), { source: 'ui' }) : store.add(b, { source: 'ui' });
  }));
  app.delete('/api/builds/:id', wrap((req) => {
    store.remove(req.params.id);
    return { ok: true, activeBuildId: store.state.activeBuildId };
  }));
  app.post('/api/builds/:id/activate', wrap((req) => {
    const b = store.resolve(req.params.id);
    store.setActive(b.id);
    return { ok: true, activeBuildId: b.id };
  }));
  app.post('/api/builds/:id/duplicate', wrap((req) => {
    const b = store.resolve(req.params.id);
    const copy = store.add({ ...b, id: undefined, name: req.body?.name || `${b.name} (copie)`, createdAt: new Date().toISOString() });
    store.setActive(copy.id);
    return copy;
  }));
  app.get('/api/builds/:id/summary', wrap((req) => {
    const b = store.resolve(req.params.id === 'active' ? null : req.params.id);
    return { ...summary(b, req.query.lang === 'en' ? 'en' : 'fr'), sandbox: b.id === SANDBOX_ID, pending: !!b.pending, pendingChanges: b.pendingChanges || [] };
  }));
  // version enregistrée (sans le brouillon)
  app.get('/api/builds/:id/saved', wrap((req) => store.get(store.resolveId(req.params.id === 'active' ? null : req.params.id))));
  // « Valider » : le brouillon devient la version enregistrée ; « Annuler » : on jette le brouillon
  app.post('/api/builds/:id/validate', wrap((req) => store.validate(store.resolveId(req.params.id === 'active' ? null : req.params.id))));
  app.post('/api/builds/:id/discard', wrap((req) => store.discard(store.resolveId(req.params.id === 'active' ? null : req.params.id))));

  // Opérations (une ou plusieurs) sur un build
  app.post('/api/builds/:id/ops', wrap((req) => {
    const b = store.resolve(req.params.id === 'active' ? null : req.params.id);
    const ops = Array.isArray(req.body?.ops) ? req.body.ops : [req.body];
    const results = [];
    for (const op of ops) results.push(applyOp(data, b, op));
    const w = store.commit(b, { source: req.body?.source || 'ui' });
    return { build: w, results };
  }));

  // ---------- PoB
  app.post('/api/pob/import', wrap(async (req) => {
    const code = await resolvePobInput(req.body?.code || req.body?.url || '');
    const xml = code.trim().startsWith('<') ? code : decodePobCode(code);
    const { build, warnings } = pobXmlToBuild(xml, data, { name: req.body?.name });
    const saved = store.add(build, { source: req.body?.source || 'ui' });
    if (req.body?.activate !== false) store.setActive(saved.id);
    return { build: saved, warnings };
  }));
  app.get('/api/builds/:id/pob', wrap((req) => {
    const b = store.resolve(req.params.id === 'active' ? null : req.params.id);
    const xml = buildToPobXml(b, data);
    return { code: encodePobCode(xml), xml: req.query.xml ? xml : undefined };
  }));
  app.post('/api/items/parse', wrap((req) => itemFromText(String(req.body?.text || ''), data)));

  // ---------- Glossaire officiel (mots soulignés dans l'interface)
  app.get('/api/glossary', wrap((req) => (req.query.q ? glossary.search(String(req.query.q), Number(req.query.limit) || 15) : { nombre: glossary.count, termes: glossary.titles() })));
  app.post('/api/glossary/check', wrap((req) => glossary.check(req.body?.text || '')));

  // ---------- Recherche
  app.get('/api/search/passives', wrap((req) => {
    const q = String(req.query.q || '');
    const type = String(req.query.type || 'any');
    const limit = Math.min(200, Number(req.query.limit) || 25);
    const b = req.query.build ? store.resolve(req.query.build) : store.resolve(null);
    const dist = data.graph.distances(b);
    const alloc = new Set(b.tree.nodes);
    const res = [];
    for (const n of Object.values(data.graph.nodes)) {
      if (n.type === 'image' || n.type === 'classStart' || n.type === 'ascendancyStart') continue;
      if (type !== 'any' && n.type !== type) continue;
      if (req.query.ascendancy === 'only' && !n.ascendancy) continue;
      if (req.query.ascendancy === 'none' && n.ascendancy) continue;
      if (n.ascendancy && req.query.ascendancy !== 'all' && n.ascendancy !== b.ascendancy && req.query.ascendancy !== 'only') continue;
      const s = q ? matchScore(q, n.name, n.nameEn, n.stats.join(' '), n.statsEn.join(' ')) : 1;
      if (!s) continue;
      const bonus = n.type === 'keystone' ? 3 : n.type === 'notable' ? 2 : 0;
      res.push([s + bonus, n]);
    }
    res.sort((a, b2) => b2[0] - a[0] || (dist.get(a[1].id) ?? 999) - (dist.get(b2[1].id) ?? 999));
    return res.slice(0, limit).map(([, n]) => ({
      id: n.id, name: n.name, nameEn: n.nameEn, type: n.type, ascendancy: n.ascendancy || null,
      stats: n.stats, statsEn: n.statsEn,
      allocated: alloc.has(n.id),
      pointsToReach: alloc.has(n.id) ? 0 : dist.get(n.id) ?? null,
    }));
  }));
  app.get('/api/passives/:ref', wrap((req) => {
    const b = store.resolve(req.query.build || null);
    const n = resolveNode(data, b, req.params.ref);
    const path = data.graph.findPath(b, n.id);
    return {
      ...n,
      allocated: b.tree.nodes.includes(n.id),
      pathFromTree: path ? path.map((id) => ({ id, name: data.graph.node(id).name })) : null,
      neighbors: n.links.map((id) => ({ id, name: data.graph.node(id)?.name, type: data.graph.node(id)?.type })),
    };
  }));
  app.get('/api/search/gems', wrap((req) => {
    const q = String(req.query.q || '');
    const kind = String(req.query.kind || 'any');
    const limit = Math.min(200, Number(req.query.limit) || 25);
    const tag = req.query.tag ? norm(req.query.tag) : null;
    let classId = null;
    if (req.query.class) classId = /^(commune?s?|common)$/i.test(req.query.class) ? 'common' : resolveClass(data, req.query.class).cls.id;
    return data.gems
      .filter((g) => !classId || (g.classes || ['common']).includes(classId))
      .filter((g) => kind === 'any' || g.kind === kind || (kind === 'skill' && ['skill', 'spirit', 'meta'].includes(g.kind)) || (kind === 'support' && g.kind === 'lineage'))
      .filter((g) => !tag || g.tags.some((t) => norm(t) === tag) || g.tagsEn.some((t) => norm(t) === tag))
      .map((g) => [q ? matchScore(q, g.name, g.nameEn, g.tags.join(' '), g.tagsEn.join(' '), g.description || '', g.descriptionEn || '') : 1, g])
      .filter(([s]) => s > 0)
      .sort((a, b) => b[0] - a[0])
      .slice(0, limit)
      .map(([, g]) => ({ id: g.id, name: g.name, nameEn: g.nameEn, kind: g.kind, categorie: g.category, classes: g.classes, palier: g.tier, tags: g.tags, color: g.color, description: g.description || g.descriptionEn }));
  }));
  app.get('/api/gems/:ref', wrap((req) => resolveGem(data, decodeURIComponent(req.params.ref))));
  app.get('/api/gems/:ref/supports', wrap((req) => {
    const active = resolveGem(data, decodeURIComponent(req.params.ref));
    const q = String(req.query.q || '');
    const maxTier = req.query.maxTier !== undefined ? Number(req.query.maxTier) : null;
    const list = data.gems
      .filter((g) => (g.kind === 'support' || g.kind === 'lineage') && canSupport(g, active))
      .filter((g) => maxTier === null || (g.tier ?? 0) <= maxTier)
      .map((g) => [q ? matchScore(q, g.name, g.nameEn, g.tags.join(' '), g.description || '', g.descriptionEn || '') : 1, g])
      .filter(([sc]) => sc > 0)
      .sort((a, b) => b[0] - a[0] || (a[1].tier ?? 0) - (b[1].tier ?? 0))
      .slice(0, Math.min(200, Number(req.query.limit) || 60))
      .map(([, g]) => ({ id: g.id, name: g.name, nameEn: g.nameEn, kind: g.kind, tier: g.tier, color: g.color, description: g.description || g.descriptionEn }));
    return { aptitude: { id: active.id, name: active.name, nameEn: active.nameEn, types: active.skillTypes }, compatibles: list };
  }));
  app.get('/api/search/items', wrap((req) => {
    const q = String(req.query.q || '');
    const kind = String(req.query.kind || 'unique');
    const slot = req.query.slot ? String(req.query.slot) : null;
    const cls = req.query.class ? norm(req.query.class) : null;
    const limit = Math.min(200, Number(req.query.limit) || 25);
    const list = kind === 'base' ? data.items.bases : data.items.uniques;
    return list
      .filter((it) => !slot || it.slots.includes(slot) || (slot.startsWith('Ring') && it.itemClass === 'Ring') || (slot.startsWith('Charm') && it.itemClass === 'Charm'))
      .filter((it) => !cls || norm(it.itemClass) === cls || norm(it.classFr) === cls)
      .map((it) => [q ? matchScore(q, it.name, it.nameEn, it.base || '', it.classFr, ...(it.explicits || []), ...(it.implicits || [])) : 1, it])
      .filter(([s]) => s > 0)
      .sort((a, b) => b[0] - a[0])
      .slice(0, limit)
      .map(([, it]) => it);
  }));

  // ---------- Commandes d'interface (Claude -> navigateur)
  app.post('/api/ui', wrap((req) => {
    broadcast({ type: 'ui', ...req.body });
    return { ok: true, uiClients: clients.size };
  }));

  // ---------- Interface web (build de production)
  const dist = path.join(ROOT, 'web', 'dist');
  app.use(express.static(dist, { index: 'index.html' }));
  app.get(/^(?!\/(api|data|img|ws)).*/, (req, res) => {
    const index = path.join(dist, 'index.html');
    if (fs.existsSync(index)) res.sendFile(index);
    else res.status(503).send('Interface non construite : lancez "npm run build".');
  });

  // ---------- WebSocket
  const clients = new Set();
  function broadcast(msg) {
    const s = JSON.stringify(msg);
    for (const ws of clients) if (ws.readyState === 1) ws.send(s);
  }
  store.on('build', ({ build, source }) => broadcast({ type: 'build', build, source }));
  store.on('list', (list) => broadcast({ type: 'list', list }));
  store.on('active', (id) => broadcast({ type: 'active', activeBuildId: id }));

  function attach(server) {
    const wss = new WebSocketServer({ server, path: '/ws' });
    wss.on('connection', (ws) => {
      clients.add(ws);
      ws.send(JSON.stringify({ type: 'hello', activeBuildId: store.state.activeBuildId }));
      ws.on('close', () => clients.delete(ws));
      ws.on('error', () => clients.delete(ws));
    });
  }

  return { app, attach, store, data };
}
