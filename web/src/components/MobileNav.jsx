// Téléphone : barre d'onglets en bas d'écran (remplace les boutons ronds de gauche et les raccourcis clavier)
// et menu « Menu » pour les autres panneaux et la langue des textes du jeu.
import { useEffect, useState } from 'react';
import { useLang } from '../lang.jsx';

const PATHS = {
  tree: (
    <>
      <circle cx="12" cy="5" r="2.5" />
      <circle cx="5" cy="18" r="2.5" />
      <circle cx="19" cy="18" r="2.5" />
      <path d="M10.8 7.2 6.2 15.8M13.2 7.2l4.6 8.6M7.5 18h9" />
    </>
  ),
  gem: (
    <>
      <path d="M6 3h12l4 6-10 12L2 9z" />
      <path d="M2 9h20M12 21 8 9l4-6 4 6z" />
    </>
  ),
  armour: <path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z" />,
  notes: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M14 3v5h5M9 12h7M9 16h7" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  builds: (
    <>
      <path d="M3 7h6l2 2h10v10H3z" />
      <path d="M3 7V5h6l2 2" />
    </>
  ),
  char: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </>
  ),
  book: (
    <>
      <path d="M12 6.5C10.5 5 8 4.5 4 4.5v14c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-14c-4 0-6.5.5-8 2z" />
      <path d="M12 6.5v14" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .9-1 1.6v.6M12 17.2v.1" />
    </>
  ),
};

export function NavIcon({ name, size = 22 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {PATHS[name]}
    </svg>
  );
}

const TABS = [
  { id: 'tree', label: 'Arbre', icon: 'tree' },
  { id: 'skills', label: 'Gemmes', icon: 'gem' },
  { id: 'items', label: 'Équipement', icon: 'armour' },
  { id: 'notes', label: 'Notes', icon: 'notes' },
];
const MORE = [
  { id: 'builds', label: 'Mes builds', icon: 'builds' },
  { id: 'stats', label: 'Personnage', icon: 'char' },
  { id: 'library', label: 'Bibliothèque', icon: 'book' },
  { id: 'help', label: 'Aide', icon: 'help' },
];

/** current : panneau ouvert (null = arbre passif) */
export default function MobileNav({ current, onOpen, onTree }) {
  const [more, setMore] = useState(false);
  const { lang, setLang } = useLang();
  const inMore = MORE.some((m) => m.id === current);

  // le menu se ferme dès qu'un panneau s'ouvre par un autre chemin (Claude, bibliothèque…)
  useEffect(() => setMore(false), [current]);

  return (
    <>
      {more && (
        <div className="m-sheet-back" onClick={() => setMore(false)}>
          <div className="m-sheet" role="dialog" aria-label="Menu" onClick={(e) => e.stopPropagation()}>
            <div className="m-sheet-grid">
              {MORE.map((m) => (
                <button
                  key={m.id}
                  className={`m-tile ${current === m.id ? 'on' : ''}`}
                  onClick={() => {
                    onOpen(m.id);
                    setMore(false);
                  }}
                >
                  <NavIcon name={m.icon} size={24} />
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
            <div className="m-sheet-row">
              <span>Langue des textes du jeu</span>
              <div className="lang-toggle" role="group" aria-label="Langue des textes du jeu">
                <button className={lang === 'fr' ? 'on' : ''} aria-pressed={lang === 'fr'} onClick={() => setLang('fr')}>FR</button>
                <button className={lang === 'en' ? 'on' : ''} aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
              </div>
            </div>
            <p className="small muted" style={{ margin: '6px 2px 0' }}>
              EN affiche les passifs, gemmes, objets et définitions en anglais officiel (pratique pour suivre un guide anglais). L'interface reste en français.
            </p>
          </div>
        </div>
      )}
      <nav className="mobile-nav" aria-label="Panneaux">
        {TABS.map((t) => {
          const on = !more && (t.id === 'tree' ? !current : current === t.id);
          return (
            <button
              key={t.id}
              className={on ? 'on' : ''}
              aria-current={on ? 'page' : undefined}
              onClick={() => {
                setMore(false);
                if (t.id === 'tree') onTree();
                else onOpen(t.id);
              }}
            >
              <NavIcon name={t.icon} />
              <span>{t.label}</span>
            </button>
          );
        })}
        <button className={more || inMore ? 'on' : ''} aria-expanded={more} aria-haspopup="dialog" onClick={() => setMore((v) => !v)}>
          <NavIcon name="menu" />
          <span>Menu</span>
        </button>
      </nav>
    </>
  );
}
