// Définitions ouvertes depuis une carte (infobulle de l'arbre, d'une gemme ou d'un objet).
// Elles s'affichent EN COLONNE À CÔTÉ de la carte (jamais par-dessus son texte) :
// - survol d'un mot souligné : aperçu de sa définition dans la colonne ;
// - clic : la définition est épinglée ; un clic sur un mot d'une définition ouvre la suivante en dessous ;
// - un clic sur un autre mot de la carte principale ferme toute la série et en commence une nouvelle.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { TermsCtx, useTerms, makeLinkify } from './Terms.jsx';
import { PassiveTooltip, GemTooltip, ItemTooltip } from './Tooltips.jsx';
import { useLang } from '../lang.jsx';

const sameTarget = (a, b) => a && b && a.kind === b.kind && (a.slug ?? a.id) === (b.slug ?? b.id);

/** Enveloppe le contenu d'une carte : mots soulignés « de carte » + colonne de définitions */
export function CardTerms({ card, children }) {
  const base = useTerms();
  const [chain, setChain] = useState([]); // définitions épinglées
  const [preview, setPreview] = useState(null); // { target, from } : aperçu au survol
  const leaveT = useRef(0);

  const keepPreview = () => clearTimeout(leaveT.current);
  const dropPreview = (delay = 280) => {
    clearTimeout(leaveT.current);
    leaveT.current = setTimeout(() => setPreview(null), delay);
  };
  useEffect(() => () => clearTimeout(leaveT.current), []);

  // mots de la carte principale (source -1)
  const cardApi = useMemo(() => {
    if (!base?.index) return base;
    return {
      ...base,
      linkify: makeLinkify(base.index, {
        enter: (e, target) => {
          keepPreview();
          setPreview({ target, from: -1 });
        },
        leave: () => dropPreview(),
        click: (target) => {
          setChain([target]); // nouveau mot de la carte : la série précédente se ferme
          setPreview(null);
        },
      }),
    };
  }, [base]);

  if (!base?.index) return children;
  return (
    <TermsCtx.Provider value={cardApi}>
      {children}
      {(chain.length > 0 || preview) && (
        <DefColumn
          base={base}
          card={card}
          chain={chain}
          preview={preview && !chain.some((c, i) => i === preview.from + 1 && sameTarget(c, preview.target)) ? preview : null}
          setChain={setChain}
          setPreview={setPreview}
          keepPreview={keepPreview}
          dropPreview={dropPreview}
        />
      )}
    </TermsCtx.Provider>
  );
}

