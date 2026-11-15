// Modèle de build (format JSON stocké dans builds/) + résumé lisible.
import { aggregateLines, computeAttributes } from './stats.mjs';
import { passivePointsForLevel } from './tree-logic.mjs';
import { checkSkills } from './gems-logic.mjs';

export const SLOTS = [
  { id: 'Weapon 1', label: 'Arme principale' },
  { id: 'Weapon 2', label: 'Main secondaire' },
  { id: 'Helmet', label: 'Casque' },
  { id: 'Body Armour', label: 'Armure de torse' },
  { id: 'Gloves', label: 'Gants' },
  { id: 'Boots', label: 'Bottes' },
  { id: 'Amulet', label: 'Amulette' },
  { id: 'Ring 1', label: 'Bague gauche' },
  { id: 'Ring 2', label: 'Bague droite' },
  { id: 'Belt', label: 'Ceinture' },
  { id: 'Flask 1', label: 'Flacon de vie' },
  { id: 'Flask 2', label: 'Flacon de mana' },
  { id: 'Charm 1', label: 'Charme 1' },
  { id: 'Charm 2', label: 'Charme 2' },
  { id: 'Charm 3', label: 'Charme 3' },
  { id: 'Weapon 1 Swap', label: 'Arme principale (set 2)' },
  { id: 'Weapon 2 Swap', label: 'Main secondaire (set 2)' },
];
export const SLOT_IDS = SLOTS.map((s) => s.id);
export const SLOT_LABEL = Object.fromEntries(SLOTS.map((s) => [s.id, s.label]));

export const RARITY_FR = { NORMAL: 'Normal', MAGIC: 'Magique', RARE: 'Rare', UNIQUE: 'Unique' };

export function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function createBuild({ name = 'Nouveau build', class: cls = 'Warrior', ascendancy = null, level = 1 } = {}) {
  const now = new Date().toISOString();
  return {
    id: newId(),
    name,
    createdAt: now,
    updatedAt: now,
    class: cls,
    ascendancy,
    level,
    tree: { nodes: [], attributes: {}, weaponSet1: [], weaponSet2: [] },
    skills: [],
    items: {},
    notes: '',
  };
}

export function normalizeBuild(b) {
  const d = createBuild();
  const out = { ...d, ...b };
  out.tree = { ...d.tree, ...(b.tree || {}) };
  out.tree.nodes = [...new Set((out.tree.nodes || []).map(Number))];
  out.tree.attributes ||= {};
  out.skills = Array.isArray(b.skills) ? b.skills : [];
  for (const s of out.skills) {
    s.id ||= newId();
    s.gems = Array.isArray(s.gems) ? s.gems : [];
    if (s.enabled === undefined) s.enabled = true;
  }
  out.items = b.items && typeof b.items === 'object' ? b.items : {};
  out.level = Math.max(1, Math.min(100, Number(out.level) || 1));
  return out;
}

/** Lignes de mods d'un objet équipé, dans la langue voulue */
export function itemLines(item, lang = 'fr') {
  if (!item) return [];
  const pick = (fr, en) => (lang === 'fr' ? fr || en : en || fr) || [];
  return [...pick(item.implicitsFr, item.implicits), ...pick(item.explicitsFr, item.explicits)];
}

/**
 * Résumé complet d'un build, utilisé par l'interface (panneau Stats) et par Claude (MCP).
 * ctx = { graph: TreeGraph, gemsById: Map, lang }
 */
