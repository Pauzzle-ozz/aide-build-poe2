// Version en ligne (Cloudflare) : pas de serveur pour les builds. L'API tourne directement dans
// le navigateur, avec les mêmes routes que le serveur local (src/core/build-routes.mjs et
// src/core/search-routes.mjs), et les builds de chaque visiteur sont gardés dans la mémoire de SON
// navigateur (localStorage). Ce qui passe par le Worker Cloudflare (cloudflare/worker.mjs) : les icônes
// de poe2db (/img), les liens de partage PoB (/api/pob-url) et le relais vers Claude (web/src/web/claude.js).
import { BuildStore, SANDBOX_ID } from '@core/build-store.mjs';
import { buildRoutes, matchRoute } from '@core/build-routes.mjs';
import { searchRoutes } from '@core/search-routes.mjs';
import { makeGlossary } from '@core/glossary.mjs';
import { indexData } from '@core/data-index.mjs';
import { pobSourceUrl } from '@core/pob-source.mjs';

const PREFIX = 'aide-build-poe2:';

// Builds de test publiés par erreur le 15/11/2026 (proposés en exemple à la première visite) :
// on les retire des navigateurs qui les ont reçus, s'ils n'ont pas été modifiés depuis.
const ANCIENS_EXEMPLES = {
  '34mdk7ubhqtg': '2026-11-15T01:00:33.123Z',
  d9druh09hqs5: '2026-11-15T01:00:43.365Z',
  qjvmjdsghqt4: '2026-11-15T01:00:39.103Z',
  yi28ec8fhqsr: '2026-11-15T01:01:11.593Z',
};
function retirerAnciensExemples(disk) {
  for (const [id, updatedAt] of Object.entries(ANCIENS_EXEMPLES)) {
    try {
      if (disk.read(id)?.updatedAt === updatedAt && !disk.has(`_brouillon-${id}`)) disk.remove(id);
    } catch {}
  }
}

// ------------------------------------------------------------ mémoire du navigateur
function browserDisk() {
  let ls = null;
  try {
    ls = window.localStorage;
    ls.setItem(`${PREFIX}_test`, '1');
    ls.removeItem(`${PREFIX}_test`);
  } catch {
    ls = null;
  }
  if (!ls) {
    // stockage bloqué (navigation privée stricte, cookies refusés…) : on garde en mémoire le temps de la visite
    const mem = new Map();
    return {
      persistent: false,
      read: (n) => (mem.has(n) ? JSON.parse(mem.get(n)) : null),
      write: (n, o) => void mem.set(n, JSON.stringify(o)),
      remove: (n) => void mem.delete(n),
      has: (n) => mem.has(n),
      names: () => [...mem.keys()],
    };
  }
  return {
    persistent: true,
    read(n) {
      const s = ls.getItem(PREFIX + n);
      return s == null ? null : JSON.parse(s);
    },
    write(n, o) {
      try {
        ls.setItem(PREFIX + n, JSON.stringify(o));
      } catch {
        throw new Error('La mémoire du navigateur est pleine : téléchargez une sauvegarde (Mes builds), puis supprimez des builds pour faire de la place.');
      }
    },
    remove: (n) => ls.removeItem(PREFIX + n),
    has: (n) => ls.getItem(PREFIX + n) != null,
    names() {
      const out = [];
      for (let i = 0; i < ls.length; i++) {
        const k = ls.key(i);
        if (k?.startsWith(PREFIX)) out.push(k.slice(PREFIX.length));
      }
      return out;
    },
  };
}

// ------------------------------------------------------------ fichiers de données (chargés une seule fois)
const files = new Map();
/** Fichier JSON statique (data/*.json, assets/sprites.json), partagé avec l'interface : un seul téléchargement */
export function fetchJson(path) {
  if (!files.has(path)) {
    files.set(
      path,
      fetch(path).then((r) => {
        if (!r.ok) throw new Error(`Impossible de charger ${path} (HTTP ${r.status})`);
        return r.json();
      }),
    );
  }
  return files.get(path);
}

