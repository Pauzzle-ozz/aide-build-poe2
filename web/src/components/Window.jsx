import { useRef, useState } from 'react';
import { useIsMobile } from '../mobile.js';

// Largeur choisie pour chaque panneau de côté (mémorisée dans ce navigateur)
const storeKey = (id) => `aide-poe2-largeur-${id}`;
const readWidth = (id) => {
  try {
    const v = Number(localStorage.getItem(storeKey(id)));
    return v > 0 ? v : null;
  } catch {
    return null;
  }
};
const saveWidth = (id, w) => {
  try {
    if (w) localStorage.setItem(storeKey(id), String(w));
    else localStorage.removeItem(storeKey(id));
  } catch {}
};

const MIN_W = 320;

export default function Window({ title, side = 'left', wide, onClose, children, tabs, className = '', id }) {
  const ref = useRef(null);
  const mobile = useIsMobile(); // sur téléphone, les panneaux prennent tout l'écran
  const resizable = !mobile && (side === 'left' || side === 'right');
  const key = id || title;
  const [width, setWidth] = useState(() => (side === 'left' || side === 'right' ? readWidth(key) : null));

  // Poignée sur le bord intérieur : glisser pour agrandir / rétrécir, double-clic pour revenir à la taille normale
  const startResize = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = ref.current.getBoundingClientRect().width;
    let latest = startW;
    const max = () => window.innerWidth - (side === 'left' ? 68 : 14) - 60;
    const move = (ev) => {
      const dx = ev.clientX - startX;
      latest = Math.round(Math.min(max(), Math.max(MIN_W, startW + (side === 'left' ? dx : -dx))));
      setWidth(latest);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.classList.remove('resizing');
      saveWidth(key, latest);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    document.body.classList.add('resizing');
  };
  const resetWidth = () => {
    setWidth(null);
    saveWidth(key, null);
  };

  const style = resizable && width ? { width: Math.min(width, window.innerWidth - 90) } : undefined;
  return (
    <div ref={ref} className={`window ${side} ${wide ? 'wide' : ''} ${className}`} style={style} onMouseDown={(e) => e.stopPropagation()}>
      {resizable && (
        <div
          className={`window-resize ${side}`}
          onPointerDown={startResize}
          onDoubleClick={resetWidth}
          title="Glisser pour agrandir ou rétrécir le panneau · double-clic : taille normale"
        />
      )}
      <div className="window-title">
        {title}
        {onClose && (
          <button className="window-close" onClick={onClose} title="Fermer (Échap)" aria-label="Fermer le panneau">
            ✕
          </button>
        )}
      </div>
      {tabs && <div className="window-tabs">{tabs}</div>}
      <div className="window-body">{children}</div>
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div className="window modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="window-title">
          {title}
          <button className="window-close" onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        <div className="window-body">{children}</div>
      </div>
    </div>
  );
}
