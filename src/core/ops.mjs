// Opérations de modification d'un build (utilisées par l'interface ET par Claude via MCP,
// sur le serveur local comme dans le navigateur pour la version en ligne).
// Chaque opération accepte des noms FR ou EN (ou des identifiants).
import { SLOT_IDS, SLOT_LABEL, newId } from './build-model.mjs';
import { translateLines } from './items-text.mjs';
import { checkSkills } from './gems-logic.mjs';
import { norm, matchScore } from './text.mjs';
import { itemFromText } from './pob.mjs';

const ATTR_ALIASES = {
  strength: 'Strength', force: 'Strength', str: 'Strength', for: 'Strength',
  dexterity: 'Dexterity', dexterite: 'Dexterity', dex: 'Dexterity',
  intelligence: 'Intelligence', int: 'Intelligence',
};

const SLOT_ALIASES = {
  arme: 'Weapon 1', 'arme principale': 'Weapon 1', 'main principale': 'Weapon 1', weapon: 'Weapon 1',
  'main secondaire': 'Weapon 2', bouclier: 'Weapon 2', offhand: 'Weapon 2', 'arme secondaire': 'Weapon 2', carquois: 'Weapon 2', focaliseur: 'Weapon 2',
  casque: 'Helmet', helmet: 'Helmet', 'armure de torse': 'Body Armour', torse: 'Body Armour', armure: 'Body Armour', body: 'Body Armour',
  gants: 'Gloves', gloves: 'Gloves', bottes: 'Boots', boots: 'Boots', amulette: 'Amulet', amulet: 'Amulet',
  'anneau gauche': 'Ring 1', anneau: 'Ring 1', bague: 'Ring 1', 'bague gauche': 'Ring 1', 'bague 1': 'Ring 1', 'bague droite': 'Ring 2', 'bague 2': 'Ring 2', 'anneau 1': 'Ring 1', ring: 'Ring 1', 'anneau droit': 'Ring 2', 'anneau 2': 'Ring 2',
  ceinture: 'Belt', belt: 'Belt', 'flacon de vie': 'Flask 1', 'flacon 1': 'Flask 1', 'flacon de mana': 'Flask 2', 'flacon 2': 'Flask 2',
  'charme 1': 'Charm 1', charme: 'Charm 1', 'charme 2': 'Charm 2', 'charme 3': 'Charm 3',
};

export function resolveSlot(slot) {
  if (!slot) throw new Error('Emplacement manquant');
  if (SLOT_IDS.includes(slot)) return slot;
  const n = norm(slot);
  const hit = SLOT_IDS.find((s) => norm(s) === n) || SLOT_ALIASES[n] || SLOT_IDS.find((s) => norm(SLOT_LABEL[s]) === n);
  if (!hit) throw new Error(`Emplacement inconnu « ${slot} ». Valides : ${SLOT_IDS.map((s) => `${s} (${SLOT_LABEL[s]})`).join(', ')}`);
  return hit;
}

export function resolveClass(data, ref) {
  const n = norm(ref);
  for (const c of data.graph.classes) {
    if (norm(c.id) === n || norm(c.name) === n || norm(c.nameEn) === n) return { cls: c, asc: null };
    for (const a of c.ascendancies) {
      if (norm(a.id) === n || norm(a.name) === n || norm(a.nameEn) === n) return { cls: c, asc: a };
    }
  }
  throw new Error(`Classe ou ascendance inconnue : ${ref}. Classes : ${data.graph.classes.map((c) => `${c.name} (${c.nameEn})`).join(', ')}`);
}

/** Trouve un nœud de l'arbre par id ou par nom (FR/EN), en privilégiant le plus proche du build */
export function resolveNode(data, build, ref) {
  const { graph } = data;
  if (typeof ref === 'number' || /^\d+$/.test(String(ref).trim())) {
    const n = graph.node(Number(ref));
    if (!n) throw new Error(`Nœud inconnu : ${ref}`);
    return n;
  }
  const key = norm(ref);
  let cands = (data.nodesByName.get(key) || []).filter((n) => graph.isAllocatable(n, build));
  if (!cands.length) {
    const all = Object.values(graph.nodes).filter((n) => graph.isAllocatable(n, build) && n.type !== 'normal');
    const scored = all.map((n) => [matchScore(ref, n.name, n.nameEn), n]).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]);
    if (!scored.length) throw new Error(`Aucun passif nommé « ${ref} » (cherchez avec rechercher_passifs).`);
    const best = scored[0][0];
    cands = scored.filter(([s]) => s === best).map(([, n]) => n);
    const names = new Set(cands.map((n) => n.name));
    if (names.size > 1) {
      throw new Error(`« ${ref} » est ambigu : ${[...names].slice(0, 10).join(', ')}. Précisez le nom exact ou l'identifiant.`);
    }
  }
  if (cands.length === 1) return cands[0];
  const dist = graph.distances(build);
  cands.sort((a, b) => (dist.get(a.id) ?? 1e9) - (dist.get(b.id) ?? 1e9));
  return cands[0];
}

