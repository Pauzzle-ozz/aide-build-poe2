// Routes de recherche dans les données du jeu (passifs, gemmes, objets) et du glossaire officiel,
// utilisées par Claude (MCP). Partagées entre le serveur local (Express) et la version en ligne,
// où elles tournent dans le navigateur. Même format que src/core/build-routes.mjs.
import { norm, matchScore } from './text.mjs';
import { resolveNode, resolveGem, resolveClass } from './ops.mjs';
import { canSupport } from './gems-logic.mjs';

export function searchRoutes({ store, data, glossary }) {
  const query = (req) => req.query || {};
  return [
    // ---------- Glossaire officiel (mots soulignés dans l'interface)
    ['get', '/api/glossary', (req) => (query(req).q ? glossary.search(String(query(req).q), Number(query(req).limit) || 15) : { nombre: glossary.count, termes: glossary.titles() })],
    ['post', '/api/glossary/check', (req) => glossary.check(req.body?.text || '')],

    // ---------- Recherche
    ['get', '/api/search/passives', (req) => {
      const qs = query(req);
      const q = String(qs.q || '');
      const type = String(qs.type || 'any');
      const limit = Math.min(200, Number(qs.limit) || 25);
      const b = qs.build ? store.resolve(qs.build) : store.resolve(null);
      const dist = data.graph.distances(b);
      const alloc = new Set(b.tree.nodes);
      const res = [];
      for (const n of Object.values(data.graph.nodes)) {
        if (n.type === 'image' || n.type === 'classStart' || n.type === 'ascendancyStart') continue;
        if (type !== 'any' && n.type !== type) continue;
        if (qs.ascendancy === 'only' && !n.ascendancy) continue;
        if (qs.ascendancy === 'none' && n.ascendancy) continue;
        if (n.ascendancy && qs.ascendancy !== 'all' && n.ascendancy !== b.ascendancy && qs.ascendancy !== 'only') continue;
        const s = q ? matchScore(q, n.name, n.nameEn, n.stats.join(' '), n.statsEn.join(' ')) : 1;
        if (!s) continue;
        const bonus = n.type === 'keystone' ? 3 : n.type === 'notable' ? 2 : 0;
        res.push([s + bonus, n]);
      }
      res.sort((a, b2) => b2[0] - a[0] || (dist.get(a[1].id) ?? 999) - (dist.get(b2[1].id) ?? 999));
      return res.slice(0, limit).map(([, n]) => ({
        id: n.id, name: n.name, nameEn: n.nameEn, type: n.type, ascendancy: n.ascendancy || null,
        stats: n.stats, statsEn: n.statsEn,
        allocated: alloc.has(n.id),
        pointsToReach: alloc.has(n.id) ? 0 : dist.get(n.id) ?? null,
      }));
    }],
    ['get', '/api/passives/:ref', (req) => {
      const b = store.resolve(query(req).build || null);
      const n = resolveNode(data, b, req.params.ref);
      const path = data.graph.findPath(b, n.id);
      return {
        ...n,
        allocated: b.tree.nodes.includes(n.id),
        pathFromTree: path ? path.map((id) => ({ id, name: data.graph.node(id).name })) : null,
        neighbors: n.links.map((id) => ({ id, name: data.graph.node(id)?.name, type: data.graph.node(id)?.type })),
      };
    }],
    ['get', '/api/search/gems', (req) => {
      const qs = query(req);
      const q = String(qs.q || '');
      const kind = String(qs.kind || 'any');
      const limit = Math.min(200, Number(qs.limit) || 25);
      const tag = qs.tag ? norm(qs.tag) : null;
      let classId = null;
      if (qs.class) classId = /^(commune?s?|common)$/i.test(qs.class) ? 'common' : resolveClass(data, qs.class).cls.id;
      return data.gems
        .filter((g) => !classId || (g.classes || ['common']).includes(classId))
        .filter((g) => kind === 'any' || g.kind === kind || (kind === 'skill' && ['skill', 'spirit', 'meta'].includes(g.kind)) || (kind === 'support' && g.kind === 'lineage'))
        .filter((g) => !tag || g.tags.some((t) => norm(t) === tag) || g.tagsEn.some((t) => norm(t) === tag))
        .map((g) => [q ? matchScore(q, g.name, g.nameEn, g.tags.join(' '), g.tagsEn.join(' '), g.description || '', g.descriptionEn || '') : 1, g])
        .filter(([s]) => s > 0)
        .sort((a, b) => b[0] - a[0])
        .slice(0, limit)
        .map(([, g]) => ({ id: g.id, name: g.name, nameEn: g.nameEn, kind: g.kind, categorie: g.category, classes: g.classes, palier: g.tier, tags: g.tags, color: g.color, description: g.description || g.descriptionEn }));
    }],
    ['get', '/api/gems/:ref', (req) => resolveGem(data, decodeURIComponent(req.params.ref))],
    ['get', '/api/gems/:ref/supports', (req) => {
      const qs = query(req);
      const active = resolveGem(data, decodeURIComponent(req.params.ref));
      const q = String(qs.q || '');
      const maxTier = qs.maxTier !== undefined ? Number(qs.maxTier) : null;
      const list = data.gems
        .filter((g) => (g.kind === 'support' || g.kind === 'lineage') && canSupport(g, active))
        .filter((g) => maxTier === null || (g.tier ?? 0) <= maxTier)
        .map((g) => [q ? matchScore(q, g.name, g.nameEn, g.tags.join(' '), g.description || '', g.descriptionEn || '') : 1, g])
        .filter(([sc]) => sc > 0)
        .sort((a, b) => b[0] - a[0] || (a[1].tier ?? 0) - (b[1].tier ?? 0))
        .slice(0, Math.min(200, Number(qs.limit) || 60))
        .map(([, g]) => ({ id: g.id, name: g.name, nameEn: g.nameEn, kind: g.kind, tier: g.tier, color: g.color, description: g.description || g.descriptionEn }));
      return { aptitude: { id: active.id, name: active.name, nameEn: active.nameEn, types: active.skillTypes }, compatibles: list };
    }],
    ['get', '/api/search/items', (req) => {
      const qs = query(req);
      const q = String(qs.q || '');
      const kind = String(qs.kind || 'unique');
      const slot = qs.slot ? String(qs.slot) : null;
      const cls = qs.class ? norm(qs.class) : null;
      const limit = Math.min(200, Number(qs.limit) || 25);
      const list = kind === 'base' ? data.items.bases : data.items.uniques;
      return list
        .filter((it) => !slot || it.slots.includes(slot) || (slot.startsWith('Ring') && it.itemClass === 'Ring') || (slot.startsWith('Charm') && it.itemClass === 'Charm'))
        .filter((it) => !cls || norm(it.itemClass) === cls || norm(it.classFr) === cls)
        .map((it) => [q ? matchScore(q, it.name, it.nameEn, it.base || '', it.classFr, ...(it.explicits || []), ...(it.implicits || [])) : 1, it])
        .filter(([s]) => s > 0)
        .sort((a, b) => b[0] - a[0])
        .slice(0, limit)
        .map(([, it]) => it);
    }],
  ];
}
