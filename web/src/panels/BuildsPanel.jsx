import { useEffect, useMemo, useRef, useState } from 'react';
import Window from '../components/Window.jsx';
import Markdown from '../components/Markdown.jsx';
import { GemIcon } from './SkillsPanel.jsx';
import { api, get, post, img, WEB } from '../api.js';
import { summarizeBuild } from '@core/build-model.mjs';
import { useLang } from '../lang.jsx';
import { SANDBOX_ID, openSandbox, saveSandbox } from '../sandbox.js';

const RARITY_COLOR = { UNIQUE: '#cf8a4a', RARE: 'var(--rare)', MAGIC: 'var(--magic)', NORMAL: 'var(--normal)' };

/** Panneau « Mes builds » : tous les builds, et le détail trié (arbre, gemmes, équipement, notes) du build choisi */
export default function BuildsPanel({ data, build, builds, onClose, openPanel, setFocusCmd, setHighlight, refreshList, setBuild, showToast }) {
  const { graph } = data;
  const [q, setQ] = useState('');
  const [selId, setSelId] = useState(build.id);
  const [sel, setSel] = useState(null);

  useEffect(() => {
    refreshList();
  }, []);
  useEffect(() => {
    if (!selId) return;
    if (selId === build.id) setSel(build);
    else get(`/api/builds/${selId}`).then(setSel).catch(() => setSel(null));
  }, [selId, build]);

  // regroupement par classe, tri par nom (les séries « 1/4 … 4/4 » restent dans l'ordre)
  const groups = useMemo(() => {
    const n = q.trim().toLowerCase();
    const out = new Map();
    for (const b of builds) {
      const c = graph.classById[b.class];
      const a = b.ascendancy && graph.ascById[b.ascendancy];
      if (n && !`${b.name} ${c?.name} ${a?.name || ''}`.toLowerCase().includes(n)) continue;
      const key = c?.name || b.class;
      if (!out.has(key)) out.set(key, []);
      out.get(key).push(b);
    }
    for (const list of out.values()) list.sort((x, y) => x.name.localeCompare(y.name, 'fr', { numeric: true }));
    return [...out.entries()].sort((x, y) => x[0].localeCompare(y[0], 'fr'));
  }, [builds, q, graph]);

  const { lang, raw } = useLang();
  const summary = useMemo(() => (sel ? summarizeBuild(sel, { graph: (raw || data).graph, gemsById: (raw || data).gemsById, lang }) : null), [sel, data, raw, lang]);

  const open = async (panel) => {
    if (sel.id !== build.id) {
      await post(`/api/builds/${sel.id}/activate`);
      setBuild(await get(`/api/builds/${sel.id}`));
    }
    if (panel === 'tree') {
      onClose();
      const ids = [...summary.keystones, ...summary.notables, ...summary.ascendancyNodes].map((n) => n.id);
      if (ids.length) {
        setHighlight({ ids, until: Date.now() + 6000 });
        setFocusCmd({ node: ids[ids.length - 1], zoom: 0.05, t: Date.now() });
      }
    } else if (panel) openPanel(panel);
  };
  const remove = async () => {
    if (!confirm(`Supprimer définitivement le build « ${sel.name} » ?`)) return;
    const r = await api('DELETE', `/api/builds/${sel.id}`);
    if (sel.id === build.id) setBuild(await get(`/api/builds/${r.activeBuildId}`));
    setSelId(r.activeBuildId);
    refreshList();
    showToast('Build supprimé.');
  };
  const isSb = sel?.id === SANDBOX_ID;
  const testInSandbox = async () => {
    const sb = await get(`/api/builds/${SANDBOX_ID}`).catch(() => null);
    const hasContent = sb && (sb.tree.nodes.length || sb.skills.length || Object.keys(sb.items).length);
    if (hasContent && !confirm('Le bac à sable contient déjà des essais : les remplacer par une copie de ce build ?')) return;
    const b = await openSandbox({ fromBuild: sel.id });
    setBuild(b);
    setSelId(SANDBOX_ID);
    showToast(`Copie de « ${sel.name} » dans le bac à sable : l'original reste intact.`);
  };
  const saveSb = async () => {
    const name = prompt('Nom du nouveau build :', 'Nouveau build');
    if (!name) return;
    const b = await saveSandbox(name);
    setBuild(b);
    setSelId(b.id);
    refreshList();
  };
  const duplicate = async () => {
    const b = await post(`/api/builds/${sel.id}/duplicate`, {});
    setBuild(b);
    setSelId(b.id);
    refreshList();
  };

  // --- sauvegarde de tous les builds dans un fichier, et restauration
  const fileRef = useRef(null);
  const downloadBackup = async () => {
    try {
      const backup = await get('/api/backup');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
      a.download = `builds-poe2-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      showToast(`Sauvegarde téléchargée : ${backup.builds.length} build(s).`);
    } catch (e) {
      showToast(e.message, 'error');
    }
  };
  const restoreBackup = async (file) => {
    if (!file) return;
    try {
      let content;
      try {
        content = JSON.parse(await file.text());
      } catch {
        throw new Error("Ce fichier n'est pas une sauvegarde de builds.");
      }
      const r = await post('/api/backup/restore', content);
      refreshList();
      if (r.added) showToast(`${r.added} build(s) restauré(s)${r.skipped ? ` (${r.skipped} déjà présent(s))` : ''}.`);
      else showToast('Rien à restaurer : ces builds sont déjà là.');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  return (
    <Window title="Mes builds" side="center" onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 0.8fr) minmax(320px, 1.4fr)', gap: 14, minHeight: 0 }}>
        <div style={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto' }}>
          <input className="input" style={{ width: '100%', marginBottom: 8 }} placeholder="Rechercher un build…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className={`result sb-entry ${selId === SANDBOX_ID ? 'on' : ''}`} onClick={() => setSelId(SANDBOX_ID)}>
            <div style={{ flex: 1 }}>
              <div className="title" style={{ color: '#9fe0c0' }}>
                Bac à sable {build.id === SANDBOX_ID && <span className="tag" style={{ color: '#9fe0c0', borderColor: '#3f6f5a' }}>ouvert</span>}
              </div>
              <div className="sub">Mode libre, hors de vos builds</div>
            </div>
          </div>
          <div className="small muted" style={{ margin: '6px 0' }}>{builds.length} build(s) enregistré(s){WEB ? ' dans ce navigateur' : ''}</div>
          <div className="row wrap" style={{ gap: 6, marginBottom: 8 }}>
            <button className="btn small" onClick={downloadBackup} title="Enregistre tous vos builds dans un fichier : gardez-le pour ne rien perdre, ou ouvrez-le sur un autre appareil">
              Télécharger une sauvegarde
            </button>
            <button className="btn small" onClick={() => fileRef.current?.click()} title="Ajoute les builds d'un fichier de sauvegarde (aucun build existant n'est écrasé)">
              Restaurer une sauvegarde
            </button>
            <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => { restoreBackup(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
          {groups.map(([cls, list]) => (
            <div key={cls}>
              <div className="section-title">{cls}</div>
              {list.map((b) => {
                const a = b.ascendancy && graph.ascById[b.ascendancy];
                return (
                  <div key={b.id} className={`result ${selId === b.id ? 'on' : ''}`} onClick={() => setSelId(b.id)}>
                    <div style={{ flex: 1 }}>
                      <div className="title">
                        {b.name} {b.id === build.id && <span className="tag" style={{ color: 'var(--gold-2)', borderColor: 'var(--gold-dim)' }}>ouvert</span>}{b.pending && <span className="tag pending">non validé</span>}
                      </div>
                      <div className="sub">
                        {a ? a.name : 'Sans ascendance'} · niveau {b.level} · modifié le {new Date(b.updatedAt).toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          {!groups.length && <div className="empty">Aucun build.</div>}
        </div>

        <div style={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto', paddingRight: 4 }}>
          {!summary ? (
            <div className="empty">Choisissez un build dans la liste.</div>
          ) : (
            <>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-title)', fontSize: 20, color: 'var(--white)' }}>{summary.name}</div>
                <div className="muted">
                  {summary.ascendancy ? `${summary.ascendancy.name} (${summary.class.name})` : summary.class?.name} · niveau {summary.level} · passifs {summary.points.passiveUsed}/{summary.points.passiveAvailableAtLevel} · ascendance {summary.points.ascendancyUsed}/{summary.points.ascendancyMax}
                </div>
                <div className="small muted">Force {summary.attributes?.str} · Dextérité {summary.attributes?.dex} · Intelligence {summary.attributes?.int}</div>
                <div className="row wrap" style={{ justifyContent: 'center', marginTop: 8 }}>
                  <button className="btn small" onClick={() => open('tree')}>Voir l'arbre</button>
                  <button className="btn small" onClick={() => open('skills')}>Gemmes</button>
                  <button className="btn small" onClick={() => open('items')}>Équipement</button>
                  <button className="btn small" onClick={() => open('stats')}>Personnage</button>
                  <button className="btn small" onClick={() => open('notes')}>Notes</button>
                  {sel.id !== build.id && <button className="btn small" onClick={() => open(null)}>{isSb ? 'Ouvrir le bac à sable' : 'Ouvrir ce build'}</button>}
                  {isSb ? (
                    <button className="btn small" onClick={saveSb}>Enregistrer comme build</button>
                  ) : (
                    <>
                      <button className="btn small" onClick={testInSandbox} title="Expérimenter sur une copie : ce build reste intact">Tester dans le bac à sable</button>
                      <button className="btn small" onClick={duplicate}>Dupliquer</button>
                      <button className="btn small danger" onClick={remove}>Supprimer</button>
                    </>
                  )}
                </div>
              </div>

              <div className="section-title">Arbre passif</div>
              {summary.ascendancyNodes.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <span className="muted small">Ascendance : </span>
                  {summary.ascendancyNodes.filter((n) => graph.node(n.id)?.type === 'notable').map((n) => (
                    <span key={n.id} className="tag" style={{ color: 'var(--gold-2)', borderColor: 'var(--line-2)' }} title={n.stats.join('\n')}>{n.name}</span>
                  ))}
                </div>
              )}
              {summary.keystones.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <span className="muted small">Clés de voûte : </span>
                  {summary.keystones.map((n) => <span key={n.id} className="tag" style={{ color: 'var(--white)', borderColor: 'var(--line-2)' }} title={n.stats.join('\n')}>{n.name}</span>)}
                </div>
              )}
              <div>
                <span className="muted small">Notables ({summary.notables.length}) : </span>
                {summary.notables.map((n) => <span key={n.id} className="tag" style={{ color: 'var(--text)', borderColor: 'var(--line)' }} title={n.stats.join('\n')}>{n.name}</span>)}
                {!summary.notables.length && <span className="muted small">aucun</span>}
              </div>

              <div className="section-title">Gemmes</div>
              {summary.skills.length === 0 && <div className="empty">Aucune compétence.</div>}
              {sel.skills.map((s, i) => (
                <div key={s.id} style={{ marginBottom: 8 }}>
                  {s.label && <div className="small" style={{ color: 'var(--gold)' }}>{s.label}</div>}
                  <div className="row wrap" style={{ gap: 4 }}>
                    {s.gems.map((g, j) => {
                      const gd = data.gemsById.get(g.gemId);
                      return (
                        <span key={j} className="row" style={{ gap: 4, marginRight: 6 }}>
                          {j > 0 && <span className="muted">+</span>}
                          <GemIcon gem={gd} support={j > 0} />
                          <span className={`gem-${gd?.color || 'none'} small`}>{gd?.name}{j === 0 ? ` (niv. ${g.level})` : ''}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
              {summary.skillWarnings?.length > 0 && summary.skillWarnings.map((w, i) => <div key={i} className="gem-warning" style={{ marginLeft: 0 }}>⚠ {w}</div>)}

              <div className="section-title">Équipement</div>
              {summary.items.length === 0 && <div className="empty">Rien d'équipé.</div>}
              {summary.items.map((it) => (
                <div key={it.slot} className="row" style={{ marginBottom: 4 }}>
                  {sel.items[it.slot]?.iconUrl && <img className="thumb" src={img(sel.items[it.slot].iconUrl)} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />}
                  <span className="muted small" style={{ minWidth: 110 }}>{it.slotLabel}</span>
                  <span style={{ color: RARITY_COLOR[it.rarity] }}>{it.name}</span>
                  {it.base && it.base !== it.name && <span className="muted small">({it.base})</span>}
                </div>
              ))}

              <div className="section-title">Notes</div>
              {summary.notes ? (
                <div style={{ maxHeight: 260, overflow: 'auto', border: '1px solid var(--line)', padding: '4px 10px', background: '#0b0907' }}>
                  <Markdown text={summary.notes} />
                </div>
              ) : (
                <div className="empty">Pas de notes.</div>
              )}
            </>
          )}
        </div>
      </div>
    </Window>
  );
}
