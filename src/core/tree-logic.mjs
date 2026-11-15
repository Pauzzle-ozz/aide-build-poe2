// Logique de l'arbre passif (partagée entre le navigateur et le serveur) :
// départs de classe, recherche de chemin, allocation / désallocation, points dépensés.

export class TreeGraph {
  constructor(tree) {
    this.tree = tree;
    this.nodes = tree.nodes;
    this.classes = tree.classes;
    this.classById = {};
    this.ascById = {};
    for (const c of tree.classes) {
      this.classById[c.id] = c;
      for (const a of c.ascendancies) this.ascById[a.id] = { ...a, classId: c.id };
    }
  }

  node(id) {
    return this.nodes[String(id)] || null;
  }

  /** Nœuds de départ (classe + ascendance) pour un build */
  startNodes(build) {
    const out = [];
    const c = this.classById[build.class];
    if (c?.startNode) out.push(c.startNode);
    const a = build.ascendancy && this.ascById[build.ascendancy];
    if (a?.startNode && a.classId === build.class) out.push(a.startNode);
    return out;
  }

  /** Le nœud peut-il être alloué par ce build ? */
  isAllocatable(node, build) {
    if (!node) return false;
    if (node.type === 'classStart' || node.type === 'ascendancyStart' || node.type === 'image') return false;
    if (node.ascendancy && node.ascendancy !== build.ascendancy) return false;
    return true;
  }

  /** Peut-on traverser de `from` vers `to` lors d'une recherche de chemin ? */
  canStep(from, to, build) {
    if (!to) return false;
    if (to.type === 'image') return false;
    // les départs (classe / ascendance) sont des sources, jamais des passages
    if (to.type === 'classStart' || to.type === 'ascendancyStart') return false;
    if (to.ascendancy && to.ascendancy !== build.ascendancy) return false;
    if (!from.ascendancy && to.ascendancy) return false;
    if (from.ascendancy && !to.ascendancy) return false;
    // une option de choix multiple n'est pas un passage
    if (from.isMultipleChoiceOption) return false;
    return true;
  }

  allocatedSet(build) {
    return new Set((build.tree?.nodes || []).map(Number));
  }

  /**
   * Chemin le plus court (liste d'ids à allouer, dans l'ordre) pour atteindre `targetId`
   * depuis l'arbre déjà alloué. Renvoie [] si déjà alloué, null si inaccessible.
   */
  findPath(build, targetId) {
    const target = this.node(targetId);
    if (!target || !this.isAllocatable(target, build)) return null;
    const alloc = this.allocatedSet(build);
    if (alloc.has(target.id)) return [];
    const sources = [...alloc, ...this.startNodes(build)];
    const prev = new Map();
    const queue = [];
    for (const s of sources) {
      prev.set(s, null);
      queue.push(s);
    }
    let head = 0;
    while (head < queue.length) {
      const id = queue[head++];
      const n = this.node(id);
      if (!n) continue;
      for (const nb of n.links) {
        if (prev.has(nb)) continue;
        const m = this.node(nb);
        if (!this.canStep(n, m, build)) continue;
        prev.set(nb, id);
        if (nb === target.id) {
          const path = [];
          let cur = nb;
          while (cur !== null && !alloc.has(cur) && !sources.includes(cur)) {
            path.unshift(cur);
            cur = prev.get(cur);
          }
          return path;
        }
        queue.push(nb);
      }
    }
    return null;
  }

  /** Distances (en points) depuis l'arbre alloué vers tous les nœuds accessibles */
  distances(build) {
    const alloc = this.allocatedSet(build);
    const dist = new Map();
    const queue = [];
    for (const s of [...alloc, ...this.startNodes(build)]) {
      dist.set(s, 0);
      queue.push(s);
    }
    let head = 0;
    while (head < queue.length) {
      const id = queue[head++];
      const n = this.node(id);
      if (!n) continue;
      for (const nb of n.links) {
        if (dist.has(nb)) continue;
        const m = this.node(nb);
        if (!this.canStep(n, m, build)) continue;
        dist.set(nb, dist.get(id) + 1);
        queue.push(nb);
      }
    }
    return dist;
  }

  /** Nœuds alloués encore reliés au départ (les autres sont « orphelins ») */
  connected(build, allocSet = this.allocatedSet(build)) {
    const ok = new Set();
    const queue = [...this.startNodes(build)];
    const visited = new Set(queue);
    let head = 0;
    while (head < queue.length) {
      const id = queue[head++];
      const n = this.node(id);
      if (!n) continue;
      for (const nb of n.links) {
        if (visited.has(nb) || !allocSet.has(nb)) continue;
        const m = this.node(nb);
        if (!this.isAllocatable(m, build)) continue;
        if (!n.ascendancy && m.ascendancy) continue;
        if (n.ascendancy && !m.ascendancy) continue;
        visited.add(nb);
        ok.add(nb);
        queue.push(nb);
      }
    }
    return ok;
  }

