import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TreeGraph } from '@core/tree-logic.mjs';
import { api, get, post, connectWs, WEB } from './api.js';
import TreeView from './components/TreeView.jsx';
import TopBar from './components/TopBar.jsx';
import Markdown from './components/Markdown.jsx';
import ItemsPanel from './panels/ItemsPanel.jsx';
import SkillsPanel from './panels/SkillsPanel.jsx';
import StatsPanel from './panels/StatsPanel.jsx';
import NotesPanel from './panels/NotesPanel.jsx';
import LibraryPanel from './panels/LibraryPanel.jsx';
import HelpPanel from './panels/HelpPanel.jsx';
import BuildsPanel from './panels/BuildsPanel.jsx';
import { TermsProvider } from './components/Terms.jsx';
import { LangCtx, readLang, saveLang, englishView, labelsFor } from './lang.jsx';

const PANELS = [
  { id: 'builds', key: 'M', label: 'Mes builds', side: 'center' },
  { id: 'items', key: 'I', label: 'Équipement', side: 'right' },
  { id: 'skills', key: 'G', label: 'Gemmes', side: 'left' },
  { id: 'stats', key: 'C', label: 'Personnage', side: 'left' },
  { id: 'notes', key: 'N', label: 'Notes', side: 'right' },
  { id: 'library', key: 'B', label: 'Bibliothèque', side: 'center' },
  { id: 'help', key: '?', label: WEB ? 'Aide' : 'Aide & Claude', side: 'center' },
];

/** Version en ligne : messages affichés à l'arrivée (première visite, mémoire du navigateur bloquée) */
function webNotices(state) {
  const out = [];
  if (state.persistent === false) {
    out.push({
      id: 'memoire',
      title: 'Attention : rien ne sera gardé',
      text: "Votre navigateur bloque l'enregistrement pour ce site (navigation privée ou cookies refusés) : vos builds seront **perdus en fermant la page**. Avant de partir, téléchargez une sauvegarde dans « Mes builds » (touche M).",
    });
  } else if (state.firstVisit) {
    out.push({
      id: 'bienvenue',
      title: 'Bienvenue',
      text: [
        'Vos builds sont enregistrés **dans ce navigateur, sur cet appareil** : ils vous attendent à votre prochaine visite, sans compte à créer.',
        "Quatre builds d'exemple (Moine Foudre, du niveau 1 au niveau 90) sont déjà dans « Mes builds » (touche M) : modifiez-les ou supprimez-les librement.",
        "Pour ne rien perdre, téléchargez de temps en temps une sauvegarde (« Mes builds » → « Télécharger une sauvegarde »). L'aide (touche H) explique le reste.",
      ].join('\n\n'),
    });
  }
  return out;
}

