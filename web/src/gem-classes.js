// Classement des gemmes par classe, d'après les catégories officielles du jeu
// (interface de taille des gemmes : une famille d'aptitudes par classe de départ).

export const CLASS_CATEGORY = {
  Warrior: 'Masse',
  Monk: 'Bâton de combat',
  Ranger: 'Arc',
  Mercenary: 'Arbalète',
  Huntress: 'Lance',
  Sorceress: 'Élémentaire',
  Witch: 'Occulte',
  Druid: 'Primitif',
};

const COLOR_ATTR = { str: 'Force', dex: 'Dextérité', int: 'Intelligence' };

/** Attributs principaux d'une classe (ceux au-dessus du minimum de base) */
function mainAttrs(cls) {
  const b = cls.base;
  const min = Math.min(b.str, b.dex, b.int);
  return ['str', 'dex', 'int'].filter((k) => b[k] > min);
}

export function classFilters(graph) {
  return [
    { id: 'all', label: 'Toutes les classes' },
    ...graph.classes.map((c) => ({ id: c.id, label: `${c.name} — ${CLASS_CATEGORY[c.id] || ''}` })),
    { id: 'common', label: 'Communes à toutes les classes' },
  ];
}

export function gemMatchesClass(gem, classId) {
  if (!classId || classId === 'all') return true;
  const cl = gem.classes || ['common'];
  return classId === 'common' ? cl.includes('common') : cl.includes(classId);
}

/** Libellé lisible : « Moine — Bâton de combat », « Soutien commun… », « Ascendance : Évocateur (Moine) » */
export function gemClassLabel(gem, graph) {
  const cl = gem.classes || ['common'];
  if (gem.kind === 'support' || gem.kind === 'lineage') {
    const color = COLOR_ATTR[gem.color];
    const aff = graph.classes.filter((c) => mainAttrs(c).includes(gem.color)).map((c) => c.name);
    return `${gem.kind === 'lineage' ? 'Soutien de lignage' : 'Soutien'} commun à toutes les classes${color ? ` · couleur ${color}${aff.length ? ` (affinité : ${aff.join(', ')})` : ''}` : ''}`;
  }
  if (gem.grantedBy) {
    const asc = graph.ascById[gem.grantedBy];
    return `${gem.category} (${graph.classById[cl[0]]?.name || ''}) — conférée par l'ascendance`;
  }
  if (cl[0] !== 'common') {
    const c = graph.classById[cl[0]];
    return `Famille « ${gem.category} » — classe associée : ${c?.name}${gem.officialCategory ? '' : ' (selon l\'arme requise)'}`;
  }
  if (gem.category === 'Conférée par un objet') return 'Aptitude conférée par un objet (toutes classes)';
  return 'Commune à toutes les classes';
}

/** Ordre d'affichage : classe du build d'abord */
export function classRank(gem, classId) {
  const cl = gem.classes || ['common'];
  if (classId && cl.includes(classId)) return 0;
  if (cl.includes('common')) return 1;
  return 2;
}