export function summarizeBuild(build, ctx) {
  const { graph, gemsById } = ctx;
  const lang = ctx.lang || 'fr';
  const cls = graph.classById[build.class];
  const asc = build.ascendancy ? graph.ascById[build.ascendancy] : null;
  const used = graph.pointsUsed(build);

  const passiveLines = [];
  const passiveLinesEn = [];
  const keystones = [];
  const notables = [];
  const ascNodes = [];
  for (const id of build.tree.nodes) {
    const n = graph.node(id);
    if (!n) continue;
    const label = graph.nodeLabel(n, build, lang);
    for (const s of graph.nodeStats(n, build, lang)) passiveLines.push({ text: s, source: label });
    for (const s of graph.nodeStats(n, build, 'en')) passiveLinesEn.push(s);
    const entry = { id: n.id, name: label, nameEn: n.nameEn, stats: graph.nodeStats(n, build, lang) };
    if (n.ascendancy) ascNodes.push(entry);
    else if (n.type === 'keystone') keystones.push(entry);
    else if (n.type === 'notable') notables.push(entry);
  }

  const itemLinesAll = [];
  const itemLinesEn = [];
  const items = [];
  for (const slot of SLOT_IDS) {
    const it = build.items[slot];
    if (!it) continue;
    const label = it.name || it.base || slot;
    for (const l of itemLines(it, lang)) itemLinesAll.push({ text: l, source: label });
    for (const l of itemLines(it, 'en')) itemLinesEn.push(l);
    items.push({ slot, slotLabel: SLOT_LABEL[slot], rarity: it.rarity, name: it.name, base: it.base, mods: itemLines(it, lang) });
  }

  const attributes = cls ? computeAttributes(cls.base, [...passiveLinesEn, ...itemLinesEn]) : null;

  const skills = build.skills.map((s) => ({
    id: s.id,
    label: s.label || null,
    enabled: s.enabled !== false,
    gems: s.gems.map((g) => {
      const gd = gemsById.get(g.gemId);
      return {
        gemId: g.gemId,
        name: gd ? (lang === 'fr' ? gd.name : gd.nameEn) : g.nameSpec || g.gemId,
        kind: gd?.kind || null,
        level: g.level ?? 20,
        quality: g.quality ?? 0,
        enabled: g.enabled !== false,
      };
    }),
  }));

  return {
    id: build.id,
    name: build.name,
    level: build.level,
    class: cls ? { id: cls.id, name: lang === 'fr' ? cls.name : cls.nameEn } : null,
    ascendancy: asc ? { id: asc.id, name: lang === 'fr' ? asc.name : asc.nameEn } : null,
    points: {
      passiveUsed: used.passive,
      passiveAvailableAtLevel: passivePointsForLevel(build.level),
      passiveMax: graph.tree.points?.passive ?? 123,
      ascendancyUsed: used.ascendancy,
      ascendancyMax: graph.tree.points?.ascendancy ?? 8,
    },
    attributes,
    keystones,
    notables,
    ascendancyNodes: ascNodes,
    passiveStats: aggregateLines(passiveLines).map((l) => l.text),
    itemStats: aggregateLines(itemLinesAll).map((l) => l.text),
    skills,
    skillWarnings: checkSkills(build, gemsById).map((w) => w.text),
    items,
    notes: build.notes || '',
  };
}

/** Liste lisible des différences entre la version enregistrée d'un build et son brouillon */
export function diffBuilds(saved, draft) {
  const out = [];
  if (!saved || !draft) return out;
  if (saved.name !== draft.name) out.push('nom');
  if (saved.level !== draft.level) out.push('niveau');
  if (saved.class !== draft.class || (saved.ascendancy || null) !== (draft.ascendancy || null)) out.push('classe / ascendance');
  const A = new Set(saved.tree?.nodes || []);
  const B = new Set(draft.tree?.nodes || []);
  const added = [...B].filter((x) => !A.has(x)).length;
  const removed = [...A].filter((x) => !B.has(x)).length;
  if (added) out.push(`+${added} passif${added > 1 ? 's' : ''}`);
  if (removed) out.push(`-${removed} passif${removed > 1 ? 's' : ''}`);
  if (JSON.stringify(saved.tree?.attributes || {}) !== JSON.stringify(draft.tree?.attributes || {})) out.push('attributs');
  if (JSON.stringify(saved.skills || []) !== JSON.stringify(draft.skills || [])) out.push('gemmes');
  if (JSON.stringify(saved.items || {}) !== JSON.stringify(draft.items || {})) out.push('équipement');
  if ((saved.notes || '') !== (draft.notes || '')) out.push('notes');
  return out;
}
