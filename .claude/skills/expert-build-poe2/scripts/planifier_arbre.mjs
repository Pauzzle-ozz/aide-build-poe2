#!/usr/bin/env node
// Planificateur d'arbre passif HORS LIGNE : ne modifie aucun build et ne touche pas à l'interface.
// Sert à comparer des options (coût en points, chemin, bonus cumulés) avant d'écrire dans l'outil.
//
// Exemples (depuis la racine du projet « aide build poe2 ») :
//   node .claude/skills/expert-build-poe2/scripts/planifier_arbre.mjs --classe "Évocateur" --cibles "Je suis le Tonnerre…;Résonance"
//   node .claude/skills/expert-build-poe2/scripts/planifier_arbre.mjs --classe Moine --chercher "foudre" --type notable --max 15
//   node .claude/skills/expert-build-poe2/scripts/planifier_arbre.mjs --build 34mdk7ubhqtg --chercher "critique" --max 10
//   node .claude/skills/expert-build-poe2/scripts/planifier_arbre.mjs --build 34mdk7ubhqtg --cibles "Batterie surnaturelle" --json
//
// Options :
//   --classe <classe ou ascendance FR/EN>   part de zéro pour cette classe (et ascendance si fournie)
//   --build <id>                            part de l'arbre d'un build existant (lecture seule)
//   --cibles "A;B;id"                       alloue ces nœuds dans l'ordre (chemin le plus court) et fait le bilan
//   --chercher "mots"                       liste les nœuds dont le nom/effet (FR ou EN) contient ces mots,
//                                           triés par coût depuis l'arbre (après les cibles éventuelles)
//   --type notable|keystone|normal|tous     filtre de --chercher (défaut : notable+keystone)
//   --max N                                 nombre de résultats de --chercher (défaut 20)
//   --stats                                 affiche le total des bonus de tout l'arbre planifié
//   --json                                  sortie JSON

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(skillDir, '..', '..', '..');
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const k = a.slice(2);
  const next = process.argv[i + 1];
  if (next === undefined || next.startsWith('--')) args[k] = true;
  else { args[k] = next; i++; }
}

const fail = (msg) => { console.error(`Erreur : ${msg}`); process.exit(1); };

const { loadData, norm, matchScore } = await imp('src/server/data.mjs');
const { createBuild, normalizeBuild } = await imp('src/core/build-model.mjs');
const { aggregateLines } = await imp('src/core/stats.mjs');
const { resolveClass, resolveNode } = await imp('src/server/ops.mjs');

const data = loadData();
const { graph } = data;

// ---------- build de départ (copie en mémoire, jamais réécrite) ----------
let build;
if (args.build) {
  const f = path.join(ROOT, 'builds', `${args.build}.json`);
  if (!fs.existsSync(f)) fail(`build introuvable : ${f}`);
  build = normalizeBuild(JSON.parse(fs.readFileSync(f, 'utf8')));
} else if (args.classe) {
  const { cls, asc } = resolveClass(data, String(args.classe));
  build = createBuild({ class: cls.id, ascendancy: asc?.id || null, level: 100 });
} else {
  fail('précisez --classe <classe/ascendance> ou --build <id>.');
}
build = JSON.parse(JSON.stringify(build));
const cls = graph.classById[build.class];
const asc = build.ascendancy ? graph.ascById[build.ascendancy] : null;
const startPoints = graph.pointsUsed(build);

const label = (n) => (n.name !== n.nameEn ? `${n.name} (${n.nameEn})` : n.name);
const out = {
  depart: `${cls?.name}${asc ? ' / ' + asc.name : ''}${args.build ? ` — build ${build.name}` : ''}`,
  pointsDepart: startPoints,
  cibles: [],
  recherche: [],
};

