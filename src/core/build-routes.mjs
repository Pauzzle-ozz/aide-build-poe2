// Routes de l'API des builds (liste, brouillons, bac à sable, opérations, PoB, sauvegarde),
// partagées entre le serveur local (Express, src/server/app.mjs) et la version en ligne,
// où elles tournent directement dans le navigateur (web/src/web/backend.js).
// Chaque route : [méthode, chemin façon Express, (req: { params, query, body }) => réponse JSON].
import { SANDBOX_ID } from './build-store.mjs';
import { summarizeBuild, normalizeBuild } from './build-model.mjs';
import { applyOp, resolveClass } from './ops.mjs';
import { pobXmlToBuild, buildToPobXml, itemFromText } from './pob.mjs';

/**
 * @param store  BuildStore (src/core/build-store.mjs)
 * @param data   données indexées (src/core/data-index.mjs)
 * @param pob    { decode(code) -> xml, encode(xml) -> code, resolveInput(texte ou lien) -> code } (synchrones ou non)
 * @param extraState  champs ajoutés à /api/state (ex. nombre d'interfaces connectées)
 */
export function buildRoutes({ store, data, pob, extraState = () => ({}) }) {
  const ref = (req) => (req.params.id === 'active' ? null : req.params.id);
  const body = (req) => req.body || {};
  const summary = (b, lang = 'fr') => summarizeBuild(b, { graph: data.graph, gemsById: data.gemsById, lang });
  // classe de départ du bac à sable : id, ou nom FR/EN de classe ou d'ascendance
  const classId = (ref) => (ref ? resolveClass(data, ref).cls.id : undefined);

  return [
    ['get', '/api/state', () => ({
      activeBuildId: store.state.activeBuildId,
      sandboxId: SANDBOX_ID,
      inSandbox: store.state.activeBuildId === SANDBOX_ID,
      lastBuildId: store.state.lastBuildId,
      treeVersion: data.tree.version,
      ...extraState(),
    })],

    // ---------- Bac à sable (espace libre, jamais dans la liste des builds)
    ['post', '/api/sandbox/open', (req) => {
      if (body(req).fromBuild) store.resetSandbox({ fromBuild: store.resolve(body(req).fromBuild).id });
      else if (body(req).reset) store.resetSandbox({ cls: classId(body(req).class) });
      store.setActive(SANDBOX_ID);
      return store.get(SANDBOX_ID);
    }],
    ['post', '/api/sandbox/reset', (req) => store.resetSandbox({ cls: classId(body(req).class) })],
    ['post', '/api/sandbox/save', (req) => {
      const b = store.saveSandboxAs(body(req).name);
      if (body(req).activate !== false) store.setActive(b.id);
      return b;
    }],
    ['post', '/api/sandbox/leave', () => ({ activeBuildId: store.leaveSandbox() })],

    // ---------- Builds
    ['get', '/api/builds', () => store.list()],
    ['post', '/api/builds', (req) => {
      const b = store.create(body(req), { source: body(req).source || 'ui' });
      if (body(req).activate !== false) store.setActive(b.id);
      return b;
    }],
    ['get', '/api/builds/:id', (req) => store.resolve(ref(req))],
    ['put', '/api/builds/:id', (req) => {
      const b = { ...body(req), id: req.params.id };
      data.graph.sanitize(b);
      // build existant : la modification part dans le brouillon (à valider)
      return store.exists(b.id) ? store.commit(normalizeBuild(b), { source: 'ui' }) : store.add(b, { source: 'ui' });
    }],
    ['delete', '/api/builds/:id', (req) => {
      store.remove(req.params.id);
      return { ok: true, activeBuildId: store.state.activeBuildId };
    }],
    ['post', '/api/builds/:id/activate', (req) => {
      const b = store.resolve(req.params.id);
      store.setActive(b.id);
      return { ok: true, activeBuildId: b.id };
    }],
    ['post', '/api/builds/:id/duplicate', (req) => {
      const b = store.resolve(req.params.id);
      const copy = store.add({ ...b, id: undefined, name: body(req).name || `${b.name} (copie)`, createdAt: new Date().toISOString() });
      store.setActive(copy.id);
      return copy;
    }],
    ['get', '/api/builds/:id/summary', (req) => {
      const b = store.resolve(ref(req));
      return { ...summary(b, req.query?.lang === 'en' ? 'en' : 'fr'), sandbox: b.id === SANDBOX_ID, pending: !!b.pending, pendingChanges: b.pendingChanges || [] };
    }],
    // version enregistrée (sans le brouillon)
    ['get', '/api/builds/:id/saved', (req) => store.get(store.resolveId(ref(req)))],
    // « Valider » : le brouillon devient la version enregistrée ; « Annuler » : on jette le brouillon
    ['post', '/api/builds/:id/validate', (req) => store.validate(store.resolveId(ref(req)))],
    ['post', '/api/builds/:id/discard', (req) => store.discard(store.resolveId(ref(req)))],

    // Opérations (une ou plusieurs) sur un build
    ['post', '/api/builds/:id/ops', (req) => {
      const b = store.resolve(ref(req));
      const ops = Array.isArray(body(req).ops) ? body(req).ops : [body(req)];
      const results = [];
      for (const op of ops) results.push(applyOp(data, b, op));
      const w = store.commit(b, { source: body(req).source || 'ui' });
      return { build: w, results };
    }],

    // ---------- PoB
    ['post', '/api/pob/import', async (req) => {
      const code = await pob.resolveInput(body(req).code || body(req).url || '');
      const xml = code.trim().startsWith('<') ? code : await pob.decode(code);
      const { build, warnings } = pobXmlToBuild(xml, data, { name: body(req).name });
      const saved = store.add(build, { source: body(req).source || 'ui' });
      if (body(req).activate !== false) store.setActive(saved.id);
      return { build: saved, warnings };
    }],
    ['get', '/api/builds/:id/pob', async (req) => {
      const b = store.resolve(ref(req));
      const xml = buildToPobXml(b, data);
      return { code: await pob.encode(xml), xml: req.query?.xml ? xml : undefined };
    }],
    ['post', '/api/items/parse', (req) => itemFromText(String(body(req).text || ''), data)],

    // ---------- Sauvegarde de tous les builds dans un fichier (et restauration)
    ['get', '/api/backup', () => ({ format: 'aide-build-poe2', version: 1, exportedAt: new Date().toISOString(), builds: store.backup() })],
    ['post', '/api/backup/restore', (req) => {
      const b = body(req);
      // fichier de sauvegarde complet, liste de builds, ou un seul build (fichier builds/<id>.json)
      const list = Array.isArray(b.builds) ? b.builds : Array.isArray(b) ? b : b.tree ? [b] : null;
      if (!list) throw new Error("Ce fichier n'est pas une sauvegarde de builds.");
      return store.restore(list);
    }],
  ];
}

/** Trouve la route correspondant à une requête (pour la version en ligne, sans Express) */
export function matchRoute(routes, method, pathname) {
  const parts = pathname.replace(/\/+$/, '').split('/');
  const m = method.toLowerCase();
  for (const [rm, path, handler] of routes) {
    if (rm !== m) continue;
    const pp = path.split('/');
    if (pp.length !== parts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < pp.length && ok; i++) {
      if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(parts[i]);
      else ok = pp[i] === parts[i];
    }
    if (ok) return { handler, params };
  }
  return null;
}
