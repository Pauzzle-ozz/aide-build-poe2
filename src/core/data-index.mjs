// Index de recherche sur les données du jeu (data/*.json), construit côté serveur
// comme dans le navigateur (version en ligne).
import { TreeGraph } from './tree-logic.mjs';
import { norm } from './text.mjs';

export function indexData({ tree, gems = [], items = { bases: [], uniques: [], classes: {} }, translations = {}, glossary = { entries: {}, forms: {} } }) {
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
