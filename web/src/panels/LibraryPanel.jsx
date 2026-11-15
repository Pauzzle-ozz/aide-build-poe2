import { useEffect, useMemo, useRef, useState } from 'react';
import Window from '../components/Window.jsx';
import { PassiveTooltip, ItemTooltip, GemTooltip } from '../components/Tooltips.jsx';
import { GemIcon } from './SkillsPanel.jsx';
import { img } from '../api.js';
import { gemClassLabel } from '../gem-classes.js';
import { SLOT_LABEL } from '@core/build-model.mjs';
import { passiveSections, gemSections, uniqueSections, baseSections, THEMES, itemLevel, defenceLabel } from '../library-sections.js';

const TABS = [
  ['passives', 'Passifs'],
  ['gems', 'Gemmes'],
  ['uniques', 'Uniques'],
  ['bases', 'Bases'],
];
const TYPE_FR = { notable: 'Notable', keystone: 'Clé de voûte', normal: 'Petit passif', jewel: 'Emplacement de joyau' };
const KIND_FR = { skill: 'Aptitude', support: 'Soutien', spirit: 'Esprit', meta: 'Méta', lineage: 'Lignage' };
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function LibraryPanel({ data, build, doOps, onClose, setFocusCmd, setHighlight, openPanel, query }) {
  const { graph } = data;
  const [cls, setCls] = useState(build.class);
  const [tab, setTab] = useState('gems');
  const [q, setQ] = useState('');
  const [theme, setTheme] = useState('all');
  const [sel, setSel] = useState(null);
  const [closed, setClosed] = useState({});
  const listRef = useRef(null);

  useEffect(() => {
    if (query?.q) {
      setQ(query.q);
      setCls('all');
    }
  }, [query]);
  useEffect(() => {
    setSel(null);
    listRef.current?.scrollTo(0, 0);
  }, [cls, tab]);

  const lib = useMemo(() => ({ ...data, baseSubType: new Map(data.items.bases.map((b) => [b.nameEn, b.pob?.subType])) }), [data]);
  const dist = useMemo(() => (cls === 'all' ? null : graph.distances({ class: cls, ascendancy: null, tree: { nodes: [] } })), [cls, graph]);

  const sections = useMemo(() => {
    let secs;
    if (tab === 'passives') secs = passiveSections(lib, cls, { theme, dist });
    else if (tab === 'gems') secs = gemSections(lib, cls);
    else if (tab === 'uniques') secs = uniqueSections(lib, cls);
    else secs = baseSections(lib, cls);
    const n = norm(q.trim());
    if (n) {
      const hay = (it) =>
        norm([it.name, it.nameEn, it.base, it.classFr, it.category, ...(it.stats || []), ...(it.tags || []), ...(it.explicits || []), ...(it.implicits || []), it.description].join(' '));
      secs = secs.map((s) => ({ ...s, items: s.items.filter((it) => n.split(' ').every((w) => hay(it).includes(w))) }));
    }
    // masquer les sections vides (et les titres sans contenu)
    const out = [];
    for (let i = 0; i < secs.length; i++) {
      const s = secs[i];
      if (s.depth === 1) {
        let total = 0;
        for (let j = i + 1; j < secs.length && secs[j].depth !== 1; j++) total += secs[j].items.length;
        if (total) out.push({ ...s, total });
      } else if (s.items.length) out.push(s);
    }
    return out;
  }, [tab, cls, q, theme, lib, dist]);

  const total = sections.filter((s) => s.depth === 2).reduce((a, s) => a + s.items.length, 0);
  const firstCommon = sections.find((s) => s.common)?.id;
  const goTo = (id) => {
    setClosed((c) => ({ ...c, [id]: false }));
    document.getElementById(`lib-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const showInTree = (node) => {
    const ids = node.ids || [node.id];
    setHighlight({ ids, until: Date.now() + 8000 });
    setFocusCmd({ node: ids[0], zoom: ids.length > 1 ? 0.03 : undefined, t: Date.now() });
    onClose();
  };

  return (
    <Window title="Bibliothèque" side="center" onClose={onClose} className="library">
      {/* Choix du personnage */}
      <div className="lib-classes">
        <span className="lib-label">Personnage</span>
        {graph.classes.map((c) => (
          <button key={c.id} className={`lib-class ${cls === c.id ? 'on' : ''}`} onClick={() => setCls(c.id)} title={`${c.name} : ${c.ascendancies.map((a) => a.name).join(', ')}`}>
            <span className="portrait" style={{ backgroundImage: c.background ? `url(/assets/${c.background.image})` : undefined }} />
            <span className="nm">{c.name}</span>
            {c.id === build.class && <span className="mine">votre build</span>}
          </button>
        ))}
        <button className={`lib-class all ${cls === 'all' ? 'on' : ''}`} onClick={() => setCls('all')}>
          <span className="portrait">✦</span>
          <span className="nm">Toutes</span>
        </button>
      </div>

      <div className="row wrap" style={{ margin: '8px 0', gap: 6 }}>
        {TABS.map(([id, label]) => (
          <button key={id} className={`btn ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
        <input className="input grow" style={{ minWidth: 200 }} placeholder="Filtrer (nom, effet, mot-clé…)" value={q} onChange={(e) => setQ(e.target.value)} />
        {tab === 'passives' && (
          <select className="input" value={theme} onChange={(e) => setTheme(e.target.value)} title="Thème des passifs">
            {THEMES.map(([k]) => <option key={k} value={k}>{k === 'all' ? 'Tous les thèmes' : k}</option>)}
          </select>
        )}
        <span className="small muted">{total} élément(s)</span>
      </div>

      <div className="lib-body">
        {/* Sommaire */}
        <nav className="lib-nav">
          {sections.map((s, i) => {
            if (s.depth === 1) {
              return (
                <div key={s.id}>
                  {s.id === firstCommon && <div className="lib-nav-sep">Communs à toutes les classes</div>}
                  <div className={`lib-nav-h ${s.common ? 'common' : ''}`} onClick={() => goTo(s.id)}>
                    {s.title} <span className="cnt">{s.total}</span>
                  </div>
                </div>
              );
            }
            // intertitre quand le groupe change (« Gemmes d'aptitude », « Gemmes d'esprit », « Soutiens rouges »…)
            const group = s.title.includes(' — ') ? s.title.split(' — ')[0] : null;
            const prev = sections[i - 1];
            const prevGroup = prev && prev.depth === 2 && prev.title.includes(' — ') ? prev.title.split(' — ')[0] : null;
            return (
              <div key={s.id}>
                {group && group !== prevGroup && <div className="lib-nav-g">{group}</div>}
                <div className={`lib-nav-i ${group ? 'sub' : ''}`} onClick={() => goTo(s.id)}>
                  {group ? s.title.split(' — ')[1] : s.title} <span className="cnt">{s.items.length}</span>
                </div>
              </div>
            );
          })}
          {!sections.length && <div className="empty">Rien ne correspond.</div>}
        </nav>

        {/* Liste rangée */}
        <div className="lib-list" ref={listRef}>
          {sections.map((s) =>
            s.depth === 1 ? (
              <div key={s.id} id={`lib-${s.id}`} className={`lib-h1 ${s.common ? 'common' : ''}`}>
                {s.id === firstCommon && cls !== 'all' && <div className="lib-common-banner">Éléments communs à toutes les classes</div>}
                <div className="t">{s.title}</div>
                {s.hint && <div className="h">{s.hint}</div>}
              </div>
            ) : (
              <div key={s.id} id={`lib-${s.id}`} className="lib-sec">
                <div className="lib-h2" onClick={() => setClosed((c) => ({ ...c, [s.id]: !c[s.id] }))}>
                  <span className="arrow">{closed[s.id] ? '▸' : '▾'}</span> {s.title}
                  <span className="cnt">{s.items.length}</span>
                  {s.hint && <span className="h">{s.hint}</span>}
                </div>
                {!closed[s.id] && (
                  <div className={`lib-grid ${tab}`}>
                    {s.items.map((it) => (
                      <Entry key={`${s.id}-${it.id}`} tab={tab} it={it} graph={graph} dist={dist} on={sel?.it?.id === it.id} onClick={() => setSel({ it, sec: s })} />
                    ))}
                  </div>
                )}
              </div>
            ),
          )}
        </div>

        {/* Détails */}
        <div className="lib-detail">
          {!sel ? (
            <div className="empty">
              Choisissez un élément.
              <p className="small">
                Le personnage choisi en haut range tout : d'abord ce qui est propre à la classe (ascendances, famille de gemmes, armes et armures adaptées), puis, en bas, ce qui est commun à toutes les classes.
              </p>
            </div>
          ) : (
            <Detail tab={tab} sel={sel} data={data} build={build} cls={cls} dist={dist} doOps={doOps} openPanel={openPanel} showInTree={showInTree} lib={lib} />
          )}
        </div>
      </div>
    </Window>
  );
}

function Entry({ tab, it, graph, dist, on, onClick }) {
  if (tab === 'passives') {
    const d = dist?.get(it.id);
    return (
      <div className={`lib-entry ${on ? 'on' : ''} t-${it.type}`} onClick={onClick}>
        <div className="title">
          {it.name}
          {it.copies > 1 && <span className="muted small"> ×{it.copies}</span>}
        </div>
        <div className="sub">{it.stats.slice(0, 2).join(' · ') || TYPE_FR[it.type]}</div>
        {d != null && !it.ascendancy && <span className="pts">{d} pt{d > 1 ? 's' : ''}</span>}
      </div>
    );
  }
  if (tab === 'gems') {
    return (
      <div className={`lib-entry ${on ? 'on' : ''}`} onClick={onClick}>
        <GemIcon gem={it} support={it.kind === 'support' || it.kind === 'lineage'} />
        <div style={{ minWidth: 0 }}>
          <div className={`title gem-${it.color}`}>{it.name}</div>
          <div className="sub">{it.tags.slice(0, 4).join(', ')}</div>
        </div>
      </div>
    );
  }
  const unique = tab === 'uniques';
  return (
    <div className={`lib-entry ${on ? 'on' : ''}`} onClick={onClick}>
      {it.iconUrl && <img className="thumb" src={img(it.iconUrl)} alt="" loading="lazy" />}
      <div style={{ minWidth: 0 }}>
        <div className="title" style={{ color: unique ? '#cf8a4a' : undefined }}>{it.name}</div>
        <div className="sub">
          {unique ? it.base : defenceLabel(it.pob?.subType) || it.classFr} · niv. {itemLevel(it)}
        </div>
      </div>
    </div>
  );
}

function Detail({ tab, sel, data, build, cls, dist, doOps, openPanel, showInTree, lib }) {
  const { graph } = data;
  const it = sel.it;
  if (tab === 'passives') {
    const sameClass = cls === build.class || cls === 'all';
    const canAlloc = sameClass && !build.tree.nodes.includes(it.id) && graph.isAllocatable(it, build);
    const d = dist?.get(it.id);
    return (
      <>
        <div className="lib-where">{it.ascendancy ? `Ascendance ${graph.ascById[it.ascendancy]?.name} (${graph.classById[graph.ascById[it.ascendancy]?.classId]?.name})` : `Arbre commun${d != null ? ` · à ${d} point(s) du départ` : ''}`}{it.copies > 1 ? ` · présent ${it.copies} fois dans l'arbre` : ''}</div>
        <PassiveTooltip node={it} graph={graph} build={build} floating={false} />
        <div className="row wrap" style={{ marginTop: 8, justifyContent: 'center' }}>
          <button className="btn small" onClick={() => showInTree(it)}>{it.copies > 1 ? `Voir les ${it.copies} dans l'arbre` : "Voir dans l'arbre"}</button>
          {canAlloc && <button className="btn small" onClick={() => doOps({ op: 'allocate', nodes: [it.id] })}>Allouer (avec chemin)</button>}
        </div>
        {!sameClass && <p className="small muted" style={{ textAlign: 'center' }}>Le build ouvert est un {graph.classById[build.class]?.name} : allocation possible seulement pour sa classe.</p>}
      </>
    );
  }
  if (tab === 'gems') {
    return (
      <>
        <div className="lib-where">{gemClassLabel(it, graph)}{it.tier ? ` · palier ${it.tier}` : ''}</div>
        <GemTooltip gem={it} floating={false} />
        <div className="row" style={{ marginTop: 8, justifyContent: 'center' }}>
          {it.kind !== 'support' && it.kind !== 'lineage' && (
            <button className="btn small" onClick={() => { doOps({ op: 'addSkill', gems: [it.id] }); openPanel('skills'); }}>Ajouter au build</button>
          )}
        </div>
        {(it.kind === 'support' || it.kind === 'lineage') && <p className="small muted" style={{ textAlign: 'center' }}>Ajoutez-la depuis le panneau Gemmes (G) : seuls les soutiens compatibles avec chaque aptitude y sont proposés.</p>}
      </>
    );
  }
  const unique = tab === 'uniques';
  const sub = unique ? lib.baseSubType.get(it.baseEn) : it.pob?.subType;
  return (
    <>
      <div className="lib-where">
        {it.classFr}
        {sub ? ` · défense : ${defenceLabel(sub)}` : ''} · niveau {itemLevel(it)}
      </div>
      <ItemTooltip item={unique ? { ...it, rarity: 'UNIQUE', implicitsFr: it.implicits, explicitsFr: it.explicits } : { ...it, rarity: 'NORMAL' }} floating={false} showEn />
      {unique && (
        <div className="row wrap" style={{ marginTop: 8, justifyContent: 'center' }}>
          {it.slots.filter((s) => s !== 'Jewel').map((slot) => (
            <button key={slot} className="btn small" onClick={() => { doOps({ op: 'equip', slot, unique: it.id }); openPanel('items'); }}>Équiper : {SLOT_LABEL[slot] || slot}</button>
          ))}
        </div>
      )}
    </>
  );
}
