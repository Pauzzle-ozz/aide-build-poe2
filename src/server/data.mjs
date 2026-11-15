// Chargement des données générées (data/*.json) + index de recherche.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TreeGraph } from '../core/tree-logic.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DATA_DIR = path.join(ROOT, 'data');

export function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function readJson(name, fallback) {
  const f = path.join(DATA_DIR, name);
  if (!fs.existsSync(f)) return fallback;
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

export function loadData() {
  const tree = readJson('tree.json', null);
  if (!tree) throw new Error('Données absentes : lancez "npm run setup" (ou "npm run data").');
  const gems = readJson('gems.json', []);
  const items = readJson('items.json', { bases: [], uniques: [], classes: {} });
  const translations = readJson('translations.json', {});
  const glossary = readJson('glossary.json', { entries: {}, forms: {} });
  const graph = new TreeGraph(tree);

  const gemsById = new Map(gems.map((g) => [g.id, g]));
  const gemsBySkillId = new Map(gems.map((g) => [g.skillId, g]));
  const gemsByName = new Map();
  for (const g of gems) {
    gemsByName.set(norm(g.name), g);
    gemsByName.set(norm(g.nameEn), g);
  }
  const uniquesById = new Map(items.uniques.map((u) => [u.id, u]));
  const uniquesByName = new Map();
  for (const u of items.uniques) {
    uniquesByName.set(norm(u.name), u);
    uniquesByName.set(norm(u.nameEn), u);
  }
  const basesById = new Map(items.bases.map((b) => [b.id, b]));
  const basesByName = new Map();
  for (const b of items.bases) {
    basesByName.set(norm(b.name), b);
    basesByName.set(norm(b.nameEn), b);
  }
  const nodesByName = new Map();
  for (const n of Object.values(tree.nodes)) {
    if (n.type === 'normal' || n.type === 'image') continue;
    for (const k of [norm(n.name), norm(n.nameEn)]) {
      if (!nodesByName.has(k)) nodesByName.set(k, []);
      nodesByName.get(k).push(n);
    }
  }
  return {
    tree, graph, gems, items, translations, glossary,
    gemsById, gemsBySkillId, gemsByName,
    uniquesById, uniquesByName, basesById, basesByName, nodesByName,
  };
}

/** Score de correspondance simple (tous les mots de la requête doivent apparaître) */
export function matchScore(query, ...fields) {
  const q = norm(query);
  if (!q) return 1;
  const words = q.split(' ');
  let score = 0;
  const hay = fields.map(norm);
  for (const w of words) {
    let best = 0;
    for (const [i, h] of hay.entries()) {
      if (!h) continue;
      if (h === q) best = Math.max(best, 100 - i);
      else if (h.startsWith(w)) best = Math.max(best, 20 - i);
      else if (h.includes(w)) best = Math.max(best, 10 - i);
    }
    if (!best) return 0;
    score += best;
  }
  return score;
}