export default function App() {
  const [raw, setRaw] = useState(null);
  const [lang, setLangState] = useState(readLang);
  const setLang = useCallback((l) => {
    saveLang(l);
    setLangState(l);
  }, []);
  // données dans la langue choisie (textes officiels anglais ou français du jeu)
  const data = useMemo(() => (raw && lang === 'en' ? englishView(raw) : raw), [raw, lang]);
  const langValue = useMemo(() => ({ lang, setLang, view: data, raw, L: labelsFor(lang) }), [lang, setLang, data, raw]);
  const [error, setError] = useState(null);
  const [build, setBuild] = useState(null);
  const [builds, setBuilds] = useState([]);
  const [connected, setConnected] = useState(false);
  const [panels, setPanels] = useState({ left: null, right: null, center: null });
  const [focusCmd, setFocusCmd] = useState(null);
  const [highlight, setHighlight] = useState(null);
  const [messages, setMessages] = useState([]);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');
  const [libraryQuery, setLibraryQuery] = useState(null);
  const [itemsSlot, setItemsSlot] = useState(null);
  const buildRef = useRef(null);
  buildRef.current = build;

  const showToast = useCallback((text, kind = 'info') => {
    setToast({ text, kind, id: Date.now() });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.kind === 'error' ? 6000 : 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // --- Chargement des données
  useEffect(() => {
    (async () => {
      try {
        const [tree, gems, items, sprites, state, list, glossary] = await Promise.all([
          get('/data/tree.json'),
          get('/data/gems.json'),
          get('/data/items.json'),
          get('/assets/sprites.json'),
          get('/api/state'),
          get('/api/builds'),
          get('/data/glossary.json').catch(() => ({ entries: {}, forms: {} })),
        ]);
        const graph = new TreeGraph(tree);
        const gemsById = new Map(gems.map((g) => [g.id, g]));
        setRaw({ tree, graph, gems, gemsById, items, sprites, glossary });
        setBuilds(list);
        setBuild(await get(`/api/builds/${state.activeBuildId}`));
        if (state.web) setMessages(webNotices(state));
      } catch (e) {
        setError(String(e.message || e));
      }
    })();
  }, []);

  const openPanel = useCallback((id) => {
    const p = PANELS.find((x) => x.id === id);
    if (!p) return;
    setPanels((cur) => ({ ...cur, [p.side]: cur[p.side] === id ? null : id, ...(p.side === 'center' ? {} : { center: null }) }));
  }, []);
  const forcePanel = useCallback((id) => {
    const p = PANELS.find((x) => x.id === id);
    if (!p) return;
    setPanels((cur) => ({ ...cur, [p.side]: id, ...(p.side === 'center' ? {} : { center: null }) }));
  }, []);

  // --- Temps réel
  useEffect(() => {
    return connectWs(async (msg) => {
      if (msg.type === 'hello') {
        // (re)connexion : on resynchronise la liste et le build actif (des builds ont pu être créés entre-temps)
        setBuilds(await get('/api/builds'));
        if (msg.activeBuildId && msg.activeBuildId !== buildRef.current?.id) setBuild(await get(`/api/builds/${msg.activeBuildId}`));
      } else if (msg.type === 'build') {
        if (buildRef.current && msg.build.id === buildRef.current.id) setBuild(msg.build);
        if (msg.source === 'claude') setBuilds(await get('/api/builds'));
      } else if (msg.type === 'list') setBuilds(msg.list);
      else if (msg.type === 'active') {
        if (msg.activeBuildId !== buildRef.current?.id) setBuild(await get(`/api/builds/${msg.activeBuildId}`));
      } else if (msg.type === 'ui') handleUi(msg);
    }, setConnected);
  }, []);

  function handleUi(msg) {
    if (msg.action === 'message') {
      setMessages((m) => [...m.slice(-4), { id: Date.now() + Math.random(), title: msg.title, text: msg.text }]);
      return;
    }
    if (msg.action === 'focus') {
      if (msg.panel === 'tree') setPanels((p) => ({ ...p, center: null }));
      else if (msg.panel) forcePanel(msg.panel);
      if (msg.slot) setItemsSlot(msg.slot);
      if (msg.search) {
        forcePanel('library');
        setLibraryQuery({ q: msg.search, t: Date.now() });
      }
      const ids = msg.highlight || msg.preview || (msg.node ? [msg.node] : null);
      if (ids?.length) setHighlight({ ids: ids.map(Number), until: Date.now() + 9000 });
      if (msg.node || ids?.length) setFocusCmd({ node: msg.node, highlight: ids, zoom: msg.zoom, t: Date.now() });
    }
  }

  // --- Opérations sur le build
  const doOps = useCallback(async (ops, { quiet } = {}) => {
    const b = buildRef.current;
    if (!b) return null;
    try {
      const r = await post(`/api/builds/${b.id}/ops`, { ops: Array.isArray(ops) ? ops : [ops], source: 'ui' });
      setBuild(r.build);
      const errs = r.results.flatMap((x) => x?.errors || []);
      if (errs.length && !quiet) showToast(errs.join(' · '), 'error');
      return r;
    } catch (e) {
      showToast(e.message, 'error');
      return null;
    }
  }, [showToast]);

  const refreshList = useCallback(async () => setBuilds(await get('/api/builds')), []);
  const switchBuild = useCallback(async (id) => {
    await post(`/api/builds/${id}/activate`);
    setBuild(await get(`/api/builds/${id}`));
  }, []);

  // --- Raccourcis clavier (comme en jeu)
  useEffect(() => {
    const onKey = (e) => {
      if (e.target?.closest?.('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toUpperCase();
      if (k === 'ESCAPE') setPanels({ left: null, right: null, center: null });
      else if (k === 'P') setPanels({ left: null, right: null, center: null });
      else {
        const p = PANELS.find((x) => x.key === k || (k === 'L' && x.id === 'library') || (k === 'H' && x.id === 'help'));
        if (p) {
          e.preventDefault(); // évite que la lettre du raccourci s'écrive dans le champ de recherche du panneau
          openPanel(p.id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openPanel]);

  if (error) {
    return (
      <div style={{ padding: 40 }}>
        <h2 style={{ fontFamily: 'var(--font-title)', color: 'var(--gold-2)' }}>Impossible de charger les données</h2>
        <p>{error}</p>
        {WEB ? (
          <p className="muted">Vérifiez votre connexion à Internet, puis rechargez la page.</p>
        ) : (
          <p className="muted">Lancez <code>npm run setup</code> dans le dossier du projet, puis <code>npm start</code>.</p>
        )}
      </div>
    );
  }
  if (!data || !build) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100%', fontFamily: 'var(--font-title)', color: 'var(--gold)', letterSpacing: '0.1em' }}>
        Chargement de l'arbre passif…
      </div>
    );
  }

  const ctx = { data, build, doOps, showToast, openPanel: forcePanel, setFocusCmd, setHighlight, builds, refreshList, setBuild };
  const renderPanel = (id) => {
    const close = () => setPanels((p) => ({ ...p, [PANELS.find((x) => x.id === id).side]: null }));
    switch (id) {
      case 'items': return <ItemsPanel {...ctx} onClose={close} selectedSlot={itemsSlot} setSelectedSlot={setItemsSlot} />;
      case 'skills': return <SkillsPanel {...ctx} onClose={close} />;
      case 'stats': return <StatsPanel {...ctx} onClose={close} />;
      case 'notes': return <NotesPanel {...ctx} onClose={close} />;
      case 'library': return <LibraryPanel {...ctx} onClose={close} query={libraryQuery} />;
      case 'help': return <HelpPanel {...ctx} onClose={close} connected={connected} />;
      case 'builds': return <BuildsPanel {...ctx} onClose={close} />;
      default: return null;
    }
  };

  const termLibrary = (q) => {
    forcePanel('library');
    setLibraryQuery({ q, t: Date.now() });
  };
  const termNode = (id) => {
    setPanels({ left: null, right: null, center: null });
    setHighlight({ ids: [id], until: Date.now() + 8000 });
    setFocusCmd({ node: id, t: Date.now() });
  };

  return (
    <LangCtx.Provider value={langValue}>
    <TermsProvider data={data} onLibrary={termLibrary} onNode={termNode}>
    <div className="app">
      <TopBar
        {...ctx}
        connected={connected}
        refreshList={refreshList}
        switchBuild={switchBuild}
        setBuild={setBuild}
      />
      <div className="main">
        <TreeView
          tree={data.tree}
          graph={data.graph}
          sprites={data.sprites}
          build={build}
          focusCmd={focusCmd}
          search={search}
          highlight={highlight}
          onAllocate={(id, attribute) => doOps(attribute ? [{ op: 'allocate', nodes: [id] }, { op: 'setAttribute', node: id, attribute }] : [{ op: 'allocate', nodes: [id] }])}
          onDeallocate={(id) => doOps({ op: 'deallocate', nodes: [id] })}
          onSetAttribute={(id, attribute) => doOps({ op: 'setAttribute', node: id, attribute })}
        />
        <div className="tree-search">
          <input className="input" placeholder="Rechercher dans l'arbre (ex : critique, vie, Résolution…)" value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button className="btn small ghost" onClick={() => setSearch('')}>✕</button>}
          {highlight && <button className="btn small" onClick={() => setHighlight(null)} title="Effacer le surlignage de Claude">Effacer ✦</button>}
        </div>
        <div className="sidenav">
          <button className={!panels.left && !panels.right && !panels.center ? 'on' : ''} onClick={() => setPanels({ left: null, right: null, center: null })}>
            P<span className="tip">Arbre passif (P / Échap)</span>
          </button>
          {PANELS.map((p) => (
            <button key={p.id} className={panels[p.side] === p.id ? 'on' : ''} onClick={() => openPanel(p.id)}>
              {p.key}
              <span className="tip">{p.label} ({p.key === '?' ? 'H' : p.key})</span>
            </button>
          ))}
        </div>
        <div className="tree-legend">Glisser : déplacer · Molette : zoom · Clic : allouer / retirer · Clic droit (attribut) : changer</div>
        {panels.left && renderPanel(panels.left)}
        {panels.right && renderPanel(panels.right)}
        {panels.center && renderPanel(panels.center)}
        <div className="claude-stack">
          {messages.map((m) => (
            <div key={m.id} className="claude-msg">
              <div className="head">
                <span>✦ {m.title || 'Claude'}</span>
                <span className="x" onClick={() => setMessages((l) => l.filter((x) => x.id !== m.id))}>✕</span>
              </div>
              <div className="body">
                <Markdown text={m.text} />
              </div>
            </div>
          ))}
        </div>
        {toast && <div key={toast.id} className={`toast ${toast.kind}`}>{toast.text}</div>}
      </div>
    </div>
    </TermsProvider>
    </LangCtx.Provider>
  );
}
