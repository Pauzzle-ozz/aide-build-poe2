import { useMemo } from 'react';
import Window from '../components/Window.jsx';
import { summarizeBuild } from '@core/build-model.mjs';
import { useLang } from '../lang.jsx';
import { useTerms } from '../components/Terms.jsx';

export default function StatsPanel({ data, build, onClose, setFocusCmd, setHighlight }) {
  // résumé calculé sur les données d'origine, dans la langue choisie (bouton FR / EN de la barre du haut)
  const { lang, raw } = useLang();
  const terms = useTerms();
  const link = (t, k) => (terms ? terms.linkify(t, k) : t);
  const s = useMemo(() => summarizeBuild(build, { graph: (raw || data).graph, gemsById: (raw || data).gemsById, lang }), [build, data, raw, lang]);
  const show = (id) => {
    setHighlight({ ids: [id], until: Date.now() + 5000 });
    setFocusCmd({ node: id, t: Date.now() });
  };
  const cls = data.graph.classById[build.class];
  const unassigned = build.tree.nodes.filter((id) => data.graph.node(id)?.isAttribute && !build.tree.attributes?.[id]).length;
  return (
    <Window
      title="Personnage"
      side="left"
      onClose={onClose}
    >
      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <div style={{ fontFamily: 'var(--font-title)', fontSize: 20, color: 'var(--white)' }}>{build.name}</div>
        <div className="muted">
          Niveau {build.level} · {s.ascendancy ? `${s.ascendancy.name} (${s.class.name})` : s.class?.name}
        </div>
      </div>
      <div className="stat-grid">
        <div className="stat-box str"><div className="v">{s.attributes?.str}</div><div className="k">{link('Force', 'f')}</div></div>
        <div className="stat-box dex"><div className="v">{s.attributes?.dex}</div><div className="k">{link('Dextérité', 'd')}</div></div>
        <div className="stat-box int"><div className="v">{s.attributes?.int}</div><div className="k">{link('Intelligence', 'i')}</div></div>
      </div>
      <p className="small muted" style={{ textAlign: 'center' }}>
        Base de classe : {cls?.base.str} / {cls?.base.dex} / {cls?.base.int}
        {unassigned > 0 && <> · <span style={{ color: '#e8b04a' }}>{unassigned} nœud(s) d'attribut sans choix (clic droit dessus)</span></>}
      </p>
      <div className="kv" style={{ marginTop: 8 }}>
        <span className="k">Points de passif</span><span>{s.points.passiveUsed} / {s.points.passiveAvailableAtLevel} (niv. {build.level}) — max {s.points.passiveMax}</span>
        <span className="k">Points d'ascendance</span><span>{s.points.ascendancyUsed} / {s.points.ascendancyMax}</span>
        <span className="k">Compétences</span><span>{s.skills.length} groupe(s) de gemmes</span>
        <span className="k">Équipement</span><span>{s.items.length} objet(s)</span>
      </div>

      {s.keystones.length > 0 && (
        <>
          <div className="section-title">Clés de voûte</div>
          {s.keystones.map((k) => (
            <div key={k.id} style={{ marginBottom: 6, cursor: 'pointer' }} onClick={() => show(k.id)}>
              <div style={{ color: 'var(--gold-2)' }}>{k.name}</div>
              {k.stats.map((t, i) => <div key={i} className="mod small">{link(t, `k${k.id}-${i}`)}</div>)}
            </div>
          ))}
        </>
      )}
      {s.ascendancyNodes.length > 0 && (
        <>
          <div className="section-title">Ascendance</div>
          {s.ascendancyNodes.map((k) => (
            <div key={k.id} style={{ marginBottom: 6, cursor: 'pointer' }} onClick={() => show(k.id)}>
              <div style={{ color: 'var(--gold-2)' }}>{k.name}</div>
              {k.stats.map((t, i) => <div key={i} className="mod small">{link(t, `a${k.id}-${i}`)}</div>)}
            </div>
          ))}
        </>
      )}
      {s.notables.length > 0 && (
        <>
          <div className="section-title">Notables ({s.notables.length})</div>
          <div className="row wrap">
            {s.notables.map((k) => (
              <span key={k.id} className="tag" style={{ cursor: 'pointer', color: 'var(--text)', borderColor: 'var(--line-2)' }} onClick={() => show(k.id)} title={k.stats.join('\n')}>
                {k.name}
              </span>
            ))}
          </div>
        </>
      )}
      <div className="section-title">Bonus de l'arbre passif</div>
      {s.passiveStats.length ? <div className="stat-lines">{s.passiveStats.map((l, i) => <div key={i}>{link(l, `ps${i}`)}</div>)}</div> : <div className="empty">Aucun passif alloué.</div>}
      {s.itemStats.length > 0 && (
        <>
          <div className="section-title">Bonus de l'équipement</div>
          <div className="stat-lines">{s.itemStats.map((l, i) => <div key={i}>{link(l, `is${i}`)}</div>)}</div>
        </>
      )}
      <p className="small muted" style={{ marginTop: 14 }}>
        Les totaux additionnent les lignes identiques. Pour les dégâts / défenses calculés, exportez le build vers Path of Building (menu du build → Exporter PoB).
      </p>
    </Window>
  );
}