export function resolveGem(data, ref) {
  if (data.gemsById.has(ref)) return data.gemsById.get(ref);
  const g = data.gemsByName.get(norm(ref));
  if (g) return g;
  const scored = data.gems.map((x) => [matchScore(ref, x.name, x.nameEn), x]).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]);
  if (!scored.length) throw new Error(`Gemme inconnue : ${ref}`);
  return scored[0][1];
}

function nodeInfo(graph, build, id) {
  const n = graph.node(id);
  return n ? { id: n.id, name: graph.nodeLabel(n, build), type: n.type } : { id };
}

export function applyOp(data, build, op) {
  const { graph } = data;
  const result = {};
  switch (op.op) {
    case 'rename':
      build.name = String(op.name || build.name).slice(0, 120);
      break;
    case 'setLevel':
      build.level = Math.max(1, Math.min(100, Number(op.level) || 1));
      break;
    case 'setClass': {
      const { cls, asc } = resolveClass(data, op.class);
      build.class = cls.id;
      if (asc) build.ascendancy = asc.id;
      else if (op.ascendancy !== undefined) build.ascendancy = null;
      if (op.ascendancy) {
        const r = resolveClass(data, op.ascendancy);
        if (r.cls.id !== cls.id || !r.asc) throw new Error(`L'ascendance ${op.ascendancy} n'appartient pas à ${cls.name}.`);
        build.ascendancy = r.asc.id;
      } else if (!asc && build.ascendancy && graph.ascById[build.ascendancy]?.classId !== cls.id) {
        build.ascendancy = null;
      }
      result.dropped = graph.sanitize(build).dropped.length;
      break;
    }
    case 'setAscendancy': {
      if (!op.ascendancy) build.ascendancy = null;
      else {
        const { cls, asc } = resolveClass(data, op.ascendancy);
        if (!asc) throw new Error(`${op.ascendancy} n'est pas une ascendance.`);
        build.class = cls.id;
        build.ascendancy = asc.id;
      }
      result.dropped = graph.sanitize(build).dropped.length;
      break;
    }
    case 'allocate': {
      const refs = Array.isArray(op.nodes) ? op.nodes : [op.node ?? op.nodes];
      result.added = [];
      result.errors = [];
      for (const ref of refs) {
        try {
          const n = resolveNode(data, build, ref);
          const r = graph.allocate(build, n.id);
          result.added.push({ target: nodeInfo(graph, build, n.id), path: r.added.map((id) => nodeInfo(graph, build, id)) });
          if (n.isAttribute && op.attribute) build.tree.attributes[n.id] = ATTR_ALIASES[norm(op.attribute)] || op.attribute;
        } catch (e) {
          result.errors.push(String(e.message));
        }
      }
      if (!result.added.length && result.errors.length) throw new Error(result.errors.join(' | '));
      break;
    }
    case 'deallocate': {
      const refs = Array.isArray(op.nodes) ? op.nodes : [op.node ?? op.nodes];
      result.removed = [];
      for (const ref of refs) {
        const id = /^\d+$/.test(String(ref)) ? Number(ref) : resolveAllocatedByName(data, build, ref);
        const r = graph.deallocate(build, id);
        result.removed.push(...r.removed.map((x) => nodeInfo(graph, build, x)));
      }
      break;
    }
    case 'resetTree':
      build.tree.nodes = [];
      build.tree.attributes = {};
      build.tree.weaponSet1 = [];
      build.tree.weaponSet2 = [];
      break;
    case 'setAttribute': {
      const n = /^\d+$/.test(String(op.node)) ? graph.node(Number(op.node)) : null;
      if (!n?.isAttribute) throw new Error(`Le nœud ${op.node} n'est pas un nœud d'attribut.`);
      const attr = ATTR_ALIASES[norm(op.attribute)];
      if (!attr) throw new Error('Attribut attendu : Force, Dextérité ou Intelligence');
      build.tree.attributes[n.id] = attr;
      break;
    }
    case 'setAllAttributes': {
      const attr = ATTR_ALIASES[norm(op.attribute)];
      if (!attr) throw new Error('Attribut attendu : Force, Dextérité ou Intelligence');
      let count = 0;
      for (const id of build.tree.nodes) {
        const n = graph.node(id);
        if (n?.isAttribute && (op.overwrite || !build.tree.attributes[id])) {
          build.tree.attributes[id] = attr;
          count++;
        }
      }
      result.count = count;
      break;
    }
    case 'addSkill': {
      const refs = op.gems || [];
      if (!refs.length) throw new Error('Indiquez au moins une gemme.');
      const gems = refs.map((r) => {
        const ref = typeof r === 'string' ? { name: r } : r;
        const gd = resolveGem(data, ref.gemId || ref.name);
        return { gemId: gd.id, level: ref.level ?? op.level ?? gd.maxLevel ?? 20, quality: ref.quality ?? 0, enabled: true };
      });
      const group = { id: newId(), label: op.label || '', enabled: true, gems };
      build.skills.push(group);
      result.skill = group;
      result.gems = gems.map((g) => data.gemsById.get(g.gemId)?.name);
      result.warnings = checkSkills(build, data.gemsById).filter((w) => w.skill === build.skills.length - 1 || w.duplicate).map((w) => w.text);
      break;
    }
    case 'updateSkill': {
      const s = build.skills.find((x) => x.id === op.skillId) || build.skills[Number(op.index)];
      if (!s) throw new Error(`Groupe de gemmes introuvable : ${op.skillId ?? op.index}`);
      if (op.label !== undefined) s.label = op.label;
      if (op.enabled !== undefined) s.enabled = !!op.enabled;
      if (op.gems) {
        s.gems = op.gems.map((r) => {
          const ref = typeof r === 'string' ? { name: r } : r;
          const gd = resolveGem(data, ref.gemId || ref.name);
          return { gemId: gd.id, level: ref.level ?? gd.maxLevel ?? 20, quality: ref.quality ?? 0, enabled: ref.enabled !== false };
        });
      }
      result.skill = s;
      result.warnings = checkSkills(build, data.gemsById).map((w) => w.text);
      break;
    }
    case 'moveSkill': {
      const i = build.skills.findIndex((x) => x.id === op.skillId);
      const j = Math.max(0, Math.min(build.skills.length - 1, i + (op.delta || 0)));
      if (i >= 0) build.skills.splice(j, 0, build.skills.splice(i, 1)[0]);
      break;
    }
    case 'removeSkill': {
      const before = build.skills.length;
      build.skills = build.skills.filter((x, i) => x.id !== op.skillId && String(i) !== String(op.index));
      if (build.skills.length === before) throw new Error('Groupe de gemmes introuvable');
      break;
    }
    case 'equip': {
      const slot = resolveSlot(op.slot);
      build.items[slot] = makeItem(data, op);
      result.item = build.items[slot];
      result.slot = slot;
      break;
    }
    case 'unequip': {
      const slot = resolveSlot(op.slot);
      delete build.items[slot];
      result.slot = slot;
      break;
    }
    case 'setNotes':
      build.notes = op.append ? `${build.notes || ''}${build.notes ? '\n\n' : ''}${op.notes}` : String(op.notes ?? '');
      break;
    default:
      throw new Error(`Opération inconnue : ${op.op}`);
  }
  return result;
}

