#!/usr/bin/env node
// Régénère les fiches de référence du skill (clés de voûte + ascendances, FR officiel + nom EN)
// à partir des données de l'outil « Aide Build PoE2 » (data/tree.json).
//
// Usage : node .claude/skills/expert-build-poe2/scripts/generer_references.mjs [chemin/vers/tree.json]
// À relancer après chaque `npm run setup -- --update` (nouvelle ligue / nouvel arbre).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = path.resolve(skillDir, '..', '..', '..');
const treePath = process.argv[2] || path.join(projectRoot, 'data', 'tree.json');
const outDir = path.join(skillDir, 'references');

const tree = JSON.parse(fs.readFileSync(treePath, 'utf8'));
const nodes = Object.values(tree.nodes);

// Aptitudes octroyées (« Grants Skill: X ») : on ajoute la description FR de la gemme correspondante.
const gemsPath = path.join(path.dirname(treePath), 'gems.json');
const gemsByEn = new Map();
if (fs.existsSync(gemsPath)) {
  for (const g of JSON.parse(fs.readFileSync(gemsPath, 'utf8'))) if (g.nameEn && !gemsByEn.has(g.nameEn)) gemsByEn.set(g.nameEn, g);
}
// Mécaniques citées : définition officielle (data/glossary.json) des termes RARES de l'arbre
// (Archonte, Vent porteur, Instabilité…), pour repérer les incompatibilités sans chercher ailleurs.
const glossaryPath = path.join(path.dirname(treePath), 'glossary.json');
let mechanics = () => '';
if (fs.existsSync(glossaryPath)) {
  const G = JSON.parse(fs.readFileSync(glossaryPath, 'utf8'));
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const forms = Object.keys(G.forms).filter((f) => f.length >= 4).sort((a, b) => b.length - a.length);
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${forms.map(esc).join('|')})(?![\\p{L}\\p{N}])`, 'giu');
  const keysOf = (n) => {
    const ks = new Set();
    for (const m of (n.stats || []).join(' · ').matchAll(re)) { const k = G.forms[m[0].toLowerCase()]; if (k) ks.add(k); }
    return ks;
  };
  const freq = new Map();
  for (const n of nodes) for (const k of keysOf(n)) freq.set(k, (freq.get(k) || 0) + 1);
  const clean = (d) => d.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  mechanics = (n) => {
    const rare = [...keysOf(n)].filter((k) => (freq.get(k) || 0) <= 12 && G.entries[k]);
    return rare.map((k) => {
      const d = clean(G.entries[k].d);
      return `  - ⓘ ${G.entries[k].t} : ${d.length > 420 ? d.slice(0, 420) + '…' : d}`;
    }).join('\n') + (rare.length ? '\n' : '');
  };
}

const grantedSkills = (n) => {
  const out = [];
  for (const s of n.statsEn || []) {
    const m = /Grants Skill:\s*(.+)$/.exec(s);
    const g = m && gemsByEn.get(m[1].trim());
    if (g) out.push(`  - ↳ Aptitude « ${g.name} » (${g.nameEn}) [${(g.tags || []).join(', ')}] : ${g.description || g.descriptionEn || '?'}`);
  }
  return out.length ? out.join('\n') + '\n' : '';
};
const today = new Date().toISOString().slice(0, 10);
const header = `<!-- Généré par scripts/generer_references.mjs le ${today} depuis data/tree.json (arbre ${tree.version || '?'}). Ne pas éditer à la main. -->\n`;

const fmtStats = (n) => (n.stats || []).filter(Boolean).join(' · ');
const fmtStatsEn = (n) => (n.statsEn || []).filter(Boolean).join(' · ');
const nameOf = (n) => (n.name && n.nameEn && n.name !== n.nameEn ? `${n.name} (${n.nameEn})` : n.name || n.nameEn);
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------- Clés de voûte ----------
const keystones = nodes.filter((n) => n.type === 'keystone').sort((a, b) => a.name.localeCompare(b.name, 'fr'));
let ks = header + `# Clés de voûte (${keystones.length}) — arbre ${tree.version || '?'}\n\n`;
ks += "Texte officiel FR (poe2db) puis texte EN entre crochets. Les clés de voûte d'ascendance n'en font pas partie (voir ascendances/).\n\n";
for (const k of keystones) {
  ks += `## ${nameOf(k)} — id ${k.id}\n- FR : ${fmtStats(k)}\n- EN : ${fmtStatsEn(k)}\n${mechanics(k)}\n`;
}
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'cles-de-voute.md'), ks);

// ---------- Ascendances, par classe ----------
const ascDir = path.join(outDir, 'ascendances');
fs.mkdirSync(ascDir, { recursive: true });
const index = [];
for (const cls of tree.classes) {
  const ascs = cls.ascendancies || [];
  if (!ascs.length) continue;
  let md = header + `# ${cls.name} (${cls.nameEn}) — ascendances\n\n`;
  md += 'Notables d\'ascendance : nom FR (nom EN) — effets FR officiels, puis EN. 8 points d\'ascendance au total (4 Épreuves).\n\n';
  for (const a of ascs) {
    const own = nodes.filter((n) => n.ascendancy === a.id);
    const notables = own.filter((n) => n.type === 'notable').sort((x, y) => x.y - y.y);
    const small = own.filter((n) => n.type === 'normal');
    md += `## ${a.name} (${a.nameEn})\n\n`;
    for (const n of notables) {
      md += `### ${nameOf(n)} — id ${n.id}\n- ${fmtStats(n)}\n- EN : ${fmtStatsEn(n)}\n${grantedSkills(n)}${mechanics(n)}\n`;
    }
    const smallSet = [...new Set(small.map((n) => fmtStats(n)).filter(Boolean))];
    if (smallSet.length) md += `Petits nœuds (2 par notable en général) : ${smallSet.join(' | ')}\n\n`;
  }
  const file = `${slug(cls.nameEn)}.md`;
  fs.writeFileSync(path.join(ascDir, file), md);
  index.push(`- ${cls.name} (${cls.nameEn}) : ${ascs.map((a) => a.name + (a.name !== a.nameEn ? ` (${a.nameEn})` : '')).join(', ')} → ascendances/${file}`);
}
fs.writeFileSync(path.join(ascDir, 'INDEX.md'), header + `# Classes et ascendances — arbre ${tree.version || '?'}\n\n${index.join('\n')}\n`);

console.log(`OK : ${keystones.length} clés de voûte, ${index.length} classes → ${outDir}`);
