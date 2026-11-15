// Rangement de la bibliothèque par personnage (classe) : sections hiérarchiques pour
// les passifs, gemmes, uniques et bases. Les éléments communs à toutes les classes sont en bas.
import { CLASS_CATEGORY } from './gem-classes.js';

// Palier de gemme -> niveau de personnage requis pour la tailler (tableau officiel des paliers)
export const TIER_LEVEL = { 0: 1, 1: 1, 2: 3, 3: 6, 4: 10, 5: 14, 6: 18, 7: 22, 8: 26, 9: 31, 10: 36, 11: 41, 12: 46, 13: 52, 14: 58, 15: 64, 16: 66, 17: 72, 18: 78, 19: 84, 20: 90 };

// Armes associées à chaque classe (arme de départ / famille de gemmes du jeu)
export const CLASS_WEAPONS = {
  Warrior: { weapons: ['One Hand Mace', 'Two Hand Mace'], offhand: ['Shield'] },
  Monk: { weapons: ['Quarterstaff'], offhand: [] },
  Ranger: { weapons: ['Bow'], offhand: ['Quiver'] },
  Mercenary: { weapons: ['Crossbow'], offhand: [] },
  Huntress: { weapons: ['Spear'], offhand: ['Buckler'] },
  Sorceress: { weapons: ['Staff', 'Wand'], offhand: ['Focus'] },
  Witch: { weapons: ['Sceptre', 'Wand'], offhand: ['Focus'] },
  Druid: { weapons: ['Talisman'], offhand: [] },
};

const DEF_BY_ATTR = { str: 'Armour', dex: 'Evasion', int: 'Energy Shield' };
const DEF_FR = { Armour: 'Armure', Evasion: 'Évasion', 'Energy Shield': 'Bouclier d\'énergie' };
const ARMOUR_SLOTS = [
  ['Helmet', 'Casques'],
  ['Body Armour', 'Armures de torse'],
  ['Gloves', 'Gants'],
  ['Boots', 'Bottes'],
];
const OFFHAND_FR = { Shield: 'Boucliers', Buckler: 'Targes', Focus: 'Focaliseurs', Quiver: 'Carquois' };
const COMMON_GROUPS = [
  ['Amulet', 'Amulettes'],
  ['Ring', 'Bagues'],
  ['Belt', 'Ceintures'],
  ['Jewel', 'Joyaux'],
  ['Life Flask', 'Flacons de Vie'],
  ['Mana Flask', 'Flacons de Mana'],
  ['Charm', 'Charmes'],
];

export function mainAttrs(cls) {
  const b = cls.base;
  const min = Math.min(b.str, b.dex, b.int);
  return ['str', 'dex', 'int'].filter((k) => b[k] > min);
}

/** Défenses que la classe privilégie (d'après ses attributs principaux) */
export function classDefences(cls) {
  return mainAttrs(cls).map((a) => DEF_BY_ATTR[a]);
}

export function defenceLabel(subType) {
  if (!subType) return null;
  return subType.split('/').map((d) => DEF_FR[d] || d).join(' / ');
}

export function itemLevel(it) {
  const m = (it.requirements?.[0] || '').match(/Niveau (\d+)/);
  return m ? Number(m[1]) : 1;
}

