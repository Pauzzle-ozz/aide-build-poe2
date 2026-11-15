import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { RARITY_FR } from '@core/build-model.mjs';
import { useTerms, Lk } from './Terms.jsx';
import { useLang, englishItem } from '../lang.jsx';
import { CardChrome, cardRootProps } from './HoverCard.jsx';
import { CardTerms } from './CardDefs.jsx';

const U = (f) => `url(/assets/ui/${f})`;

function Header({ prefix, double, children }) {
  return (
    <div className={`tt-header${double ? ' double' : ''}`}>
      <i style={{ backgroundImage: U(`${prefix}left.png`) }} />
      <div style={{ backgroundImage: U(`${prefix}middle.png`) }}>{children}</div>
      <i style={{ backgroundImage: U(`${prefix}right.png`) }} />
    </div>
  );
}

export function Sep({ kind = 'white' }) {
  return <div className="tt-sep" style={{ backgroundImage: U(`itemsseparator${kind}.png`) }} />;
}

/**
 * Positionne une infobulle flottante sans sortir de l'écran :
 * - par défaut à côté du curseur (x, y) ;
 * - card.dock = 'right' | 'left' : collée au bord d'un panneau (x = bord), y suit la souris.
 */
function useFloating(x, y, card) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x + 18, top: y + 18 });
  const dock = card?.dock;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left = x + 18;
    let top = y + 18;
    if (dock === 'right') {
      left = Math.min(x + 10, window.innerWidth - w - 8);
      top = y - 28;
    } else if (dock === 'left') {
      left = Math.max(8, x - w - 10);
      top = y - 28;
    } else if (left + w > window.innerWidth - 8) left = x - w - 18;
    if (top + h > window.innerHeight - 8) top = window.innerHeight - h - 8;
    if (top < 8) top = 8;
    if (left < 8) left = 8;
    setPos({ left, top });
  }, [x, y, dock, card?.locked]);
  const setRef = (el) => {
    ref.current = el;
    card?.setEl?.(el);
  };
  return [setRef, pos];
}

/** Cadre commun des infobulles : statique, flottante, ou « carte » (bloquable, définitions à côté) */
function Frame({ floating, card, setRef, pos, className, style, children }) {
  const cls = `tooltip ${floating ? '' : 'static'} ${card ? 'card' : ''} ${card?.locked ? 'locked' : ''} ${card?.dock ? `dock-${card.dock}` : ''} ${className}`;
  return (
    <div ref={floating ? setRef : null} className={cls} style={floating ? { ...pos, ...style } : undefined} {...cardRootProps(card)}>
      {card ? (
        <>
          <CardChrome card={card} />
          <CardTerms card={card}>{children}</CardTerms>
        </>
      ) : (
        children
      )}
    </div>
  );
}

/** HTML d'infobulle poe2db (déjà nettoyé : div / span / br) rendu en React, termes soulignés */
export function HtmlTerms({ html, className }) {
  const terms = useTerms();
  const root = useMemo(() => {
    if (!html) return null;
    return new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html').body.firstChild;
  }, [html]);
  if (!root) return null;
  let k = 0;
  const conv = (node, skip) => {
    if (node.nodeType === 3) return terms && !skip ? terms.linkify(node.nodeValue, `h${k++}`) : node.nodeValue;
    if (node.nodeType !== 1) return null;
    const tag = node.tagName.toLowerCase();
    if (tag === 'br') return <br key={`h${k++}`} />;
    const cls = node.getAttribute('class') || undefined;
    const sk = skip || /\b(itemHeader|itemName|typeLine)\b/.test(cls || '');
    const kids = [...node.childNodes].map((c) => conv(c, sk));
    return tag === 'span' ? <span key={`h${k++}`} className={cls}>{kids}</span> : <div key={`h${k++}`} className={cls}>{kids}</div>;
  };
  return <div className={className}>{[...root.childNodes].map((c) => conv(c, false))}</div>;
}

const PASSIVE_HEADER = { normal: 'normal', notable: 'notable', keystone: 'keystone', jewel: 'jewel' };

export function PassiveTooltip({ node, graph, build, x, y, allocated, pathLen, floating = true, card }) {
  const [ref, pos] = useFloating(x, y, card);
  const { L } = useLang();
  const asc = node.ascendancy ? graph.ascById[node.ascendancy] : null;
  const prefix = asc ? 'ascendancypassiveheader' : `${PASSIVE_HEADER[node.type] || 'normal'}passiveheader`;
  const stats = graph.nodeStats(node, build, 'fr');
  const label = graph.nodeLabel(node, build, 'fr');
  const typeFr = { normal: 'Passif', notable: 'Passif notable', keystone: 'Clé de voûte', jewel: 'Emplacement de joyau', ascendancyStart: "Départ d'ascendance" }[node.type];
  let hint = null;
  if (floating) {
    if (allocated) hint = node.isAttribute ? 'Clic : retirer · Clic droit : changer d\'attribut' : 'Clic : retirer ce passif (et ceux qui en dépendent)';
    else if (asc && build.ascendancy !== node.ascendancy) hint = `Appartient à l'ascendance ${asc.name}`;
    else if (pathLen != null) hint = `Clic : allouer (${pathLen} point${pathLen > 1 ? 's' : ''})`;
    else if (node.type !== 'ascendancyStart') hint = 'Inaccessible depuis votre arbre actuel';
  }
  return (
    <Frame floating={floating} card={card} setRef={ref} pos={pos} className={`tt-${node.type === 'keystone' ? 'keystone' : node.type === 'notable' ? 'notable' : 'passive'}`}>
      <Header prefix={prefix} double={false}>
        <span>{label}</span>
      </Header>
      <div className="tt-body">
        <div className="prop">{asc ? `${typeFr} — ${asc.name}` : typeFr}</div>
        {stats.length > 0 && <Sep kind="white" />}
        {stats.map((s, i) => (
          <div key={i} className="line"><Lk>{s}</Lk></div>
        ))}
        {node.isAttribute && !build.tree.attributes?.[node.id] && (
          <div className="prop" style={{ marginTop: 4 }}>Choix : <Lk>Force, Dextérité ou Intelligence</Lk></div>
        )}
        {node.flavour && <div className="flavour">{node.flavour}</div>}
        {node.nameEn && node.nameEn !== label && <div className="en" style={{ marginTop: 6 }}>{L.otherName} : {node.nameEn}</div>}
        {node.unofficial && <div className="unofficial">Traduction non officielle (pas encore traduite dans le jeu)</div>}
        {hint && <div className="hint">{hint}</div>}
      </div>
    </Frame>
  );
}

