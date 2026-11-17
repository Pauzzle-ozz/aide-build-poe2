// Infobulles « cartes » (arbre, équipement, gemmes) :
// - elles apparaissent au survol et restent en place (elles ne suivent plus la souris) ;
// - on peut glisser la souris dessus pour survoler leurs mots soulignés ;
// - un clic sur la carte la BLOQUE : elle reste ouverte, même en survolant autre chose ;
// - un clic en dehors (ou Échap) la ferme. Ce premier clic ne fait rien d'autre, pour ne pas
//   allouer un passif ou changer d'objet par mégarde.
// Au doigt (téléphone), il n'y a pas de survol : le navigateur simule un survol à chaque toucher,
// on l'ignore ; les panneaux ouvrent la carte d'un toucher avec open() (elle s'affiche alors en bas d'écran).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isTouchInput } from '../mobile.js';

const SWITCH_DELAY = 120; // passage d'une cible à une autre (laisse le temps de rejoindre la carte)
const HIDE_DELAY = 280;

export function useHoverCard() {
  const [card, setCard] = useState(null); // { key, payload, x, y, locked }
  const st = useRef({ card: null, over: false, hideT: 0, showT: 0, swallowUntil: 0, el: null });
  st.current.card = card;

  const clearTimers = () => {
    clearTimeout(st.current.hideT);
    clearTimeout(st.current.showT);
  };

  // opts.dock = 'right' | 'left' : carte collée au bord d'un panneau (x = bord), qui suit la souris en hauteur
  const show = useCallback((key, payload, x, y, opts = {}) => {
    const s = st.current;
    const c = s.card;
    if (c?.locked || isTouchInput()) return;
    clearTimeout(s.hideT);
    if (c && c.key === key) {
      if (c.payload !== payload) setCard((p) => (p && p.key === key ? { ...p, payload } : p));
      return;
    }
    clearTimeout(s.showT);
    const next = { key, payload, x, y, dock: opts.dock || null, locked: false };
    if (!c) setCard(next);
    else {
      s.showT = setTimeout(() => {
        if (!s.over && !s.card?.locked) setCard(next);
      }, opts.dock ? 70 : SWITCH_DELAY);
    }
  }, []);

  // la carte suit la souris tant qu'on reste sur l'élément survolé (elle s'arrête dès qu'on le quitte)
  const follow = useCallback((key, x, y) => {
    const s = st.current;
    const c = s.card;
    if (!c || c.locked || c.key !== key || s.over || (c.x === x && c.y === y)) return;
    setCard((p) => (p && p.key === key && !p.locked ? { ...p, x, y } : p));
  }, []);

  const hide = useCallback(() => {
    const s = st.current;
    clearTimeout(s.showT);
    if (!s.card || s.card.locked) return;
    clearTimeout(s.hideT);
    s.hideT = setTimeout(() => {
      if (!s.over && !s.card?.locked) setCard(null);
    }, HIDE_DELAY);
  }, []);

  const close = useCallback(() => {
    clearTimers();
    st.current.over = false;
    setCard(null);
  }, []);

  // ouverture directe, carte bloquée (toucher sur un téléphone)
  const open = useCallback((key, payload, x = 0, y = 0) => {
    clearTimers();
    st.current.over = false;
    setCard({ key, payload, x, y, dock: null, locked: true });
  }, []);

  // Clic en dehors d'une carte bloquée : on la ferme et on « avale » ce clic (mousedown -> mouseup -> click)
  useEffect(() => {
    const s = st.current;
    const inside = (t) => (s.el && s.el.contains(t)) || t?.closest?.('.term-popup');
    const down = (e) => {
      if (!s.card?.locked || inside(e.target)) return;
      s.swallowUntil = Date.now() + 700;
      e.stopPropagation();
      e.preventDefault();
      close();
    };
    const swallow = (e) => {
      if (Date.now() < s.swallowUntil) {
        e.stopPropagation();
        e.preventDefault();
        if (e.type === 'click') s.swallowUntil = 0;
      }
    };
    const key = (e) => {
      if (e.key === 'Escape' && s.card?.locked) {
        e.stopPropagation();
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('mousedown', down, true);
    window.addEventListener('mouseup', swallow, true);
    window.addEventListener('click', swallow, true);
    window.addEventListener('contextmenu', swallow, true);
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('mousedown', down, true);
      window.removeEventListener('mouseup', swallow, true);
      window.removeEventListener('click', swallow, true);
      window.removeEventListener('contextmenu', swallow, true);
      window.removeEventListener('keydown', key, true);
    };
  }, [close]);

  // Propriétés à passer à l'infobulle affichée
  const cardProps = useMemo(
    () =>
      card && {
        locked: card.locked,
        dock: card.dock,
        setEl: (el) => (st.current.el = el),
        onEnter: () => {
          st.current.over = true;
          clearTimers();
        },
        onLeave: (e) => {
          st.current.over = false;
          if (st.current.card?.locked) return;
          if (e.relatedTarget instanceof Element && e.relatedTarget.closest('.term-popup')) return;
          hide();
        },
        onLock: (e) => {
          if (e.button !== 0 || st.current.card?.locked) return;
          setCard((p) => (p ? { ...p, locked: true } : p));
        },
        onClose: close,
      },
    [card, hide, close],
  );

  // Quand la souris quitte une définition ouverte depuis une carte non bloquée
  useEffect(() => {
    const onPopupLeave = (e) => {
      const to = e.detail?.to;
      if (to instanceof Element && st.current.el?.contains(to)) return;
      hide();
    };
    window.addEventListener('terms:popup-leave', onPopupLeave);
    return () => window.removeEventListener('terms:popup-leave', onPopupLeave);
  }, [hide]);

  return { card, show, open, follow, hide, close, cardProps };
}

/** Habillage commun : poignée de fermeture + indication « clic pour bloquer » */
export function CardChrome({ card }) {
  if (!card) return null;
  return card.locked ? (
    <>
      <button className="card-x" title="Fermer (Échap)" aria-label="Fermer la carte" onMouseDown={(e) => e.stopPropagation()} onClick={card.onClose}>
        ✕
      </button>
      <div className="card-hint locked">
        {isTouchInput()
          ? 'Touchez un mot souligné pour sa définition · touchez en dehors ou ✕ pour fermer'
          : "Carte bloquée · clic sur un mot souligné : sa définition s'ouvre à côté · clic en dehors ou Échap pour fermer"}
      </div>
    </>
  ) : (
    <div className="card-hint">Clic sur la carte : la bloquer · clic sur un mot souligné : sa définition à côté</div>
  );
}

/** Attributs à poser sur l'élément racine d'une infobulle-carte */
export function cardRootProps(card) {
  if (!card) return {};
  return {
    onMouseEnter: card.onEnter,
    onMouseLeave: card.onLeave,
    onMouseDown: card.onLock,
  };
}