// ---------------------------------------------------------------- Thèmes des passifs
export const THEMES = [
  ['all', 'Tous les thèmes'],
  ['Foudre', /foudre|électrocut|foudroi/i],
  ['Feu', /\bfeu\b|embras|inflammab/i],
  ['Froid', /froid|gel\b|gèle|frigorif/i],
  ['Chaos', /chaos|poison|empoison/i],
  ['Physique', /physique|saignement|hémorragie/i],
  ['Critique', /critique/i],
  ['Attaque', /attaque|mêlée|bâton|arme/i],
  ['Sort', /\bsorts?\b|incantation/i],
  ['Créatures et compagnons', /créature|compagnon|totem/i],
  ['Vie', /\bvie\b/i],
  ['Mana', /mana/i],
  ['Bouclier d\'énergie', /bouclier d'énergie/i],
  ['Évasion', /évasion|déviation/i],
  ['Armure', /\barmure\b/i],
  ['Résistances', /résistance/i],
  ['Charges', /charges? de (pouvoir|frénésie|endurance)/i],
  ['Attributs', /force|dextérité|intelligence|attribut/i],
  ['Esprit', /esprit/i],
];
export function matchTheme(node, theme) {
  if (!theme || theme === 'all') return true;
  const re = THEMES.find(([k]) => k === theme)?.[1];
  return re ? re.test(`${node.name} ${node.stats.join(' ')}`) : true;
}

// ---------------------------------------------------------------- Sections
// Une section : { id, title, hint?, common?, depth (1 = titre, 2 = sous-titre), items: [] }

export function passiveSections(data, classId, { theme, dist }) {
  const { tree, graph } = data;
  const out = [];
  const nodes = Object.values(tree.nodes).filter((n) => n.type !== 'image' && n.type !== 'classStart' && n.links?.length && matchTheme(n, theme));
  const classes = classId === 'all' ? graph.classes : [graph.classById[classId]];
  for (const c of classes) {
    for (const a of c.ascendancies) {
      const asc = nodes.filter((n) => n.ascendancy === a.id && n.type !== 'ascendancyStart');
      if (!asc.length) continue;
      out.push({ id: `asc-${a.id}`, depth: 1, title: `Ascendance : ${a.name}`, hint: classId === 'all' ? c.name : 'propre à votre classe', items: [] });
      out.push({ id: `asc-${a.id}-n`, depth: 2, title: 'Notables d\'ascendance', items: asc.filter((n) => n.type === 'notable').sort(byName) });
      out.push({ id: `asc-${a.id}-p`, depth: 2, title: 'Petits passifs d\'ascendance', items: asc.filter((n) => n.type !== 'notable').sort(byName) });
    }
  }
  const main = nodes.filter((n) => !n.ascendancy && n.type !== 'ascendancyStart');
  const d = (n) => dist?.get(n.id) ?? 999;
  const near = classId === 'all' ? null : graph.classById[classId]?.name;
  out.push({
    id: 'main',
    depth: 1,
    common: true,
    title: 'Arbre passif commun à toutes les classes',
    hint: near ? `trié par distance depuis le départ : ${near}` : 'trié par nom',
    items: [],
  });
  const sortMain = (a, b) => (near ? d(a) - d(b) : 0) || byName(a, b);
  out.push({ id: 'main-k', depth: 2, common: true, title: 'Clés de voûte', items: main.filter((n) => n.type === 'keystone').sort(sortMain) });
  const notables = main.filter((n) => n.type === 'notable');
  if (near) {
    const bands = [
      ['main-n1', "Notables tout proches (jusqu'à 15 points)", 0, 15],
      ['main-n2', 'Notables proches (16 à 20 points)', 16, 20],
      ['main-n3', 'Notables à mi-distance (21 à 26 points)', 21, 26],
      ['main-n4', 'Notables éloignés (27 à 32 points)', 27, 32],
      ['main-n5', 'Notables très éloignés (plus de 32 points)', 33, 9999],
    ];
    for (const [id, title, lo, hi] of bands) {
      out.push({ id, depth: 2, common: true, title, items: notables.filter((n) => d(n) >= lo && d(n) <= hi).sort(sortMain) });
    }
  } else {
    out.push({ id: 'main-n', depth: 2, common: true, title: 'Notables', items: notables.sort(sortMain) });
  }
  out.push({ id: 'main-j', depth: 2, common: true, title: 'Emplacements de joyau', items: main.filter((n) => n.type === 'jewel').sort(sortMain) });
  out.push({ id: 'main-s', depth: 2, common: true, title: 'Petits passifs', hint: 'regroupés par effet', items: dedupeSmall(main.filter((n) => n.type === 'normal').sort(sortMain)) });
  return out;
}

// Les petits passifs se répètent des centaines de fois : on n'en garde qu'un par effet (le plus proche)
function dedupeSmall(list) {
  const seen = new Map();
  for (const n of list) {
    const k = `${n.name}|${n.stats.join('|')}`;
    if (!seen.has(k)) seen.set(k, { ...n, copies: 1, ids: [n.id] });
    else {
      seen.get(k).copies++;
      seen.get(k).ids.push(n.id);
    }
  }
  return [...seen.values()];
}

export function gemSections(data, classId) {
  const { gems, graph } = data;
  const out = [];
  const byTier = (list, label, idBase, { common } = {}) => {
    const tiers = [...new Set(list.map((g) => g.tier ?? 0))].sort((a, b) => a - b);
    for (const t of tiers) {
      const items = list.filter((g) => (g.tier ?? 0) === t).sort(byName);
      const lvl = TIER_LEVEL[t];
      out.push({
        id: `${idBase}-t${t}`,
        depth: 2,
        common,
        title: t === 0 ? `${label} — de base` : `${label} — palier ${t}`,
        hint: t === 0 ? 'toujours disponibles' : lvl ? `taillable dès le niveau ${lvl}` : '',
        items,
      });
    }
  };
  const classes = classId === 'all' ? graph.classes : [graph.classById[classId]];
  for (const c of classes) {
    const fam = CLASS_CATEGORY[c.id];
    const own = gems.filter((g) => g.category === fam);
    out.push({ id: `fam-${c.id}`, depth: 1, title: `Famille « ${fam} »`, hint: `gemmes de la classe ${c.name}`, items: [] });
    byTier(own.filter((g) => g.kind === 'skill'), "Gemmes d'aptitude", `fam-${c.id}-skill`);
    byTier(own.filter((g) => g.kind === 'spirit'), "Gemmes d'esprit", `fam-${c.id}-spirit`);
    const meta = own.filter((g) => g.kind === 'meta');
    if (meta.length) out.push({ id: `fam-${c.id}-meta`, depth: 2, title: 'Méta-gemmes', items: meta.sort(byTierName) });
    for (const a of c.ascendancies) {
      const asc = gems.filter((g) => g.grantedBy === a.id);
      if (asc.length) out.push({ id: `fam-${c.id}-asc-${a.id}`, depth: 2, title: `Conférées par l'ascendance ${a.name}`, items: asc.sort(byName) });
    }
  }
  const supports = gems.filter((g) => g.kind === 'support');
  out.push({ id: 'common', depth: 1, common: true, title: 'Gemmes communes à toutes les classes', hint: 'soutiens, lignages et aptitudes conférées par des objets', items: [] });
  for (const [color, label] of [['str', 'rouges (Force)'], ['dex', 'vertes (Dextérité)'], ['int', 'bleues (Intelligence)']]) {
    byTier(supports.filter((g) => g.color === color), `Soutiens ${label}`, `sup-${color}`, { common: true });
  }
  const otherSup = supports.filter((g) => !['str', 'dex', 'int'].includes(g.color));
  if (otherSup.length) out.push({ id: 'sup-other', depth: 2, common: true, title: 'Soutiens sans couleur', items: otherSup.sort(byTierName) });
  out.push({ id: 'lineage', depth: 2, common: true, title: 'Soutiens de lignage', hint: 'objets rares de fin de jeu', items: gems.filter((g) => g.kind === 'lineage').sort(byName) });
  out.push({
    id: 'other',
    depth: 2,
    common: true,
    title: 'Autres aptitudes communes',
    hint: 'conférées par des objets ou des effets',
    items: gems.filter((g) => g.kind !== 'support' && g.kind !== 'lineage' && (g.classes || ['common']).includes('common')).sort(byName),
  });
  return out;
}

function itemSections(list, data, classId, { kind }) {
  const { graph } = data;
  const out = [];
  const isBase = kind === 'base';
  const sortItems = (a, b) => itemLevel(a) - itemLevel(b) || byName(a, b);
  const sub = (it) => (isBase ? it.pob?.subType : data.baseSubType.get(it.baseEn)) || null;
  const used = new Set();
  const take = (items) => {
    items.forEach((i) => used.add(i.id));
    return items.sort(sortItems);
  };
  const classes = classId === 'all' ? [] : [graph.classById[classId]];
  for (const c of classes) {
    const cw = CLASS_WEAPONS[c.id];
    const defs = classDefences(c);
    const fits = (it) => {
      const s = sub(it);
      if (!s) return false;
      const parts = s.split('/');
      return parts.length < 3 && parts.every((p) => defs.includes(p));
    };
    out.push({ id: 'class-weapons', depth: 1, title: `Armes de la classe : ${c.name}`, hint: `famille « ${CLASS_CATEGORY[c.id]} »`, items: [] });
    for (const w of [...cw.weapons, ...cw.offhand]) {
      const items = take(list.filter((it) => it.itemClass === w && (w !== 'Shield' || fits(it) || !sub(it))));
      if (items.length) out.push({ id: `cw-${w}`, depth: 2, title: items[0].classFr ? plural(items[0].classFr, w) : w, items });
    }
    const defLabel = defs.map((d) => DEF_FR[d]).join(' / ');
    out.push({ id: 'class-armour', depth: 1, title: `Armures adaptées : ${defLabel}`, hint: `d'après les attributs principaux de la classe (${mainAttrs(c).map((a) => ({ str: 'Force', dex: 'Dextérité', int: 'Intelligence' })[a]).join(', ')})`, items: [] });
    // un sous-groupe par type de défense : pur d'abord, puis hybride (ex. Évasion, Bouclier d'énergie, Évasion / Bouclier d'énergie)
    const subOrder = [...defs.map((d) => d), defs.length > 1 ? defs.join('/') : null].filter(Boolean);
    for (const [slot, label] of ARMOUR_SLOTS) {
      for (const st of subOrder) {
        const items = take(list.filter((it) => it.itemClass === slot && fits(it) && normSub(sub(it)) === normSub(st)));
        if (items.length) out.push({ id: `ca-${slot}-${st}`, depth: 2, title: `${label} — ${defenceLabel(st)}`, items });
      }
    }
  }
  out.push({ id: 'common', depth: 1, common: true, title: classId === 'all' ? 'Tous les objets' : 'Objets communs à toutes les classes', items: [] });
  for (const [cls, label] of COMMON_GROUPS) {
    const items = take(list.filter((it) => it.itemClass === cls));
    if (items.length) out.push({ id: `cm-${cls}`, depth: 2, common: true, title: label, items });
  }
  const hybrid = take(list.filter((it) => !used.has(it.id) && ARMOUR_SLOTS.some(([s]) => s === it.itemClass) && (sub(it) || '').split('/').length === 3));
  if (hybrid.length) out.push({ id: 'cm-hybrid', depth: 2, common: true, title: 'Armures hybrides (Armure / Évasion / Bouclier d\'énergie)', items: hybrid });
  // tout le reste : autres armes et autres armures, par type
  const rest = list.filter((it) => !used.has(it.id));
  const byClass = new Map();
  for (const it of rest) {
    if (!byClass.has(it.itemClass)) byClass.set(it.itemClass, []);
    byClass.get(it.itemClass).push(it);
  }
  const ARM = new Set(['Helmet', 'Body Armour', 'Gloves', 'Boots', 'Shield', 'Buckler', 'Focus', 'Quiver']);
  const groups = [...byClass.entries()].sort((a, b) => (ARM.has(a[0]) - ARM.has(b[0])) || a[0].localeCompare(b[0]));
  if (groups.length) {
    out.push({ id: 'others', depth: 1, common: true, title: classId === 'all' ? 'Armes et armures' : 'Autres armes et armures', hint: classId === 'all' ? '' : 'utilisables par tous, mais plutôt faites pour d\'autres classes', items: [] });
    for (const [cls, items] of groups) {
      out.push({ id: `ot-${cls}`, depth: 2, common: true, title: plural(items[0].classFr || cls, cls), items: items.sort(sortItems) });
    }
  }
  return out;
}

export const uniqueSections = (data, classId) => itemSections(data.items.uniques, data, classId, { kind: 'unique' });
export const baseSections = (data, classId) => itemSections(data.items.bases, data, classId, { kind: 'base' });

const normSub = (s) => String(s || '').split('/').sort().join('/');

function plural(fr) {
  if (/s$|x$/.test(fr.split(' ')[0])) return fr;
  return fr
    .split(' ')
    .map((w, i) => (i === 0 ? (/au$/.test(w) ? `${w}x` : `${w}s`) : w))
    .join(' ');
}
function byName(a, b) {
  return a.name.localeCompare(b.name, 'fr');
}
function byTierName(a, b) {
  return (a.tier ?? 0) - (b.tier ?? 0) || byName(a, b);
}
