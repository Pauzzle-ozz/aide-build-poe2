import { useEffect, useState } from 'react';
import Window from '../components/Window.jsx';
import Markdown from '../components/Markdown.jsx';

export default function NotesPanel({ build, doOps, onClose }) {
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState(build.notes || '');
  useEffect(() => {
    if (!edit) setText(build.notes || '');
  }, [build.notes, edit]);
  const save = () => {
    if (text !== (build.notes || '')) doOps({ op: 'setNotes', notes: text });
    setEdit(false);
  };
  return (
    <Window
      title="Notes du build"
      side="right"
      onClose={onClose}
      tabs={
        edit ? (
          <>
            <button className="btn small" onClick={save}>Enregistrer</button>
            <button className="btn small ghost" onClick={() => { setText(build.notes || ''); setEdit(false); }}>Annuler</button>
          </>
        ) : (
          <button className="btn small" onClick={() => setEdit(true)}>Modifier</button>
        )
      }
    >
      {edit ? (
        <textarea className="input notes" value={text} onChange={(e) => setText(e.target.value)} autoFocus placeholder={'# Mon build\n\n## Progression\n- Niveaux 1-12 : ...\n\nMarkdown simple accepté.'} />
      ) : build.notes ? (
        <Markdown text={build.notes} />
      ) : (
        <div className="empty">
          Pas encore de notes. Écrivez votre plan de progression ici, ou demandez à Claude d'expliquer le build : il écrira directement dans ce panneau.
        </div>
      )}
    </Window>
  );
}
