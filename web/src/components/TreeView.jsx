import { useEffect, useRef, useState } from 'react';
import { PassiveTooltip } from './Tooltips.jsx';
import { useHoverCard } from './HoverCard.jsx';

// Taille des sprites dans le repère de l'arbre (PoB dessine 2 × la taille de texture)
const NODE_SCALE = 0.62;
const MIN_S = 0.012;
const MAX_S = 1.4;
const CELL = 600;

const TYPE_OVERLAY = { normal: 'Normal', notable: 'Notable', keystone: 'Keystone', jewel: 'Socket' };

function loadImage(src) {
  const im = new Image();
  im.decoding = 'async';
  im.src = src;
  return im;
}

export default function TreeView({ tree, graph, sprites, build, onAllocate, onDeallocate, onSetAttribute, focusCmd, search, highlight, onHoverNode }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const view = useRef({ s: 0.08, ox: 0, oy: 0, init: false });
  const imgs = useRef({ atlases: [], asc: {} });
  const dirty = useRef(true);
  const anim = useRef(null);
  const drag = useRef(null);
  const state = useRef({});
  const [hover, setHover] = useState(null);
  const hc = useHoverCard(); // infobulle du passif survolé (bloquable d'un clic)
  const [attrPick, setAttrPick] = useState(null);
  const [cursor, setCursor] = useState('');

  // --- Images (atlas + fonds)
  useEffect(() => {
    imgs.current.atlases = sprites.atlases.map((a) => {
      const im = loadImage(`/assets/${a}`);
      im.onload = () => (dirty.current = true);
      return im;
    });
  }, [sprites]);
  const ascImg = (rel) => {
    if (!rel) return null;
    let im = imgs.current.asc[rel];
    if (!im) {
      im = imgs.current.asc[rel] = loadImage(`/assets/${rel}`);
      im.onload = () => (dirty.current = true);
    }
    return im.complete && im.naturalWidth ? im : null;
  };

  // --- Index spatial + nœuds visibles pour la classe courante
  const cls = graph.classById[build.class];
  const classAsc = new Set(cls?.ascendancies.map((a) => a.id) || []);
  const visKey = `${build.class}`;
  const vis = useRef({ key: null, nodes: [], grid: new Map(), edges: [] });
  if (vis.current.key !== visKey || vis.current.tree !== tree) {
    const nodes = [];
    const grid = new Map();
    for (const n of Object.values(tree.nodes)) {
      if (n.type === 'image') continue;
      if (n.ascendancy && !classAsc.has(n.ascendancy)) continue;
      if (n.type === 'classStart') continue;
      if (!n.links.length) continue; // emplacements « fantômes » non reliés
      nodes.push(n);
      const k = `${Math.floor(n.x / CELL)},${Math.floor(n.y / CELL)}`;
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(n);
    }
    const edges = tree.edges.filter((e) => {
      const a = tree.nodes[e.a];
      const b = tree.nodes[e.b];
      return a && b && (!a.ascendancy || classAsc.has(a.ascendancy)) && (!b.ascendancy || classAsc.has(b.ascendancy));
    });
    vis.current = { key: visKey, tree, nodes, grid, edges };
  }

  // --- État partagé avec la boucle de rendu
  const alloc = new Set(build.tree.nodes);
  const searchSet = new Set();
  if (search && search.trim().length >= 2) {
    const q = search.trim().toLowerCase();
    for (const n of vis.current.nodes) {
      if (n.name.toLowerCase().includes(q) || n.nameEn.toLowerCase().includes(q) || n.stats.some((s) => s.toLowerCase().includes(q))) searchSet.add(n.id);
    }
  }
  const hoverPath = hover && !alloc.has(hover.node.id) ? graph.findPath(build, hover.node.id) : null;
  state.current = { alloc, searchSet, hoverPath: new Set(hoverPath || []), hoverId: hover?.node.id, highlight, build, cls };
  useEffect(() => {
    dirty.current = true;
  });

  // --- Commandes de focus (Claude / bibliothèque)
  useEffect(() => {
    if (!focusCmd) return;
    const c = canvasRef.current;
    if (!c) return;
    const W = c.clientWidth;
    const H = c.clientHeight;
    let target = null;
    if (focusCmd.node) target = tree.nodes[focusCmd.node];
    else if (focusCmd.highlight?.length) target = tree.nodes[focusCmd.highlight[focusCmd.highlight.length - 1]];
    if (!target) return;
    const s1 = focusCmd.zoom ?? Math.max(view.current.s, 0.22);
    const from = { ...view.current };
    const to = { s: s1, ox: W / 2 - target.x * s1, oy: H / 2 - target.y * s1 };
    const t0 = performance.now();
    anim.current = (now) => {
      const t = Math.min(1, (now - t0) / 650);
      const e = 1 - Math.pow(1 - t, 3);
      view.current.s = from.s + (to.s - from.s) * e;
      view.current.ox = from.ox + (to.ox - from.ox) * e;
      view.current.oy = from.oy + (to.oy - from.oy) * e;
      if (t >= 1) anim.current = null;
      dirty.current = true;
    };
  }, [focusCmd, tree]);

  // --- Centre sur le départ de classe au premier affichage / changement de classe
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const start = cls && tree.nodes[cls.startNode];
    const W = c.clientWidth || 1200;
    const H = c.clientHeight || 800;
    const s = Math.min(W, H) / 7000;
    const x = start ? start.x * 0.6 : 0;
    const y = start ? start.y * 0.6 : 0;
    view.current = { s, ox: W / 2 - x * s, oy: H / 2 - y * s, init: true };
    dirty.current = true;
  }, [build.class, cls, tree]);

  // --- Boucle de rendu
  useEffect(() => {
    let raf;
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      if (anim.current) anim.current(now);
      const hl = state.current.highlight;
      if (hl && hl.until > Date.now()) dirty.current = true;
      if (!dirty.current) return;
      dirty.current = false;
      draw(now);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  function sprite(key) {
    const sp = sprites.items[key];
    if (!sp) return null;
    const im = imgs.current.atlases[sp[0]];
    if (!im || !im.complete || !im.naturalWidth) return null;
    return [im, sp[1], sp[2], sp[3], sp[4]];
  }

  function drawSprite(ctx, key, x, y, scale = NODE_SCALE) {
    const sp = sprite(key);
    if (!sp) return false;
    const [im, sx, sy, sw, sh] = sp;
    const w = sw * 2 * scale;
    const h = sh * 2 * scale;
    ctx.drawImage(im, sx, sy, sw, sh, x - w / 2, y - h / 2, w, h);
    return true;
  }

  function draw(now) {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const W = c.clientWidth;
    const H = c.clientHeight;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    const ctx = c.getContext('2d');
    const { s, ox, oy } = view.current;
    const st = state.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#050506';
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
    const x0 = -ox / s - 400;
    const y0 = -oy / s - 400;
    const x1 = (W - ox) / s + 400;
    const y1 = (H - oy) / s + 400;
    const inView = (x, y, r = 0) => x + r > x0 && x - r < x1 && y + r > y0 && y - r < y1;
    const px = 1 / s; // 1 pixel écran en unités monde

    // Fonds
    const bg = ascImg('asc/BGTree.webp');
    if (bg) {
      ctx.globalAlpha = 0.55;
      ctx.drawImage(bg, -4000, -4000, 8000, 8000);
      ctx.globalAlpha = 1;
    }
    const cbg = st.cls?.background && ascImg(st.cls.background.image);
    if (cbg) ctx.drawImage(cbg, -1500, -1500, 3000, 3000);
    for (const a of st.cls?.ascendancies || []) {
      if (!a.background) continue;
      const { x, y } = a.background;
      if (!inView(x, y, 1600)) continue;
      const im = ascImg(a.background.image);
      if (!im) continue;
      ctx.globalAlpha = st.build.ascendancy === a.id ? 1 : 0.35;
      ctx.drawImage(im, x - 1500, y - 1500, 3000, 3000);
      ctx.globalAlpha = 1;
    }

    // Liens
    ctx.lineCap = 'round';
    const batches = { normal: [], path: [], active: [] };
    for (const e of vis.current.edges) {
      const a = tree.nodes[e.a];
      const b = tree.nodes[e.b];
      if (!inView(a.x, a.y) && !inView(b.x, b.y)) continue;
      const aOn = st.alloc.has(a.id) || isStart(a, st);
      const bOn = st.alloc.has(b.id) || isStart(b, st);
      let kind = 'normal';
      if (aOn && bOn) kind = 'active';
      else if ((aOn || st.hoverPath.has(a.id)) && (bOn || st.hoverPath.has(b.id)) && (st.hoverPath.has(a.id) || st.hoverPath.has(b.id))) kind = 'path';
      batches[kind].push(e);
    }
    const strokeBatch = (list, color, width) => {
      if (!list.length) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(width, 1.4 * px);
      ctx.beginPath();
      for (const e of list) {
        const a = tree.nodes[e.a];
        const b = tree.nodes[e.b];
        if (e.arc) {
          const [cx, cy, r, a1, a2] = e.arc;
          ctx.moveTo(cx + r * Math.cos(a1), cy + r * Math.sin(a1));
          ctx.arc(cx, cy, r, a1, a2, a2 < a1);
        } else {
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
      }
      ctx.stroke();
    };
    strokeBatch(batches.normal, '#3a3024', 9);
    strokeBatch(batches.path, '#d8ccb0', 13);
    ctx.shadowColor = '#e0b85a';
    ctx.shadowBlur = 0;
    strokeBatch(batches.active, '#c79a45', 15);
    strokeBatch(batches.active, '#f3d58f', 6);

    // Nœuds
    const ov = tree.nodeOverlay;
    for (const n of vis.current.nodes) {
      if (!inView(n.x, n.y, 300)) continue;
      const otherAsc = n.ascendancy && n.ascendancy !== st.build.ascendancy;
      const on = st.alloc.has(n.id);
      const state2 = on || st.hoverId === n.id ? 'alloc' : st.hoverPath.has(n.id) ? 'path' : 'unalloc';
      if (otherAsc) ctx.globalAlpha = 0.45;
      if (n.type === 'ascendancyStart') {
        drawSprite(ctx, 'group-background:AscendancyMiddle', n.x, n.y, 0.9);
        ctx.globalAlpha = 1;
        continue;
      }
      // icône
      let icon = n.icon;
      if (n.isAttribute) {
        const ch = st.build.tree.attributes?.[n.id];
        const opt = ch && n.options?.find((o) => o.attr === ch);
        if (opt) icon = opt.icon;
      }
      if (n.type !== 'jewel') {
        const iconScale = n.type === 'keystone' ? NODE_SCALE * 1.05 : n.type === 'notable' ? NODE_SCALE * 0.98 : NODE_SCALE;
        if (!drawSprite(ctx, `${state2 === 'unalloc' ? 'skills-dim' : 'skills'}:${icon}`, n.x, n.y, iconScale)) {
          ctx.fillStyle = state2 === 'unalloc' ? '#2a241c' : '#8a6f3f';
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.type === 'normal' ? 40 : 60, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // cadre
      const frameName = n.overlay?.[state2] || ov[TYPE_OVERLAY[n.type]]?.[state2];
      if (frameName) drawSprite(ctx, `group-background:${frameName}`, n.x, n.y) || drawSprite(ctx, `jewel-sockets:${frameName}`, n.x, n.y);
      ctx.globalAlpha = 1;
    }

    // Départ de classe
    const start = st.cls && tree.nodes[st.cls.startNode];
    if (start) {
      const g = ctx.createRadialGradient(start.x, start.y, 10, start.x, start.y, 160);
      g.addColorStop(0, '#ffe7a8');
      g.addColorStop(0.4, '#c8962e88');
      g.addColorStop(1, '#c8962e00');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(start.x, start.y, 160, 0, Math.PI * 2);
      ctx.fill();
    }

    // Recherche (anneaux jaunes, comme en jeu)
    if (st.searchSet.size) {
      ctx.strokeStyle = '#ffe14a';
      ctx.lineWidth = Math.max(10, 2.5 * px);
      ctx.beginPath();
      for (const id of st.searchSet) {
        const n = tree.nodes[id];
        if (!inView(n.x, n.y, 200)) continue;
        const r = n.type === 'keystone' ? 150 : n.type === 'notable' ? 110 : 80;
        ctx.moveTo(n.x + r, n.y);
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      }
      ctx.stroke();
    }

    // Surlignage demandé par Claude (anneaux pulsants)
    const hl = st.highlight;
    if (hl && hl.ids?.length) {
      const pulse = hl.until > Date.now() ? 0.5 + 0.5 * Math.sin(now / 180) : 0.6;
      ctx.strokeStyle = `rgba(217,119,87,${0.45 + 0.55 * pulse})`;
      ctx.lineWidth = Math.max(14, 3 * px);
      ctx.beginPath();
      for (const id of hl.ids) {
        const n = tree.nodes[id];
        if (!n || !inView(n.x, n.y, 300)) continue;
        const r = (n.type === 'keystone' ? 170 : n.type === 'notable' ? 125 : 95) + pulse * 20;
        ctx.moveTo(n.x + r, n.y);
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      }
      ctx.stroke();
    }
  }

  // --- Interaction
  function toWorld(ev) {
    const r = canvasRef.current.getBoundingClientRect();
    const { s, ox, oy } = view.current;
    return { x: (ev.clientX - r.left - ox) / s, y: (ev.clientY - r.top - oy) / s, sx: ev.clientX - r.left, sy: ev.clientY - r.top };
  }
  function hitTest(wx, wy) {
    const cx = Math.floor(wx / CELL);
    const cy = Math.floor(wy / CELL);
    let best = null;
    let bestD = Infinity;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const n of vis.current.grid.get(`${cx + dx},${cy + dy}`) || []) {
          const d = Math.hypot(n.x - wx, n.y - wy);
          const r = n.type === 'keystone' ? 140 : n.type === 'notable' || n.type === 'jewel' ? 95 : n.type === 'ascendancyStart' ? 60 : 70;
          if (d < Math.max(r, 6 / view.current.s) && d < bestD) {
            best = n;
            bestD = d;
          }
        }
      }
    }
    return best;
  }

  function onMouseDown(ev) {
    if (ev.button !== 0 && ev.button !== 1) return;
    drag.current = { x: ev.clientX, y: ev.clientY, ox: view.current.ox, oy: view.current.oy, moved: false };
    setAttrPick(null);
  }
  function onMouseMove(ev) {
    const d = drag.current;
    if (d) {
      const dx = ev.clientX - d.x;
      const dy = ev.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) > 4) {
        d.moved = true;
        setHover(null);
        hc.hide();
        setCursor('dragging');
      }
      if (d.moved) {
        view.current.ox = d.ox + dx;
        view.current.oy = d.oy + dy;
        dirty.current = true;
        return;
      }
    }
    const w = toWorld(ev);
    const n = hitTest(w.x, w.y);
    if ((n?.id ?? null) !== (hover?.node.id ?? null)) {
      setHover(n ? { node: n, x: ev.clientX, y: ev.clientY } : null);
      onHoverNode?.(n);
      setCursor(n ? 'hovering' : '');
      if (n) hc.show(n.id, n, ev.clientX, ev.clientY);
      else hc.hide();
    }
  }
  function onMouseUp(ev) {
    const d = drag.current;
    drag.current = null;
    setCursor(hover ? 'hovering' : '');
    if (!d || d.moved || ev.button !== 0) return;
    const w = toWorld(ev);
    const n = hitTest(w.x, w.y);
    if (!n || n.type === 'ascendancyStart') return;
    if (state.current.alloc.has(n.id)) {
      if (n.isAttribute && ev.shiftKey) setAttrPick({ node: n, x: ev.clientX, y: ev.clientY });
      else onDeallocate(n.id);
    } else if (graph.isAllocatable(n, build)) {
      if (n.isAttribute) setAttrPick({ node: n, x: ev.clientX, y: ev.clientY, allocate: true });
      else onAllocate(n.id);
    }
  }
  function onContextMenu(ev) {
    ev.preventDefault();
    const w = toWorld(ev);
    const n = hitTest(w.x, w.y);
    if (n?.isAttribute && state.current.alloc.has(n.id)) setAttrPick({ node: n, x: ev.clientX, y: ev.clientY });
  }
  function onWheel(ev) {
    const w = toWorld(ev);
    const f = Math.pow(1.0015, -ev.deltaY);
    const s = Math.max(MIN_S, Math.min(MAX_S, view.current.s * f));
    view.current.ox = w.sx - w.x * s;
    view.current.oy = w.sy - w.y * s;
    view.current.s = s;
    dirty.current = true;
  }
  useEffect(() => {
    const c = canvasRef.current;
    const h = (e) => {
      e.preventDefault();
      onWheel(e);
    };
    c.addEventListener('wheel', h, { passive: false });
    const ro = new ResizeObserver(() => (dirty.current = true));
    ro.observe(c);
    return () => {
      c.removeEventListener('wheel', h);
      ro.disconnect();
    };
  });

  const pickAttr = (attr) => {
    const p = attrPick;
    setAttrPick(null);
    if (p.allocate) onAllocate(p.node.id, attr);
    else onSetAttribute(p.node.id, attr);
  };

  return (
    <div className="tree-wrap" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className={cursor}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => {
          drag.current = null;
          setHover(null);
          setCursor('');
          hc.hide();
        }}
        onContextMenu={onContextMenu}
      />
      {hc.card && !attrPick && tree.nodes[hc.card.key] && (() => {
        const cn = tree.nodes[hc.card.key];
        const cPath = alloc.has(cn.id) ? null : cn.id === hover?.node.id ? hoverPath : graph.findPath(build, cn.id);
        return (
          <PassiveTooltip
            key={cn.id}
            node={cn}
            graph={graph}
            build={build}
            x={hc.card.x}
            y={hc.card.y}
            allocated={alloc.has(cn.id)}
            pathLen={cPath ? cPath.length : null}
            card={hc.cardProps}
          />
        );
      })()}
      {attrPick && (
        <div className="attr-pick" style={{ left: attrPick.x + 12, top: attrPick.y + 12 }}>
          <span className="muted small" style={{ alignSelf: 'center' }}>Attribut :</span>
          <button className="btn str" onClick={() => pickAttr('Strength')}>Force</button>
          <button className="btn dex" onClick={() => pickAttr('Dexterity')}>Dextérité</button>
          <button className="btn int" onClick={() => pickAttr('Intelligence')}>Intelligence</button>
          <button className="btn ghost small" onClick={() => setAttrPick(null)}>✕</button>
        </div>
      )}
    </div>
  );
}

function isStart(n, st) {
  if (n.type === 'ascendancyStart') return n.ascendancy === st.build.ascendancy;
  return false;
}
