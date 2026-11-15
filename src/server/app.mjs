// Serveur local : API REST + WebSocket (synchro temps réel interface <-> Claude) + fichiers statiques.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import { WebSocketServer } from 'ws';
import { loadData, ROOT, DATA_DIR } from './data.mjs';
import { BuildStore } from './store.mjs';
import { buildRoutes } from '../core/build-routes.mjs';
import { searchRoutes } from '../core/search-routes.mjs';
import { makeGlossary } from '../core/glossary.mjs';
import { nodePob } from './pob.mjs';

export async function createApp() {
  const data = loadData();
  const store = new BuildStore(data);
  const glossary = makeGlossary(data);
  const app = express();
  app.use(express.json({ limit: '5mb' }));

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

  // ---------- Builds, brouillons, bac à sable, PoB, sauvegarde (routes partagées avec la version en ligne)
  const routes = buildRoutes({ store, data, pob: nodePob, extraState: () => ({ uiClients: clients.size, root: ROOT }) });
  for (const [method, route, handler] of routes) app[method](route, wrap((req) => handler(req)));

  // ---------- Recherche dans les données du jeu + glossaire (routes partagées avec la version en ligne)
  for (const [method, route, handler] of searchRoutes({ store, data, glossary })) app[method](route, wrap((req) => handler(req)));

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