function DefColumn({ base, card, chain, preview, setChain, setPreview, keepPreview, dropPreview }) {
  const ref = useRef(null);
  const [place, setPlace] = useState({ side: 'right', maxHeight: 600 });
  const items = preview ? [...chain, preview.target] : chain;

  // côté droit s'il y a la place, sinon à gauche ; hauteur limitée à l'écran
  useLayoutEffect(() => {
    const el = ref.current;
    const host = el?.parentElement?.closest('.tooltip');
    if (!host) return;
    const r = host.getBoundingClientRect();
    const W = 372;
    const side = window.innerWidth - r.right >= W ? 'right' : r.left >= W ? 'left' : window.innerWidth - r.right >= r.left ? 'right' : 'left';
    const maxHeight = Math.max(200, window.innerHeight - r.top - 10);
    if (side !== place.side || Math.abs(maxHeight - place.maxHeight) > 2) setPlace({ side, maxHeight });
  });
  // la dernière définition épinglée reste visible (pas pour un simple aperçu : rien ne doit bouger sous la souris)
  const prevLen = useRef(chain.length);
  useEffect(() => {
    if (chain.length > prevLen.current) {
      const panels = ref.current?.querySelectorAll('.def-panel:not(.preview)');
      panels?.[panels.length - 1]?.scrollIntoView?.({ block: 'nearest' });
    }
    prevLen.current = chain.length;
  }, [chain.length]);

  return (
    <div
      ref={ref}
      className={`card-defs ${place.side}`}
      style={{ maxHeight: place.maxHeight }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {items.map((t, j) => {
        const isPreview = preview && j === chain.length;
        return (
          <DefPanel
            key={`${j}-${t.kind}-${t.slug ?? t.id}`}
            base={base}
            card={card}
            target={t}
            isPreview={isPreview}
            depth={j}
            onEnter={isPreview ? keepPreview : undefined}
            onLeave={isPreview ? () => dropPreview(200) : undefined}
            // survol d'un mot dans une définition épinglée : aperçu à la suite
            onHoverWord={isPreview ? null : (target) => (keepPreview(), setPreview({ target, from: j }))}
            onLeaveWord={isPreview ? null : () => dropPreview()}
            // clic : on garde les définitions jusqu'à celle-ci, puis on ajoute la nouvelle
            onClickWord={(target) => {
              setChain((c) => (isPreview ? [...c.slice(0, preview.from + 1), preview.target, target] : [...c.slice(0, j + 1), target]));
              setPreview(null);
            }}
            onPin={isPreview ? () => (setChain((c) => [...c.slice(0, preview.from + 1), preview.target]), setPreview(null)) : null}
            onClose={() => {
              setChain((c) => c.slice(0, j));
              setPreview(null);
            }}
          />
        );
      })}
    </div>
  );
}

function DefPanel({ base, card, target: t, isPreview, depth, onEnter, onLeave, onHoverWord, onLeaveWord, onClickWord, onPin, onClose }) {
  const { L } = useLang();
  const data = base.data;
  // mots soulignés à l'intérieur de cette définition
  const api = useMemo(
    () => ({
      ...base,
      linkify: makeLinkify(base.index, {
        enter: onHoverWord ? (e, target) => onHoverWord(target) : null,
        leave: onLeaveWord ? () => onLeaveWord() : null,
        click: (target) => onClickWord(target),
      }),
    }),
    [base, onHoverWord, onLeaveWord, onClickWord],
  );

  let title = null;
  let body = null;
  let actions = null;
  if (t.kind === 'kw') {
    const e = data.glossary?.entries?.[t.slug];
    title = e?.t || t.slug;
    const kwTarget = (ev) => {
      const k = ev.target.closest?.('.kw')?.dataset?.k;
      return k && data.glossary.entries[k] ? { kind: 'kw', slug: k } : null;
    };
    body = e ? (
      <>
        {e.tEn && e.tEn !== e.t && <div className="kw-other">{L.other} : {e.tEn}</div>}
        <div
          className="kw-def"
          onClick={(ev) => {
            const k = kwTarget(ev);
            if (k) onClickWord(k);
          }}
          onMouseOver={(ev) => {
            const k = kwTarget(ev);
            if (k && onHoverWord) onHoverWord(k);
          }}
          onMouseOut={(ev) => {
            if (kwTarget(ev) && onLeaveWord) onLeaveWord();
          }}
          dangerouslySetInnerHTML={{ __html: e.d }}
        />
      </>
    ) : (
      <div className="kw-def">Terme inconnu.</div>
    );
  } else if (t.kind === 'gem') {
    const g = data.gemsById.get(t.id);
    title = null;
    body = <GemTooltip gem={g} floating={false} />;
    actions = <button className="btn small" onClick={() => { base.onLibrary?.(g.name); card?.onClose?.(); }}>Voir dans la bibliothèque</button>;
  } else if (t.kind === 'node') {
    const n = data.tree.nodes[t.id];
    body = <PassiveTooltip node={n} graph={data.graph} build={{ tree: { nodes: [], attributes: {} } }} floating={false} />;
    actions = (
      <>
        <button className="btn small" onClick={() => { base.onNode?.(n.id); card?.onClose?.(); }}>Voir dans l'arbre</button>
        <button className="btn small" onClick={() => { base.onLibrary?.(n.name); card?.onClose?.(); }}>Bibliothèque</button>
      </>
    );
  } else if (t.kind === 'unique') {
    const u = data.items.uniques.find((x) => x.id === t.id);
    body = <ItemTooltip item={{ ...u, rarity: 'UNIQUE', implicitsFr: u.implicits, explicitsFr: u.explicits }} floating={false} />;
    actions = <button className="btn small" onClick={() => { base.onLibrary?.(u.name); card?.onClose?.(); }}>Voir dans la bibliothèque</button>;
  }

  return (
    <div className={`def-panel ${isPreview ? 'preview' : ''} ${t.kind !== 'kw' ? 'entity' : ''}`} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <div className="def-head">
        {depth > 0 && <span className="def-depth">{'›'.repeat(Math.min(depth, 4))}</span>}
        <span className="def-title">{title}</span>
        {isPreview ? (
          <button className="def-pin" title="Garder cette définition ouverte" onClick={onPin}>garder</button>
        ) : (
          <button className="def-x" title="Fermer cette définition (et les suivantes)" onClick={onClose}>✕</button>
        )}
      </div>
      <TermsCtx.Provider value={api}>{body}</TermsCtx.Provider>
      {actions && <div className="row wrap" style={{ justifyContent: 'center', marginTop: 6 }}>{actions}</div>}
      <div className="def-foot">{isPreview ? 'Aperçu · cliquez sur le mot pour le garder ouvert' : 'Définition officielle du jeu · cliquez sur un mot souligné pour ouvrir le sien en dessous'}</div>
    </div>
  );
}
