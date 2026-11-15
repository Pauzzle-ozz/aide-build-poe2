#!/usr/bin/env node
// Vérifie un texte (réponse, notes de build) avant de le donner au joueur :
//  1. chaque nom entre « guillemets » ou en **gras** existe-t-il dans les données du jeu
//     (passifs, gemmes, uniques, bases — FR ou EN) ?
//  2. traductions non officielles fréquentes (sbire, anneau, choc, DPS, crit…).
// Complément hors ligne de l'outil MCP `verifier_texte` (qui vérifie le vocabulaire avec le glossaire officiel
// du jeu, data/glossary.json) : ce script, lui, vérifie surtout que les NOMS cités existent.
//
// Usage : node .claude/skills/expert-build-poe2/scripts/verifier_noms.mjs <fichier.md> [--json]
// Un nom « inconnu » n'est pas forcément faux (terme générique, mécanique, nom de quête) : relis-le.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(skillDir, '..', '..', '..');
const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error('Usage : verifier_noms.mjs <fichier.md> [--json]');
  process.exit(1);
}
const asJson = process.argv.includes('--json');
const read = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', n), 'utf8'));
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[’']/g, "'").replace(/[…]/g, '...').replace(/\s+/g, ' ').replace(/^[\s.]+|[\s.]+$/g, '').trim();

const known = new Map();
const add = (name, kind) => { const k = norm(name); if (k && !known.has(k)) known.set(k, kind); };
const tree = read('tree.json');
for (const n of Object.values(tree.nodes)) {
  if (n.type === 'normal') continue;
  add(n.name, n.type + (n.ascendancy ? `:${n.ascendancy}` : ''));
  add(n.nameEn, n.type + (n.ascendancy ? `:${n.ascendancy}` : ''));
}
for (const c of tree.classes) {
  add(c.name, 'classe'); add(c.nameEn, 'classe');
  for (const a of c.ascendancies || []) { add(a.name, 'ascendance'); add(a.nameEn, 'ascendance'); }
}
for (const g of read('gems.json')) { add(g.name, `gemme ${g.kind}`); add(g.nameEn, `gemme ${g.kind}`); }
const items = read('items.json');
for (const u of items.uniques) { add(u.name, 'unique'); add(u.nameEn, 'unique'); }
for (const b of items.bases) { add(b.name, 'base'); add(b.nameEn, 'base'); }

const text = fs.readFileSync(file, 'utf8');
// Candidats : noms entre « », noms en **gras** (sauf intitulés suivis de « : »), et noms anglais entre
// parenthèses juste après un nom FR (« Nom FR (English Name) »).
const candidates = new Set();
for (const m of text.matchAll(/«\s*([^»]{2,80}?)\s*»/g)) if (/^[A-ZÀ-Ý]/.test(m[1]) && m[1].split(' ').length <= 7) candidates.add(m[1]);
for (const m of text.matchAll(/\*\*([^*\n]{3,60}?)\*\*(\s*:)?/g)) {
  const b = m[1].trim().replace(/\s*[:—–-]\s*$/, '');
  if (!m[2] && /^[A-ZÀ-Ý]/.test(b) && b.split(' ').length <= 6 && !/[:?!0-9%→]/.test(b)) candidates.add(b);
}
for (const m of text.matchAll(/\(([A-Z][A-Za-z'’ .,-]{2,50}?)\)/g)) {
  const en = m[1].trim();
  if (en.split(' ').length <= 6 && !/^(EN|FR|PoB|DoT|ES|CI|MoM|SSF|HC|DPS|EHP|AoE)$/.test(en)) candidates.add(en);
}

// Les termes de mécanique du glossaire (Davantage, Esprit, Chain…) ne sont pas des noms à vérifier.
const glossary = (() => {
  try { return norm(fs.readFileSync(path.join(skillDir, 'references', 'glossaire-fr.md'), 'utf8')); } catch { return ''; }
})();
for (const c of [...candidates]) {
  const k = norm(c.replace(/[…]+$/, ''));
  if (k.length < 3 || (k.split(' ').length <= 2 && new RegExp(`(^|[^a-z])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(glossary))) candidates.delete(c);
}

const lookup = (p) => known.get(norm(p)) || known.get(norm(p.replace(/\s+(I|II|III|IV|V)$/, '')));
const found = [];
const unknown = [];
for (const raw of candidates) {
  const parts = [raw, ...raw.split(/\s*[()]\s*/).filter(Boolean)];
  const hit = parts.map((p) => [p, lookup(p)]).find(([, k]) => k);
  if (hit) found.push({ nom: raw, type: hit[1] });
  else unknown.push(raw);
}

// Frontières de mot Unicode (sinon « écrit » contiendrait « crit »).
const W = (p, f = 'gi') => new RegExp(`(?<![\\p{L}\\p{N}])(?:${p})(?![\\p{L}\\p{N}])`, `${f}u`);
const SUSPECTS = [
  [W('sbires?'), 'Minions = « Créatures »'],
  [W('anneaux?'), 'Ring = « Bague »'],
  [W('(?<!ondes? de )chocs?'), 'Shock = « Électrocution »'],
  [W('increased'), 'increased = « Augmentation »'],
  [W('\\d+\\s?% more'), 'more = « Davantage »'],
  [W('compétences? passives?'), 'passive skill = « Talent passif » / « passif »'],
  [W('DPS', 'g'), 'DPS = « dégâts par seconde »'],
  [W('crits?|AoE|leech|buffs?|debuffs?|skills?|procs?|DoT'), 'jargon anglais → terme officiel (outil glossaire)'],
];
const suspects = [];
for (const [re, hint] of SUSPECTS) {
  const n = (text.match(re) || []).length;
  if (n) suspects.push({ motif: re.source, occurrences: n, conseil: hint });
}

// Vocabulaire officiel : si le serveur de l'outil tourne, on interroge son glossaire (data/glossary.json + liste
// JARGON de src/server/glossary.mjs) — c'est la référence. Sinon, seule la liste locale ci-dessus s'applique.
let glossaire = null;
try {
  const port = Number(process.env.POE2_PORT || 4747);
  const r = await fetch(`http://127.0.0.1:${port}/api/glossary/check`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(3000),
  });
  if (r.ok) glossaire = await r.json();
} catch { /* serveur arrêté : vérification locale seulement */ }

const out = {
  fichier: file, nomsReconnus: found.length, nomsInconnus: unknown, traductionsSuspectes: suspects,
  glossaire: glossaire ? { termesOfficielsReconnus: glossaire.termesOfficielsReconnus?.length ?? 0, aCorriger: glossaire.aCorriger || [] } : 'serveur non joignable (vérification du vocabulaire locale seulement)',
};
if (asJson) console.log(JSON.stringify(out, null, 2));
else {
  console.log(`${found.length} noms reconnus dans les données.`);
  console.log(unknown.length ? `À vérifier (introuvables dans les données) :\n  - ${unknown.join('\n  - ')}` : 'Aucun nom introuvable.');
  console.log(suspects.length ? `Traductions suspectes :\n  - ${suspects.map((s) => `${s.conseil} (×${s.occurrences})`).join('\n  - ')}` : 'Aucune traduction suspecte.');
  if (typeof out.glossaire === 'string') console.log(`Glossaire officiel : ${out.glossaire}`);
  else if (out.glossaire.aCorriger.length) {
    console.log(`Glossaire officiel — à corriger (${out.glossaire.aCorriger.length}) :`);
    for (const c of out.glossaire.aCorriger) console.log(`  - « ${c.trouve} » → ${c.proposition}`);
  } else console.log(`Glossaire officiel : vocabulaire conforme (${out.glossaire.termesOfficielsReconnus} termes officiels reconnus).`);
}