// ---------- cibles ----------
if (args.cibles) {
  for (const ref of String(args.cibles).split(';').map((s) => s.trim()).filter(Boolean)) {
    try {
      // Nom FR partagé par plusieurs nœuds différents (ex. « Chaleur accablante ») : on prévient.
      const homonyms = (data.nodesByName.get(norm(ref)) || []).filter((n) => graph.isAllocatable(n, build));
      const distinct = [...new Map(homonyms.map((n) => [n.nameEn, n])).values()];
      if (distinct.length > 1) {
        console.error(`⚠ « ${ref} » désigne ${distinct.length} nœuds différents : ${distinct.map((n) => `${n.nameEn} (id ${n.id})`).join(', ')} — le plus proche est pris ; passe l'id pour choisir.`);
      }
      const node = resolveNode(data, build, ref);
      const { added } = graph.allocate(build, node.id);
      out.cibles.push({
        cible: label(node), id: node.id, type: node.type,
        cout: added.filter((id) => { const n = graph.node(id); return n && !n.isFreeAllocate; }).length,
        chemin: added.map((id) => { const n = graph.node(id); return `${n.name}${n.type === 'normal' ? '' : ' [' + n.type + ']'}`; }),
        effets: node.stats || [],
      });
    } catch (e) {
      out.cibles.push({ cible: ref, erreur: e.message });
    }
  }
}
const endPoints = graph.pointsUsed(build);
out.pointsFin = endPoints;

// ---------- recherche ----------
if (args.chercher) {
  const types = args.type === 'tous' ? null : args.type ? [args.type] : ['notable', 'keystone'];
  const dist = graph.distances(build);
  const alloc = graph.allocatedSet(build);
  const res = [];
  for (const n of Object.values(graph.nodes)) {
    if (!graph.isAllocatable(n, build) || alloc.has(n.id)) continue;
    if (types && !types.includes(n.type)) continue;
    const score = matchScore(String(args.chercher), n.name, n.nameEn, (n.stats || []).join(' '), (n.statsEn || []).join(' '));
    if (!score) continue;
    const d = dist.get(n.id);
    if (d === undefined) continue;
    res.push({ nom: label(n), id: n.id, type: n.type, cout: d, effets: n.stats || [] });
  }
  res.sort((a, b) => a.cout - b.cout || a.nom.localeCompare(b.nom, 'fr'));
  out.recherche = res.slice(0, Number(args.max) || 20);
}

// ---------- bilan des bonus ----------
if (args.stats) {
  const lines = [];
  for (const id of build.tree.nodes) {
    const n = graph.node(id);
    if (!n) continue;
    for (const t of graph.nodeStats(n, build, 'fr') || []) lines.push({ text: t, source: n.name });
  }
  out.bonus = aggregateLines(lines).map((g) => g.text);
  out.clesDeVoute = build.tree.nodes.map((id) => graph.node(id)).filter((n) => n?.type === 'keystone').map(label);
}

if (args.json) {
  console.log(JSON.stringify(out, null, 2));
} else {
  const p = (x) => `${x.passive} passifs + ${x.ascendancy} ascendance`;
  console.log(`Départ : ${out.depart} (${p(out.pointsDepart)})`);
  for (const c of out.cibles) {
    if (c.erreur) { console.log(`✗ ${c.cible} : ${c.erreur}`); continue; }
    console.log(`\n+ ${c.cible} [${c.type}, id ${c.id}] : +${c.cout} pts`);
    if (c.effets.length) console.log(`  effets : ${c.effets.join(' · ')}`);
    console.log(`  chemin : ${c.chemin.join(' → ') || '(déjà alloué)'}`);
  }
  if (out.cibles.length) console.log(`\nTotal après plan : ${p(out.pointsFin)} (soit +${out.pointsFin.passive - out.pointsDepart.passive} passifs, +${out.pointsFin.ascendancy - out.pointsDepart.ascendancy} ascendance)`);
  if (out.recherche.length) {
    console.log(`\nRecherche « ${args.chercher} » (coût depuis l'arbre planifié) :`);
    for (const r of out.recherche) console.log(`  ${String(r.cout).padStart(3)} pts  ${r.nom} [${r.type}, id ${r.id}] — ${r.effets.join(' · ')}`);
  } else if (args.chercher) console.log(`\nRecherche « ${args.chercher} » : aucun résultat accessible.`);
  if (out.bonus) {
    console.log(`\nClés de voûte : ${out.clesDeVoute.join(', ') || 'aucune'}`);
    console.log('Bonus cumulés de l\'arbre planifié :');
    for (const t of out.bonus) console.log(`  - ${t}`);
  }
}