function resolveAllocatedByName(data, build, ref) {
  const key = norm(ref);
  const hit = build.tree.nodes.map((id) => data.graph.node(id)).find((n) => n && (norm(n.name) === key || norm(n.nameEn) === key));
  if (!hit) throw new Error(`Aucun passif alloué nommé « ${ref} »`);
  return hit.id;
}

/** Crée un objet à partir d'un unique, d'une base + mods, ou d'un texte d'objet */
export function makeItem(data, op) {
  if (op.text) return itemFromText(op.text, data);
  if (op.unique) {
    const u = data.uniquesById.get(op.unique) || data.uniquesByName.get(norm(op.unique)) || bestUnique(data, op.unique);
    return {
      rarity: 'UNIQUE',
      uniqueId: u.id,
      name: u.name,
      nameEn: u.nameEn,
      base: u.base,
      baseEn: u.baseEn,
      iconUrl: u.iconUrl,
      implicitsFr: u.implicits,
      explicitsFr: u.explicits,
      implicits: [],
      explicits: [],
      requirements: u.requirements,
    };
  }
  const base = op.base ? data.basesById.get(op.base) || data.basesByName.get(norm(op.base)) || bestBase(data, op.base) : null;
  if (!base && !op.name) throw new Error('Indiquez un unique, une base ou un texte d\'objet.');
  const mods = op.mods || op.explicits || [];
  const implicits = op.implicits || [];
  const rarity = String(op.rarity || (mods.length > 2 ? 'RARE' : mods.length ? 'MAGIC' : 'NORMAL')).toUpperCase();
  const looksEn = (l) => /\b(increased|to|maximum|damage|reduced|adds|chance|more|per)\b/i.test(l);
  const fr = (lines) => lines.map((l) => (looksEn(l) ? translateLines([l], data.translations)[0] : l));
  return {
    rarity,
    name: op.name || base?.name || 'Objet',
    nameEn: op.nameEn || op.name || base?.nameEn,
    base: base?.name || op.base || '',
    baseEn: base?.nameEn || op.base || '',
    baseId: base?.id,
    iconUrl: base?.iconUrl,
    properties: base?.properties,
    implicitsFr: fr(implicits.length ? implicits : base?.implicits || []),
    implicits: implicits.filter(looksEn),
    explicitsFr: fr(mods),
    explicits: mods.filter(looksEn),
  };
}

function bestUnique(data, q) {
  const s = data.items.uniques.map((u) => [matchScore(q, u.name, u.nameEn), u]).filter(([x]) => x > 0).sort((a, b) => b[0] - a[0]);
  if (!s.length) throw new Error(`Unique inconnu : ${q}`);
  return s[0][1];
}

function bestBase(data, q) {
  const s = data.items.bases.map((u) => [matchScore(q, u.name, u.nameEn), u]).filter(([x]) => x > 0).sort((a, b) => b[0] - a[0]);
  if (!s.length) throw new Error(`Objet de base inconnu : ${q}`);
  return s[0][1];
}
