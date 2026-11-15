// Langue des textes du jeu (bouton FR / EN de la barre du haut).
// Les données sont chargées une fois ; en anglais on fabrique une « vue » où les champs anglais officiels
// prennent la place des champs français (et inversement), si bien que tous les panneaux suivent sans changement.
// L'interface de l'outil (menus, boutons, aide) reste en français.
import { createContext, useContext } from 'react';
import { TreeGraph } from '@core/tree-logic.mjs';

const KEY = 'aide-poe2-langue';
export const readLang = () => {
  try {
    return localStorage.getItem(KEY) === 'en' ? 'en' : 'fr';
  } catch {
    return 'fr';
  }
};
export const saveLang = (l) => {
  try {
    localStorage.setItem(KEY, l);
  } catch {}
};

// Libellés « du jeu » dans les infobulles (le reste de l'outil reste en français)
const LABELS = {
  fr: { otherName: 'Nom anglais', other: 'Anglais', req: 'Prérequis', quality: 'Qualité', corrupted: 'Corrompu' },
  en: { otherName: 'Nom français', other: 'Français', req: 'Requires', quality: 'Quality', corrupted: 'Corrupted' },
};

export const LangCtx = createContext({ lang: 'fr', setLang: () => {}, view: null, L: LABELS.fr });
export const useLang = () => useContext(LangCtx);
export const labelsFor = (lang) => LABELS[lang] || LABELS.fr;

/** Échange les champs FR / EN d'un objet (seulement quand la valeur anglaise existe) */
function swap(o, pairs) {
  const r = { ...o };
  for (const [fr, en] of pairs) {
    const v = o[en];
    if (v == null || (Array.isArray(v) && !v.length && o[fr]?.length)) continue;
    r[fr] = v;
    r[en] = o[fr];
  }
  return r;
}

const NAME = [['name', 'nameEn']];
const NODE = [['name', 'nameEn'], ['stats', 'statsEn']];

/** Vue anglaise des données du jeu */
export function englishView(data) {
  const t = data.tree;
  const nodes = {};
  for (const [id, n] of Object.entries(t.nodes)) {
    const r = swap(n, NODE);
    r.flavour = n.flavourEn || null;
    r.unofficial = false;
    if (n.options) r.options = n.options.map((o) => swap(o, NODE));
    nodes[id] = r;
  }
  const classes = t.classes.map((c) => ({
    ...swap(c, NAME),
    ascendancies: c.ascendancies.map((a) => ({ ...swap(a, NAME), flavour: a.flavourEn || null })),
  }));
  const tree = { ...t, nodes, classes };

  const gems = data.gems.map((g) => ({
    ...swap(g, [['name', 'nameEn'], ['tags', 'tagsEn'], ['description', 'descriptionEn'], ['tooltipHtml', 'tooltipHtmlEn']]),
    unofficial: false,
  }));

  const ITEM = [['name', 'nameEn'], ['properties', 'propertiesEn'], ['requirements', 'requirementsEn'], ['implicits', 'implicitsEn']];
  const bases = data.items.bases.map((b) => ({ ...swap(b, ITEM), classFr: b.itemClass }));
  const uniques = data.items.uniques.map((u) => ({
    ...swap(u, [...ITEM, ['base', 'baseEn'], ['explicits', 'explicitsEn']]),
    classFr: u.itemClass,
    unofficial: false,
    unofficialName: false,
  }));

  const g = data.glossary || { entries: {} };
  const entries = {};
  for (const [k, e] of Object.entries(g.entries || {})) entries[k] = e.tEn ? { t: e.tEn, d: e.dEn || e.d, tEn: e.t, dEn: e.d } : e;

  return {
    ...data,
    tree,
    graph: new TreeGraph(tree),
    gems,
    gemsById: new Map(gems.map((x) => [x.id, x])),
    items: { ...data.items, bases, uniques },
    glossary: { ...g, entries },
  };
}

/** Index des uniques / bases d'une vue (pour retrouver les textes d'un objet équipé) */
export function itemIndex(view) {
  if (!view.__itemIndex) {
    view.__itemIndex = {
      uniques: new Map(view.items.uniques.map((u) => [u.id, u])),
      bases: new Map(view.items.bases.map((b) => [b.id, b])),
    };
  }
  return view.__itemIndex;
}

/** Objet équipé dans un build -> textes anglais officiels quand on les a */
export function englishItem(item, view) {
  if (!item || !view) return item;
  const idx = itemIndex(view);
  if (item.uniqueId) {
    const u = idx.uniques.get(item.uniqueId);
    if (u) {
      return {
        ...item,
        name: u.name,
        nameEn: u.nameEn,
        base: u.base,
        baseEn: u.baseEn,
        properties: u.properties?.length ? u.properties : item.properties,
        requirements: u.requirements,
        implicitsFr: u.implicits,
        explicitsFr: u.explicits,
        classFr: u.classFr,
      };
    }
  }
  const b = item.baseId ? idx.bases.get(item.baseId) : null;
  const same = (en, fr) => en?.length && (!fr?.length || en.length === fr.length);
  const isBaseName = item.name === item.base;
  return {
    ...item,
    name: isBaseName ? item.baseEn || b?.name || item.name : item.name,
    nameEn: item.name,
    base: item.baseEn || b?.name || item.base,
    properties: b?.properties?.length ? b.properties : item.properties,
    requirements: b?.requirements?.length ? b.requirements : item.requirements,
    implicitsFr: same(item.implicits, item.implicitsFr) ? item.implicits : b?.implicits?.length ? b.implicits : item.implicitsFr,
    explicitsFr: same(item.explicits, item.explicitsFr) ? item.explicits : item.explicitsFr,
    classFr: b?.classFr || item.classFr,
  };
}
