// Construit data/tree.json : arbre passif (positions PoB) + textes FR (poe2db) + textes EN (PoB).
import fs from 'node:fs';
import path from 'node:path';
import { POB_DIR, TREE_VERSION } from '../lib/paths.mjs';
import { fetchJson } from '../lib/http.mjs';
import { stripMarkup } from '../lib/html.mjs';

const POE2DB_TREE_URL = 'https://poe2db.tw/data/passive-skill-tree/4.5/data_fr.json?8';

const ATTR_FR = {
  Strength: { name: 'Force', stat: (n) => `+${n} de Force` },
  Dexterity: { name: 'Dextérité', stat: (n) => `+${n} de Dextérité` },
  Intelligence: { name: 'Intelligence', stat: (n) => `+${n} d'Intelligence` },
};

function cleanStatsFr(stats) {
  const out = [];
  for (const s of stats || []) {
    for (const line of String(s).split('\n')) {
      const l = stripMarkup(line).trim();
      if (!l || /no display|\[DNT/i.test(l)) continue;
      out.push(l);
    }
  }
  return out;
}

export async function buildTree() {
  const pob = JSON.parse(fs.readFileSync(path.join(POB_DIR, 'src', 'TreeData', TREE_VERSION, 'tree.json'), 'utf8'));
  let fr = null;
  try {
    fr = await fetchJson(POE2DB_TREE_URL, { referer: 'https://poe2db.tw/fr/passive-skill-tree/' });
  } catch (e) {
    console.warn(`  ! Arbre FR indisponible (${e.message}), les textes resteront en anglais`);
  }
  const frNodes = fr?.nodes || {};

  const { orbitRadii, skillsPerOrbit, orbitAnglesByOrbit } = pob.constants;

  // --- Classes & ascendances
  const frClassesByInt = {};
  const frAscByInternal = {};
  (fr?.classes || []).forEach((c, i) => {
    frClassesByInt[i] = c;
    for (const a of c.ascendancies || []) frAscByInternal[a.id] = a;
  });
  const ascNameToInternal = {};
  const classes = pob.classes.map((c) => {
    const frc = frClassesByInt[c.integerId];
    return {
      id: c.name,
      integerId: c.integerId,
      name: frc?.name || c.name,
      nameEn: c.name,
      base: { str: c.base_str, dex: c.base_dex, int: c.base_int },
      background: c.background ? { image: `asc/${c.background.image.replace(/^Classes/, '').replace(/[^A-Za-z0-9]+/g, '_')}.webp`, x: c.background.x, y: c.background.y, width: c.background.width, height: c.background.height } : null,
      ascendancies: c.ascendancies.map((a, idx) => {
        ascNameToInternal[a.id] = a.internalId;
        const fra = frAscByInternal[a.internalId];
        return {
          id: a.id,
          index: idx + 1,
          internalId: a.internalId,
          name: fra?.name || a.name,
          nameEn: a.name,
          flavour: fra?.flavourText && !/DNT|Lorem/.test(fra.flavourText) ? fra.flavourText : null,
          flavourEn: a.flavourText || null,
          background: a.background ? { image: `asc/${a.background.image.replace(/^Classes/, '').replace(/[^A-Za-z0-9]+/g, '_')}.webp`, x: a.background.x, y: a.background.y, width: a.background.width, height: a.background.height } : null,
        };
      }),
    };
  });

  // --- Groupes (index PoB 0-based => id de groupe = index + 1)
  const groups = {};
  pob.groups.forEach((g, i) => {
    if (g) groups[i + 1] = { x: g.x, y: g.y, orbits: g.orbits, nodes: g.nodes };
  });

  // --- Nœuds
  const nodes = {};
  for (const [id, n] of Object.entries(pob.nodes)) {
    const g = groups[n.group];
    if (!g) continue;
    const angle = orbitAnglesByOrbit[n.orbit][n.orbitIndex];
    const r = orbitRadii[n.orbit];
    const x = g.x + Math.sin(angle) * r;
    const y = g.y - Math.cos(angle) * r;
    const f = frNodes[id] || {};
    let type = 'normal';
    if (n.classesStart) type = 'classStart';
    else if (n.isAscendancyStart) type = 'ascendancyStart';
    else if (n.isOnlyImage) type = 'image';
    else if (n.isJewelSocket) type = 'jewel';
    else if (n.isKeystone) type = 'keystone';
    else if (n.isNotable) type = 'notable';
    const node = {
      id: Number(id),
      name: stripMarkup(f.name && !/DNT/.test(f.name) ? f.name : n.name),
      nameEn: n.name,
      type,
      stats: f.stats ? cleanStatsFr(f.stats) : n.stats || [],
      statsEn: n.stats || [],
      icon: n.icon,
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
      group: n.group,
      orbit: n.orbit,
      links: [],
    };
    if (n.ascendancyName) node.ascendancy = n.ascendancyName;
    if (n.classesStart) node.classesStart = n.classesStart;
    if (n.isAttribute) {
      node.isAttribute = true;
      node.options = (n.options || []).map((o) => {
        const m = String(o.stats?.[0] || '').match(/\+(\d+)/);
        const fr = ATTR_FR[o.name];
        return {
          id: o.id,
          attr: o.name,
          name: fr?.name || o.name,
          nameEn: o.name,
          stats: fr && m ? [fr.stat(m[1])] : o.stats,
          statsEn: o.stats,
          icon: o.icon,
        };
      });
    }
    if (n.isMultipleChoice) node.isMultipleChoice = true;
    if (n.isMultipleChoiceOption) node.isMultipleChoiceOption = true;
    if (n.isFreeAllocate) node.isFreeAllocate = true;
    if (n.nodeOverlay) node.overlay = n.nodeOverlay;
    if (n.unlockConstraint) node.unlockConstraint = n.unlockConstraint;
    const flav = Array.isArray(f.flavourText) ? f.flavourText.join('\n') : f.flavourText;
    if (flav && !/DNT|Lorem/.test(flav)) node.flavour = stripMarkup(flav);
    else if (n.flavourText) node.flavour = n.flavourText;
    if (n.flavourText) node.flavourEn = Array.isArray(n.flavourText) ? n.flavourText.join('\n') : n.flavourText;
    nodes[id] = node;
  }

  // --- Liens (graphe non orienté) et segments à dessiner
  const edges = [];
  const seen = new Set();
  for (const [id, n] of Object.entries(pob.nodes)) {
    const a = nodes[id];
    if (!a) continue;
    for (const c of n.connections || []) {
      const b = nodes[c.id];
      if (!b || b.id === a.id) continue;
      if (a.type === 'image' || b.type === 'image') continue;
      const key = a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;
      if (!a.links.includes(b.id)) a.links.push(b.id);
      if (!b.links.includes(a.id)) b.links.push(a.id);
      if (seen.has(key)) continue;
      seen.add(key);
      // pas de trait entre ascendances différentes ni depuis le départ de classe
      if ((a.ascendancy || null) !== (b.ascendancy || null)) continue;
      if (a.classesStart || b.classesStart) continue;
      edges.push(buildEdge(a, b, c.orbit, pob, groups));
    }
  }

  // départs d'ascendance
  for (const c of classes) {
    for (const a of c.ascendancies) {
      const start = Object.values(nodes).find((n) => n.type === 'ascendancyStart' && n.ascendancy === a.id);
      if (start) a.startNode = start.id;
    }
    const start = Object.values(nodes).find((n) => n.classesStart?.includes(c.id));
    if (start) c.startNode = start.id;
  }

  return {
    version: TREE_VERSION,
    bounds: { minX: pob.min_x, minY: pob.min_y, maxX: pob.max_x, maxY: pob.max_y },
    points: { passive: fr?.points?.totalPoints ?? 123, ascendancy: fr?.points?.ascendancyPoints ?? 8 },
    constants: { orbitRadii, skillsPerOrbit },
    nodeOverlay: pob.nodeOverlay,
    classes,
    groups,
    nodes,
    edges,
  };
}

function buildEdge(a, b, orbit, pob, groups) {
  const R = pob.constants.orbitRadii;
  const line = { a: a.id, b: b.id };
  let cx, cy, r;
  if (orbit && R[Math.abs(orbit)]) {
    r = R[Math.abs(orbit)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    if (dist >= r * 2 || dist === 0) return line;
    const perp = Math.sqrt(r * r - (dist * dist) / 4) * (orbit > 0 ? 1 : -1);
    cx = a.x + dx / 2 + perp * (dy / dist);
    cy = a.y + dy / 2 - perp * (dx / dist);
  } else if (a.group === b.group && a.orbit === b.orbit && a.orbit > 0) {
    const g = groups[a.group];
    cx = g.x;
    cy = g.y;
    r = R[a.orbit];
  } else {
    return line;
  }
  // arc le plus court entre les deux angles (repère canvas)
  let a1 = Math.atan2(a.y - cy, a.x - cx);
  let a2 = Math.atan2(b.y - cy, b.x - cx);
  let d = a2 - a1;
  while (d <= -Math.PI) d += 2 * Math.PI;
  while (d > Math.PI) d -= 2 * Math.PI;
  const round = (v) => Math.round(v * 1000) / 1000;
  line.arc = [round(cx), round(cy), r, round(a1), round(a1 + d)];
  return line;
}