  /** Alloue `targetId` (et le chemin nécessaire). Retourne { added, removed } ou lève une erreur. */
  allocate(build, targetId) {
    const target = this.node(targetId);
    if (!target) throw new Error(`Nœud inconnu : ${targetId}`);
    if (!this.isAllocatable(target, build)) {
      if (target.ascendancy && target.ascendancy !== build.ascendancy) {
        throw new Error(`« ${target.name} » appartient à l'ascendance ${target.ascendancy}, pas à celle du build.`);
      }
      throw new Error(`« ${target.name} » ne peut pas être alloué.`);
    }
    const path = this.findPath(build, targetId);
    if (path === null) throw new Error(`Aucun chemin vers « ${target.name} » depuis l'arbre actuel.`);
    const removed = [];
    const nodes = new Set(this.allocatedSet(build));
    for (const id of path) {
      const n = this.node(id);
      // choix multiple : une seule option par nœud parent
      if (n.isMultipleChoiceOption) {
        for (const parentId of n.links) {
          const parent = this.node(parentId);
          if (!parent?.isMultipleChoice) continue;
          for (const sib of parent.links) {
            if (sib !== id && nodes.has(sib) && this.node(sib)?.isMultipleChoiceOption) {
              nodes.delete(sib);
              removed.push(sib);
            }
          }
        }
      }
      nodes.add(id);
    }
    build.tree.nodes = [...nodes];
    return { added: path, removed };
  }

  /** Retire un nœud et tout ce qui n'est plus relié au départ. */
  deallocate(build, targetId) {
    const id = Number(targetId);
    const alloc = this.allocatedSet(build);
    if (!alloc.has(id)) return { removed: [] };
    alloc.delete(id);
    const keep = this.connected(build, alloc);
    const removed = [id, ...[...alloc].filter((x) => !keep.has(x))];
    build.tree.nodes = [...keep];
    for (const r of removed) {
      if (build.tree.attributes) delete build.tree.attributes[r];
    }
    return { removed };
  }

  /** Nettoie le build (nœuds inconnus, déconnectés, ascendance invalide). */
  sanitize(build) {
    const c = this.classById[build.class];
    if (!c) build.class = this.classes[0].id;
    if (build.ascendancy && this.ascById[build.ascendancy]?.classId !== build.class) build.ascendancy = null;
    const alloc = new Set(this.allocatedSet(build));
    for (const id of [...alloc]) if (!this.isAllocatable(this.node(id), build)) alloc.delete(id);
    const keep = this.connected(build, alloc);
    const dropped = [...alloc].filter((x) => !keep.has(x));
    build.tree.nodes = [...keep];
    return { dropped };
  }

  pointsUsed(build) {
    let passive = 0;
    let ascendancy = 0;
    for (const id of build.tree?.nodes || []) {
      const n = this.node(id);
      if (!n) continue;
      if (n.isFreeAllocate) continue;
      if (n.ascendancy) {
        if (!n.isMultipleChoiceOption) ascendancy++;
      } else passive++;
    }
    return { passive, ascendancy };
  }

  /** Stats effectives d'un nœud (prend en compte le choix d'attribut). */
  nodeStats(node, build, lang = 'fr') {
    if (node.isAttribute && build?.tree?.attributes?.[node.id]) {
      const opt = node.options?.find((o) => o.attr === build.tree.attributes[node.id]);
      if (opt) return lang === 'fr' ? opt.stats : opt.statsEn;
    }
    return lang === 'fr' ? node.stats : node.statsEn;
  }

  nodeLabel(node, build, lang = 'fr') {
    if (node.isAttribute && build?.tree?.attributes?.[node.id]) {
      const opt = node.options?.find((o) => o.attr === build.tree.attributes[node.id]);
      if (opt) return lang === 'fr' ? opt.name : opt.nameEn;
    }
    return lang === 'fr' ? node.name : node.nameEn;
  }
}

// Niveau de zone des quêtes qui donnent « +2 Points de Talent d'Ensemble d'armes » (données PoB, QuestRewards.lua)
const WEAPON_SET_QUEST_LEVELS = [10, 12, 25, 28, 34, 44, 51, 51, 61, 62, 62, 64];

/** Points de Talent d'Ensemble d'armes (quêtes) probablement obtenus à un niveau donné, en suivant la campagne. */
export function questPointsForLevel(level) {
  return WEAPON_SET_QUEST_LEVELS.filter((l) => l <= (level || 1)).length * 2;
}

/** Points de passif disponibles à un niveau donné (1 par niveau + Points de Talent d'Ensemble d'armes des quêtes). */
export function passivePointsForLevel(level, questPoints = questPointsForLevel(level)) {
  return Math.max(0, Math.min(99, (level || 1) - 1)) + questPoints;
}
