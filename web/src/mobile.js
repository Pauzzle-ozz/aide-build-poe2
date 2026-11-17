// Téléphone / tablette : mise en page « mobile » et type de pointeur (doigt ou souris).
import { useEffect, useState } from 'react';

// Même requête que dans styles.css (@media) : écran étroit, ou téléphone tenu à l'horizontale
export const MOBILE_MQ = '(max-width: 820px), (pointer: coarse) and (max-height: 520px)';

const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(MOBILE_MQ) : null;

/** true quand l'interface passe en mise en page mobile (barre d'onglets en bas, panneaux plein écran) */
export function useIsMobile() {
  const [mobile, setMobile] = useState(() => !!mq?.matches);
  useEffect(() => {
    if (!mq) return;
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return mobile;
}

// Dernier pointeur utilisé : après un toucher, le navigateur simule des évènements souris
// (survol, clic) qu'il faut ignorer pour les infobulles prévues pour la souris.
let lastType = 'mouse';
let installed = false;
export function installPointerTracking() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const set = (e) => {
    const t = e.pointerType === 'mouse' ? 'mouse' : 'touch';
    if (t === lastType) return;
    lastType = t;
    document.documentElement.dataset.pointer = t;
  };
  window.addEventListener('pointerdown', set, true);
  window.addEventListener('pointermove', set, true);
}

/** true si la dernière interaction s'est faite au doigt (ou au stylet) */
export const isTouchInput = () => lastType === 'touch';
