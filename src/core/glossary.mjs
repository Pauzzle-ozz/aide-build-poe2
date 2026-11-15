// Glossaire officiel du jeu (data/glossary.json) : recherche, définitions, et vérification d'un
// texte (notes de build) pour imposer le vocabulaire officiel FR. Serveur local et version en ligne.
import { norm } from './text.mjs';

// Jargon de joueurs / anglais -> terme officiel du client français
// frontières de mot Unicode (sinon « dernières » contiendrait « res »)
const W = (pattern, flags) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${pattern})(?![\\p{L}\\p{N}])`, `g${flags}u`);
const JARGON = [
  [W("crits?|critical hits?", "i"), "Touche critique"],
  [W("shock(?:ed|s)?", "i"), "Électrocution (Électrocuter)"],
  [W("electrocut(?:e|ed|es)", "i"), "Foudroiement (Foudroyer)"],
  [W("ignit(?:e|ed|es)", "i"), "Embrasement (Embraser)"],
  [W("freez(?:e|es)|frozen", "i"), "Gel (Geler)"],
  [W("chill(?:ed|s)?", "i"), "Frigorification (Frigorifier)"],
  [W("bleed(?:ing|s)?", "i"), "Saignement"],
  [W("aoe|area of effect", "i"), "Zone d'effet"],
  [W("leech(?:es|ing)?", "i"), "Drain"],
  [W("buffs?", "i"), "Effet bénéfique"],
  [W("debuffs?", "i"), "Effet néfaste"],
  [W("life", "i"), "Vie"],
  [W("ES|[Ee]nergy [Ss]hield", ""), "Bouclier d'énergie"],
  [W("minions?", "i"), "Créature"],
  [W("curses?", "i"), "Malédiction"],
  [W("spells?", "i"), "Sort"],
  [W("attacks?", "i"), "Attaque"],
  [W("slams?", "i"), "Fracas"],
  [W("strikes?", "i"), "Frappe"],
  [W("power charges?", "i"), "Charge de pouvoir"],
  [W("frenzy charges?", "i"), "Charge de frénésie"],
  [W("endurance charges?", "i"), "Charge d'endurance"],
  [W("procs?|trigger(?:s|ed)?", "i"), "Déclenchement (Déclencher)"],
  [W("cast speed", "i"), "Vitesse d'incantation"],
  [W("attack speed", "i"), "Vitesse d'attaque"],
  [W("pen(?:etration)?", "i"), "Pénétration"],
  [W("stuns?", "i"), "Étourdissement"],
  [W("daze[ds]?", "i"), "Hébétement"],
  [W("res(?:ist|ists|istances?)?", "i"), "Résistance"],
  [W("heralds?", "i"), "Héraut"],
  [W("dodge(?: roll)?", "i"), "Roulade"],
  [W("skills?", "i"), "Aptitude"],
  [W("support gems?|gemmes? de support", "i"), "Gemme de soutien"],
  [W("keystones?", "i"), "Clé de voûte"],
  [W("ascendancy", "i"), "Ascendance"],
  [W("flasks?", "i"), "Flacon"],
  [W("jewels?", "i"), "Joyau"],
  [W("sockets?", "i"), "Châsse"],
  [W("spirit", "i"), "Esprit"],
  [W("DPS", ""), "dégâts par seconde (pas de terme officiel : écrire « dégâts »)"],
];

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function makeGlossary(data) {
  const g = data.glossary || { entries: {}, forms: {} };
  const entries = g.entries || {};
  const forms = g.forms || {};
  const keys = Object.keys(forms).sort((a, b) => b.length - a.length);
  const kwRe = keys.length ? new RegExp(`(?<![\\p{L}\\p{N}])(${keys.map(escRe).join('|')})(?![\\p{L}\\p{N}])`, 'giu') : null;
  const plain = (html) =>
    String(html || '')
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

  // noms anglais de gemmes / passifs / uniques -> nom FR officiel
  const enNames = [];
  for (const x of data.gems) if (x.nameEn && x.nameEn !== x.name && x.nameEn.length >= 4) enNames.push([x.nameEn, x.name, 'gemme']);
  for (const n of Object.values(data.tree.nodes)) {
    if ((n.type === 'notable' || n.type === 'keystone') && n.nameEn !== n.name && n.nameEn.length >= 4) enNames.push([n.nameEn, n.name, 'passif']);
  }
  for (const u of data.items.uniques) if (u.nameEn !== u.name && u.nameEn.length >= 4) enNames.push([u.nameEn, u.name, 'unique']);
  const seenEn = new Set();
  const enList = enNames.filter(([en]) => !seenEn.has(en) && seenEn.add(en)).sort((a, b) => b[0].length - a[0].length);
  const enRe = enList.length ? new RegExp(`(?<![\\p{L}\\p{N}])(${enList.map(([en]) => escRe(en)).join('|')})(?![\\p{L}\\p{N}])`, 'gu') : null;
  const enMap = new Map(enList.map(([en, fr, kind]) => [en, { fr, kind }]));

  return {
    count: Object.keys(entries).length,
    titles: () => [...new Set(Object.values(entries).map((e) => e.t))].sort((a, b) => a.localeCompare(b, 'fr')),
    search(q, limit = 15) {
      const n = norm(q);
      const scored = [];
      const formsEn = g.formsEn || {};
      for (const [slug, e] of Object.entries(entries)) {
        const t = norm(e.t);
        const te = norm(e.tEn);
        let s = 0;
        if (t === n) s = 100;
        else if (te && te === n) s = 97; // terme anglais officiel (« Shock » -> Électrocution)
        else if (norm(slug.replace(/_/g, ' ')) === n) s = 95;
        else if (forms[n] === slug) s = 90;
        else if (formsEn[n] === slug) s = 85;
        else if (t.startsWith(n)) s = 50;
        else if (te && te.startsWith(n)) s = 45;
        else if (t.includes(n)) s = 30;
        else if (te && te.includes(n)) s = 25;
        else if (norm(plain(e.d)).includes(n)) s = 5;
        if (s) scored.push([s, e]);
      }
      return scored
        .sort((a, b) => b[0] - a[0])
        .slice(0, limit)
        .map(([, e]) => ({ terme: e.t, ...(e.tEn ? { termeAnglais: e.tEn } : {}), definition: plain(e.d) }));
    },
    /** Vérifie un texte : termes officiels reconnus (soulignés dans l'interface) + jargon à remplacer */
    check(text) {
      const src = String(text || '');
      const found = new Map();
      if (kwRe) {
        for (const m of src.matchAll(kwRe)) {
          const slug = forms[m[0].toLowerCase()];
          if (slug && entries[slug]) found.set(entries[slug].t, (found.get(entries[slug].t) || 0) + 1);
        }
      }
      const fix = [];
      const seen = new Set();
      // on ignore le code et les liens
      const prose = src.replace(/`[^`]*`/g, ' ').replace(/\]\([^)]*\)/g, ']');
      for (const [re, prop] of JARGON) {
        for (const m of prose.matchAll(re)) {
          const k = m[0].toLowerCase();
          if (seen.has(k)) continue;
          seen.add(k);
          fix.push({ trouve: m[0], proposition: prop, raison: 'jargon / anglais : utiliser le terme officiel du client français' });
        }
      }
      if (enRe) {
        for (const m of prose.matchAll(enRe)) {
          if (seen.has(m[0])) continue;
          seen.add(m[0]);
          const v = enMap.get(m[0]);
          fix.push({ trouve: m[0], proposition: v.fr, raison: `nom anglais d'un(e) ${v.kind} : utiliser le nom français officiel` });
        }
      }
      return {
        termesOfficielsReconnus: [...found.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t),
        aCorriger: fix,
      };
    },
  };
}
