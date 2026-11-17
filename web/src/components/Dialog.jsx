// Fenêtres de confirmation et de saisie dans le style de l'outil (remplacent confirm() / prompt() du navigateur).
//   const dialog = useDialog();
//   if (!(await dialog.confirm('Supprimer ce build ?', { okLabel: 'Supprimer', danger: true }))) return;
//   const name = await dialog.prompt('Nom du nouveau build :', 'Nouveau build'); // null si annulé
// Clavier : Entrée valide, Échap annule, Tab reste dans la fenêtre ; le focus revient ensuite où il était.
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';

const Ctx = createContext(null);
export const useDialog = () => useContext(Ctx);

export function DialogProvider({ children }) {
  const [queue, setQueue] = useState([]); // une fenêtre à la fois, les suivantes attendent
  const nextId = useRef(0);
  const open = useCallback((d) => new Promise((resolve) => setQueue((q) => [...q, { ...d, id: nextId.current++, resolve }])), []);
  const api = useMemo(
    () => ({
      confirm: (message, opts = {}) => open({ kind: 'confirm', message, ...opts }),
      prompt: (message, value = '', opts = {}) => open({ kind: 'prompt', message, value, ...opts }),
    }),
    [open],
  );
  const current = queue[0];
  const done = (result) => {
    current.resolve(result);
    setQueue((q) => q.slice(1));
  };
  return (
    <Ctx.Provider value={api}>
      {children}
      {current && <DialogBox key={current.id} dlg={current} onDone={done} />}
    </Ctx.Provider>
  );
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

function DialogBox({ dlg, onDone }) {
  const prompt = dlg.kind === 'prompt';
  const [value, setValue] = useState(dlg.value ?? '');
  const ref = useRef(null);
  const titleId = useId();
  const msgId = useId();
  const cancel = () => onDone(prompt ? null : false);
  const ok = () => {
    if (!prompt) return onDone(true);
    const v = value.trim();
    if (v) onDone(v);
  };

  useEffect(() => {
    const before = document.activeElement;
    // saisie : le texte est sélectionné pour être remplacé d'un coup ; suppression : le focus va sur « Annuler » par prudence
    const el = ref.current?.querySelector(prompt ? 'input' : dlg.danger ? '[data-cancel]' : '[data-ok]');
    el?.focus();
    if (prompt) el?.select();
    return () => {
      if (before?.isConnected) before.focus?.({ preventScroll: true });
    };
  }, []);

  const onKeyDown = (e) => {
    // les raccourcis de l'outil (Échap, lettres) ne doivent pas agir derrière la fenêtre
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    } else if (e.key === 'Tab') {
      const els = [...ref.current.querySelectorAll(FOCUSABLE)];
      if (!els.length) return;
      const i = els.indexOf(document.activeElement);
      const next = e.shiftKey ? (i <= 0 ? els.length - 1 : i - 1) : i === els.length - 1 ? 0 : i + 1;
      e.preventDefault();
      els[next].focus();
    }
  };

  return (
    <div className="modal-back dialog-back" onMouseDown={(e) => e.target === e.currentTarget && cancel()}>
      <div
        ref={ref}
        className="window modal dialog"
        role={dlg.danger ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={msgId}
        onKeyDown={onKeyDown}
      >
        <div className="window-title" id={titleId}>
          {dlg.title || (prompt ? 'Nom' : 'Confirmation')}
        </div>
        <form
          className="window-body"
          onSubmit={(e) => {
            e.preventDefault();
            ok();
          }}
        >
          <p id={msgId} className="dialog-msg">
            {dlg.message}
          </p>
          {dlg.detail && <p className="small muted dialog-detail">{dlg.detail}</p>}
          {prompt && (
            <input
              className="input dialog-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={120}
              aria-labelledby={msgId}
              enterKeyHint="done"
              autoComplete="off"
            />
          )}
          <div className="dialog-actions">
            <button type="button" className="btn ghost" data-cancel onClick={cancel}>
              {dlg.cancelLabel || 'Annuler'}
            </button>
            <button type="submit" className={`btn ${dlg.danger ? 'danger' : ''}`} data-ok disabled={prompt && !value.trim()}>
              {dlg.okLabel || 'OK'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