const RARITY_CLASS = { NORMAL: 'normal', MAGIC: 'magic', RARE: 'rare', UNIQUE: 'unique' };
const RARITY_HEADER = { NORMAL: 'white', MAGIC: 'magic', RARE: 'rare', UNIQUE: 'unique' };

/**
 * buildItem : objet équipé dans un build (ses textes anglais sont retrouvés via l'unique / la base d'origine).
 * Les objets venant directement des données (bibliothèque, choix d'un objet) sont déjà dans la bonne langue.
 */
export function ItemTooltip({ item: raw, x, y, floating = true, showEn = false, card, buildItem = false }) {
  const [ref, pos] = useFloating(x || 0, y || 0, card);
  const { lang, view, L } = useLang();
  if (!raw) return null;
  const item = buildItem && lang === 'en' ? englishItem(raw, view) : raw;
  const rarity = item.rarity || 'NORMAL';
  const double = rarity === 'RARE' || rarity === 'UNIQUE';
  const kind = RARITY_HEADER[rarity];
  const implicits = item.implicitsFr?.length ? item.implicitsFr : item.implicits || [];
  const explicits = item.explicitsFr?.length ? item.explicitsFr : item.explicits || [];
  return (
    <Frame floating={floating} card={card} setRef={ref} pos={pos} className={`tt-${RARITY_CLASS[rarity]}`}>
      <Header prefix={`itemsheader${kind}`} double={double}>
        {double ? (
          <>
            <span>{item.name}</span>
            <span>{item.base}</span>
          </>
        ) : (
          <span>{item.name || item.base}</span>
        )}
      </Header>
      <div className="tt-body">
        {item.classFr && <div className="prop"><Lk>{item.classFr}</Lk></div>}
        {(item.properties || []).map((p, i) => (
          <div key={i} className="prop"><Lk>{p}</Lk></div>
        ))}
        {item.quality ? <div className="prop">{L.quality} : <b>+{item.quality}%</b></div> : null}
        {(item.requirements || []).length > 0 && (
          <>
            <Sep kind={kind} />
            {item.requirements.map((r, i) => (
              <div key={i} className="req">{L.req} : <Lk>{r}</Lk></div>
            ))}
          </>
        )}
        {implicits.length > 0 && <Sep kind={kind} />}
        {implicits.map((m, i) => (
          <div key={i} className="line"><Lk>{m}</Lk></div>
        ))}
        {explicits.length > 0 && <Sep kind={kind} />}
        {explicits.map((m, i) => (
          <div key={i} className="line"><Lk>{m}</Lk></div>
        ))}
        {item.corrupted && <div style={{ color: '#d20000', marginTop: 4 }}>{L.corrupted}</div>}
        {showEn && item.nameEn && item.nameEn !== item.name && <div className="en" style={{ marginTop: 6 }}>{L.otherName} : {item.nameEn}</div>}
        {(item.unofficial || item.unofficialName) && <div className="unofficial">Traduction non officielle (pas encore traduite dans le jeu)</div>}
        {!floating ? null : <div className="hint">{RARITY_FR[rarity]}</div>}
      </div>
    </Frame>
  );
}

export function GemTooltip({ gem, x, y, floating = true, level, card }) {
  const [ref, pos] = useFloating(x || 0, y || 0, card);
  const { L } = useLang();
  if (!gem) return null;
  return (
    <Frame floating={floating} card={card} setRef={ref} pos={pos} style={{ maxWidth: 480 }} className="tt-gem">
      <Header prefix="itemsheadergem" double={false}>
        <span>{gem.name}{level ? ` (niv. ${level})` : ''}</span>
      </Header>
      <div className="tt-body">
        {gem.tooltipHtml ? (
          <HtmlTerms className="gem-tt" html={gem.tooltipHtml} />
        ) : (
          <>
            <div className="prop"><Lk>{(gem.tags || []).join(', ')}</Lk></div>
            {gem.description && <div className="desc" style={{ color: 'var(--gem)', marginTop: 6 }}><Lk>{gem.description}</Lk></div>}
          </>
        )}
        {gem.nameEn && gem.nameEn !== gem.name && <div className="en" style={{ marginTop: 6 }}>{L.otherName} : {gem.nameEn}</div>}
        {gem.unofficial && <div className="unofficial">Traduction non officielle (pas encore traduite dans le jeu)</div>}
      </div>
    </Frame>
  );
}
