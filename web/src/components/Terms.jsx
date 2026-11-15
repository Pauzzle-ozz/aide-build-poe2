// Mots soulignés comme dans le jeu : termes du glossaire officiel (définition au survol)
// et noms de gemmes / passifs / uniques (infobulle du jeu + lien vers la bibliothèque ou l'arbre).
// Les deux langues sont reconnues (notes en français, infobulles en anglais avec le bouton FR / EN) ;
// la définition s'affiche dans la langue choisie, avec le terme dans l'autre langue.
import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PassiveTooltip, GemTooltip, ItemTooltip } from './Tooltips.jsx';
import { useLang } from '../lang.jsx';

const Ctx = createContext(null);
export const TermsCtx = Ctx;
export const useTerms = () => useContext(Ctx);

/** Texte avec les termes du jeu soulignés, selon le contexte le plus proche (notes, carte, définition…) */
export function Lk({ children }) {
  const t = useContext(Ctx);
  return t && typeof children === 'string' ? t.linkify(children) : children;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const B = '(?<![\\p{L}\\p{N}])';
const A = '(?![\\p{L}\\p{N}])';

function buildIndex(data) {
  // termes du glossaire (insensibles à la casse), formes françaises prioritaires
  const forms = { ...(data.glossary?.formsEn || {}), ...(data.glossary?.forms || {}) };
  const fkeys = Object.keys(forms).sort((a, b) => b.length - a.length);
  const kwRe = fkeys.length ? new RegExp(`${B}(${fkeys.map(esc).join('|')})${A}`, 'giu') : null;

  // noms propres du jeu (sensibles à la casse), dans les deux langues : gemmes, notables / clés de voûte, uniques
  const ents = new Map();
  const put = (name, v) => {
    if (!name || name.length < 4 || ents.has(name)) return;
    ents.set(name, v);
  };
  for (const n of Object.values(data.tree.nodes)) {
    if (n.type === 'keystone' || n.type === 'notable') {
      put(n.name, { kind: 'node', id: n.id });
      put(n.nameEn, { kind: 'node', id: n.id });
    }
  }
  for (const g of data.gems) {
    put(g.name, { kind: 'gem', id: g.id });
    put(g.nameEn, { kind: 'gem', id: g.id });
  }
  for (const u of data.items.uniques) {
    put(u.name, { kind: 'unique', id: u.id });
    put(u.nameEn, { kind: 'unique', id: u.id });
  }
  const ekeys = [...ents.keys()].sort((a, b) => b.length - a.length);
  const entRe = ekeys.length ? new RegExp(`${B}(${ekeys.map(esc).join('|')})${A}`, 'gu') : null;
  return { forms, kwRe, ents, entRe };
}

/**
 * Découpe un texte en morceaux, avec les termes reconnus soulignés.
 * enter / leave : réaction au survol ; click : réaction au clic (les deux peuvent être combinés).
 */
export function makeLinkify(index, { enter, leave, click }) {
  const props = (target) => ({
    ...(enter ? { onMouseEnter: (e) => enter(e, target), onMouseLeave: (e) => leave?.(e, target) } : {}),
    ...(click ? { onClick: (e) => (e.stopPropagation(), click(target, e)) } : {}),
  });
  return (text, keyBase = 't') => {
    if (!text) return text;
    const out = [];
    let k = 0;
    const pushKw = (s) => {
      if (!index.kwRe) return out.push(s);
      let last = 0;
      for (const m of s.matchAll(index.kwRe)) {
        const slug = index.forms[m[0].toLowerCase()];
        if (!slug) continue;
        if (m.index > last) out.push(s.slice(last, m.index));
        out.push(
          <span key={`${keyBase}-${k++}`} className={`kw${click ? ' click' : ''}`} {...props({ kind: 'kw', slug })}>
            {m[0]}
          </span>,
        );
        last = m.index + m[0].length;
      }
      if (last < s.length) out.push(s.slice(last));
    };
    if (!index.entRe) {
      pushKw(text);
      return out;
    }
    let last = 0;
    for (const m of text.matchAll(index.entRe)) {
      const ent = index.ents.get(m[0]);
      if (m.index > last) pushKw(text.slice(last, m.index));
      out.push(
        <span key={`${keyBase}-${k++}`} className={`ent ent-${ent.kind}${click ? ' click' : ''}`} {...props(ent)}>
          {m[0]}
        </span>,
      );
      last = m.index + m[0].length;
    }
    if (last < text.length) pushKw(text.slice(last));
    return out;
  };
}

export function TermsProvider({ data, children, onLibrary, onNode }) {
  const [pop, setPop] = useState(null);
  const closeT = useRef(null);
  const index = useMemo(() => buildIndex(data), [data]);

  const api = useMemo(() => {
    const enter = (e, target) => {
      clearTimeout(closeT.current);
      const r = e.currentTarget.getBoundingClientRect();
      setPop({ rect: { left: r.left, top: r.top, bottom: r.bottom }, target, stack: [] });
    };
    const leave = () => {
      clearTimeout(closeT.current);
      closeT.current = setTimeout(() => setPop(null), 300); // laisse le temps de rejoindre la fenêtre
    };
    return { linkify: makeLinkify(index, { enter, leave }), enter, leave, index, data, onLibrary, onNode };
  }, [index, data, onLibrary, onNode]);

  const keep = () => clearTimeout(closeT.current);
  const close = () => setPop(null);
  const go = (target) => setPop((p) => (p ? { ...p, target, stack: [...p.stack, p.target] } : p));
  const back = () => setPop((p) => (p && p.stack.length ? { ...p, target: p.stack[p.stack.length - 1], stack: p.stack.slice(0, -1) } : p));
  // dans la fenêtre de définition : les mots soulignés s'ouvrent d'un clic (avec « retour »)
  const nested = useMemo(() => ({ linkify: makeLinkify(index, { click: go }) }), [index]);
  const popupLeave = (e) => {
    api.leave();
    window.dispatchEvent(new CustomEvent('terms:popup-leave', { detail: { to: e.relatedTarget } }));
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      {pop && (
        <TermPopup pop={pop} data={data} nested={nested} onEnter={keep} onLeave={popupLeave} go={go} back={back} close={close} onLibrary={onLibrary} onNode={onNode} />
      )}
    </Ctx.Provider>
  );
}

function TermPopup({ pop, data, nested, onEnter, onLeave, go, back, close, onLibrary, onNode }) {
  const ref = useRef(null);
  const { L } = useLang();
  const [pos, setPos] = useState({ left: pop.rect.left, top: pop.rect.bottom + 6 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left = Math.min(pop.rect.left, window.innerWidth - w - 10);
    let top = pop.rect.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, pop.rect.top - h - 6);
    setPos({ left: Math.max(8, left), top });
  }, [pop]);

  const t = pop.target;
  let body = null;
  let actions = null;
  if (t.kind === 'kw') {
    const e = data.glossary?.entries?.[t.slug];
    body = e ? (
      <div className="kw-pop">
        <div className="kw-title">{e.t}</div>
        {e.tEn && e.tEn !== e.t && <div className="kw-other">{L.other} : {e.tEn}</div>}
        <div
          className="kw-def"
          onClick={(ev) => {
            const k = ev.target.closest?.('.kw')?.dataset?.k;
            if (k && data.glossary.entries[k]) go({ kind: 'kw', slug: k });
          }}
          dangerouslySetInnerHTML={{ __html: e.d }}
        />
        <div className="kw-foot">Définition officielle du jeu{e.d.includes('class="kw"') ? ' · cliquez sur un mot souligné pour sa définition' : ''}</div>
      </div>
    ) : (
      <div className="kw-pop">Terme inconnu.</div>
    );
  } else if (t.kind === 'gem') {
    const g = data.gemsById.get(t.id);
    body = <GemTooltip gem={g} floating={false} />;
    actions = <button className="btn small" onClick={() => { onLibrary(g.name); close(); }}>Voir dans la bibliothèque</button>;
  } else if (t.kind === 'node') {
    const n = data.tree.nodes[t.id];
    body = <PassiveTooltip node={n} graph={data.graph} build={{ tree: { nodes: [], attributes: {} } }} floating={false} />;
    actions = (
      <>
        <button className="btn small" onClick={() => { onNode(n.id); close(); }}>Voir dans l'arbre</button>
        <button className="btn small" onClick={() => { onLibrary(n.name); close(); }}>Bibliothèque</button>
      </>
    );
  } else if (t.kind === 'unique') {
    const u = data.items.uniques.find((x) => x.id === t.id);
    body = <ItemTooltip item={{ ...u, rarity: 'UNIQUE', implicitsFr: u.implicits, explicitsFr: u.explicits }} floating={false} />;
    actions = <button className="btn small" onClick={() => { onLibrary(u.name); close(); }}>Voir dans la bibliothèque</button>;
  }

  return (
    <div ref={ref} className="term-popup" style={pos} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      {pop.stack.length > 0 && (
        <button className="btn small ghost" style={{ marginBottom: 4 }} onClick={back}>
          ← retour
        </button>
      )}
      <Ctx.Provider value={nested}>{body}</Ctx.Provider>
      {t.kind !== 'kw' && <div className="kw-foot">Cliquez sur un mot souligné pour sa définition</div>}
      {actions && <div className="row wrap" style={{ justifyContent: 'center', marginTop: 6 }}>{actions}</div>}
    </div>
  );
}