// ------------------------------------------------------------ codes Path of Building
async function through(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}
function fromBase64(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function toBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
const browserPob = {
  async decode(code) {
    let bytes;
    try {
      bytes = fromBase64(String(code).trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/'));
    } catch {
      throw new Error("Code PoB invalide : collez le code d'export complet, ou un lien pobb.in / poe.ninja.");
    }
    for (const format of ['deflate', 'deflate-raw']) {
      try {
        return new TextDecoder().decode(await through(bytes, new DecompressionStream(format)));
      } catch {}
    }
    throw new Error("Code PoB invalide : collez le code d'export complet, ou un lien pobb.in / poe.ninja.");
  },
  async encode(xml) {
    return toBase64(await through(new TextEncoder().encode(xml), new CompressionStream('deflate'))).replace(/\+/g, '-').replace(/\//g, '_');
  },
  async resolveInput(input) {
    const url = pobSourceUrl(input);
    if (!url) return String(input).trim();
    const r = await fetch(`/api/pob-url?u=${encodeURIComponent(String(input).trim())}`);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j.error || `Impossible de récupérer ${url} (HTTP ${r.status})`);
    }
    return (await r.text()).trim();
  },
};

// ------------------------------------------------------------ notifications (remplacent le WebSocket du serveur local)
const listeners = new Set();
function dispatch(msg) {
  const s = JSON.stringify(msg);
  // comme un message réseau : copie neuve, reçue après la réponse en cours
  setTimeout(() => {
    for (const fn of listeners) fn(JSON.parse(s));
  }, 0);
}
export async function subscribe(fn) {
  await init();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ------------------------------------------------------------ démarrage
let ready = null;
function init() {
  ready ??= (async () => {
    const [tree, gems, items, translations, glossaryData] = await Promise.all(['tree', 'gems', 'items', 'translations', 'glossary'].map((n) => fetchJson(`/data/${n}.json`)));
    const data = indexData({ tree, gems, items, translations, glossary: glossaryData });
    const glossary = makeGlossary(data);
    const disk = browserDisk();
    const firstVisit = !disk.has('_etat');
    retirerAnciensExemples(disk);
    const store = new BuildStore(data, disk);
    store.on('build', ({ build, source }) => dispatch({ type: 'build', build, source }));
    store.on('list', (list) => dispatch({ type: 'list', list }));
    store.on('active', (id) => dispatch({ type: 'active', activeBuildId: id }));

    // builds modifiés dans un autre onglet : on rafraîchit la liste (et le build ouvert s'il est concerné)
    window.addEventListener('storage', (e) => {
      if (!e.key?.startsWith(PREFIX)) return;
      const name = e.key.slice(PREFIX.length);
      const active = store.state.activeBuildId;
      try {
        dispatch({ type: 'list', list: store.list() });
        if (name === active || name === `_brouillon-${active}` || (active === SANDBOX_ID && name === '_bac-a-sable')) {
          dispatch({ type: 'build', build: store.working(active), source: 'onglet' });
        }
      } catch {}
    });

    const routes = [
      ...buildRoutes({ store, data, pob: browserPob, extraState: () => ({ web: true, firstVisit, persistent: disk.persistent, uiClients: 1 }) }),
      ...searchRoutes({ store, data, glossary }),
      // commandes d'interface envoyées par Claude (centrer l'arbre, ouvrir un panneau, afficher un message)
      ['post', '/api/ui', (req) => {
        dispatch({ type: 'ui', ...(req.body || {}) });
        return { ok: true, uiClients: 1 };
      }],
    ];
    return { store, routes };
  })();
  return ready;
}

/** Équivalent d'un appel HTTP au serveur local */
export async function request(method, url, body) {
  const u = new URL(url, location.origin);
  if (!u.pathname.startsWith('/api/')) {
    if (method !== 'GET') throw new Error(`Requête impossible : ${method} ${u.pathname}`);
    return fetchJson(u.pathname + u.search);
  }
  const { routes } = await init();
  const hit = matchRoute(routes, method, u.pathname);
  if (!hit) throw new Error(`Fonction indisponible dans la version en ligne (${method} ${u.pathname}).`);
  // copies JSON à l'aller et au retour, comme à travers le réseau : l'interface ne partage aucun objet avec le stockage
  const req = { params: hit.params, query: Object.fromEntries(u.searchParams), body: body === undefined ? {} : JSON.parse(JSON.stringify(body)) };
  const out = await hit.handler(req);
  return out === undefined ? {} : JSON.parse(JSON.stringify(out));
}
