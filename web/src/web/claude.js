// Version en ligne : connexion de Claude à l'onglet du site.
//
// Chaque navigateur reçoit un lien personnel secret, https://<site>/mcp/<jeton>, que le visiteur ajoute
// dans Claude comme connecteur personnalisé. Quand Claude utilise un outil, le Worker Cloudflare
// (cloudflare/worker.mjs) transmet la demande à cet onglet par un WebSocket (/relais/<jeton>) ; l'onglet
// l'exécute sur les builds de ce navigateur (backend.js, mêmes routes que le serveur local) et renvoie
// la réponse. Les builds ne quittent donc jamais le navigateur, sauf ce que Claude lit.
import { request } from './backend.js';

const CLE = 'aide-build-poe2-claude:';
const lire = (k) => {
  try {
    return localStorage.getItem(CLE + k);
  } catch {
    return null;
  }
};
const ecrire = (k, v) => {
  try {
    if (v == null) localStorage.removeItem(CLE + k);
    else localStorage.setItem(CLE + k, v);
  } catch {}
};
function nouveauJeton() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** Lien à ajouter dans Claude */
export const lienMcp = (jeton) => `${location.origin}/mcp/${jeton}`;

// statut : 'arrete' | 'connexion' | 'pret' | 'autreOnglet'
let etat = { actif: false, statut: 'arrete', jeton: null, derniereAction: null };
const abonnes = new Set();
function maj(p) {
  etat = { ...etat, ...p };
  for (const fn of abonnes) fn(etat);
}
export function suivre(fn) {
  abonnes.add(fn);
  fn(etat);
  return () => abonnes.delete(fn);
}

let ws = null;
let essais = 0;
let reprise = null;
let battement = null;

function fermer() {
  const s = ws;
  ws = null;
  clearInterval(battement);
  clearTimeout(reprise);
  try {
    s?.close();
  } catch {}
}

function connecter() {
  fermer();
  if (!etat.actif || !etat.jeton) return;
  maj({ statut: 'connexion' });
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const s = new WebSocket(`${proto}://${location.host}/relais/${etat.jeton}`);
  ws = s;
  s.onopen = () => {
    essais = 0;
    maj({ statut: 'pret' });
    // garde la connexion ouverte (Cloudflare répond « pong » sans réveiller le relais)
    battement = setInterval(() => {
      try {
        s.send('ping');
      } catch {}
    }, 30000);
  };
  s.onmessage = async (e) => {
    if (e.data === 'pong') return;
    let m;
    try {
      m = JSON.parse(e.data);
    } catch {
      return;
    }
    if (m?.id == null) return;
    let reponse;
    try {
      if (!String(m.url || '').startsWith('/api/')) throw new Error('Demande refusée.');
      reponse = { id: m.id, ok: true, result: await request(m.method, m.url, m.body ?? undefined) };
    } catch (err) {
      reponse = { id: m.id, ok: false, error: String(err?.message || err) };
    }
    maj({ derniereAction: Date.now() });
    try {
      s.send(JSON.stringify(reponse));
    } catch {}
  };
  s.onclose = (e) => {
    if (ws !== s) return; // fermeture voulue (changement de lien, désactivation)
    ws = null;
    clearInterval(battement);
    if (!etat.actif) return maj({ statut: 'arrete' });
    // un autre onglet de ce navigateur a pris la connexion
    if (e.code === 4000) return maj({ statut: 'autreOnglet' });
    maj({ statut: 'connexion' });
    reprise = setTimeout(connecter, Math.min(30000, 1000 * 2 ** essais++));
  };
}

let demarre = false;
/** Au chargement de la page : se reconnecte si Claude avait été activé dans ce navigateur */
export function demarrer() {
  if (demarre) return;
  demarre = true;
  const jeton = lire('jeton');
  maj({ jeton, actif: lire('actif') === '1' && !!jeton });
  if (etat.actif) connecter();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && etat.actif && etat.statut === 'connexion' && !ws) connecter();
  });
}

export function activer() {
  let jeton = lire('jeton');
  if (!jeton) {
    jeton = nouveauJeton();
    ecrire('jeton', jeton);
  }
  ecrire('actif', '1');
  maj({ jeton, actif: true });
  connecter();
}

export function desactiver() {
  ecrire('actif', null);
  maj({ actif: false, statut: 'arrete' });
  fermer();
}

/** Nouveau lien : l'ancien ne fonctionne plus (il faut remplacer le connecteur dans Claude) */
export function changerLien() {
  const jeton = nouveauJeton();
  ecrire('jeton', jeton);
  maj({ jeton });
  if (etat.actif) connecter();
}

/** Reprend la connexion dans cet onglet (après « relié à un autre onglet ») */
export function utiliserCetOnglet() {
  if (etat.actif) connecter();
}
