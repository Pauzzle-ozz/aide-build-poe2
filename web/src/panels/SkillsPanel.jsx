import { useMemo, useState } from 'react';
import Window from '../components/Window.jsx';
import { GemTooltip } from '../components/Tooltips.jsx';
import { useHoverCard } from '../components/HoverCard.jsx';

// la carte d'une gemme se colle au bord droit du panneau (elle ne cache plus la liste) et suit la souris en hauteur
const panelEdge = (e) => e.currentTarget.closest('.window')?.getBoundingClientRect().right ?? e.clientX;
import { img } from '../api.js';
import { canSupport, checkSkills } from '@core/gems-logic.mjs';
import { classFilters, gemMatchesClass, classRank } from '../gem-classes.js';
import { isTouchInput, useIsMobile } from '../mobile.js';
import { pressable } from '../a11y.js';

/** Au doigt, toucher une gemme ouvre sa carte (sauf sur les champs et boutons de la ligne) */
const tapOpens = (e) => isTouchInput() && !e.target.closest('button, input, select, textarea');

const KIND_FR = { skill: "Gemme d'aptitude", support: 'Gemme de soutien', spirit: "Gemme d'esprit", meta: 'Méta-gemme', lineage: 'Soutien de lignage' };

export function GemIcon({ gem, support }) {
  return <span className={`gem-icon ${support ? 'support' : ''}`} style={{ backgroundImage: gem?.iconUrl ? `url(${img(gem.iconUrl)})` : undefined }} />;
}

export default function SkillsPanel({ data, build, doOps, onClose }) {
  const hc = useHoverCard();
  const [picker, setPicker] = useState(null); // { mode: 'new' } | { mode: 'support', skillId }
  const hov = (key, gem, level) => ({
    onMouseEnter: (e) => gem && hc.show(key, { gem, level }, panelEdge(e), e.clientY, { dock: 'right' }),
    onMouseMove: (e) => hc.follow(key, panelEdge(e), e.clientY),
    onMouseLeave: hc.hide,
    onClick: (e) => gem && tapOpens(e) && hc.open(key, { gem, level }),
  });

  const warnings = checkSkills(build, data.gemsById);
  const warnFor = (si, gi) => warnings.filter((w) => w.skill === si && w.gem === gi);
  const updateGems = (s, gems) => doOps({ op: 'updateSkill', skillId: s.id, gems: gems.map((g) => ({ gemId: g.gemId, level: g.level, quality: g.quality, enabled: g.enabled })) });

  return (
    <Window title="Gemmes de compétence" side="left" onClose={onClose}>
      {build.skills.length === 0 && !picker && (
        <div className="empty">Aucune compétence. Ajoutez une gemme d'aptitude, puis ses gemmes de soutien.</div>
      )}
      {build.skills.map((s, si) => {
        const main = s.gems[0];
        const supports = s.gems.slice(1);
        return (
          <div key={s.id} className={`skill-group ${s.enabled === false ? 'disabled' : ''}`}>
            <div className="head">
              <input
                className="input grow small"
                placeholder={`Compétence ${si + 1} (libellé)`}
                defaultValue={s.label}
                onBlur={(e) => e.target.value !== (s.label || '') && doOps({ op: 'updateSkill', skillId: s.id, label: e.target.value })}
              />
              <button className="btn small ghost" title="Monter" aria-label="Monter la compétence" onClick={() => doOps({ op: 'moveSkill', skillId: s.id, delta: -1 })}>▲</button>
              <button className="btn small ghost" title="Descendre" aria-label="Descendre la compétence" onClick={() => doOps({ op: 'moveSkill', skillId: s.id, delta: 1 })}>▼</button>
              <button className="btn small ghost" title={s.enabled === false ? 'Activer' : 'Désactiver'} aria-label={s.enabled === false ? 'Activer la compétence' : 'Désactiver la compétence'} onClick={() => doOps({ op: 'updateSkill', skillId: s.id, enabled: s.enabled === false })}>{s.enabled === false ? '○' : '●'}</button>
              <button className="btn small danger ghost" title="Supprimer" aria-label="Supprimer la compétence" onClick={() => doOps({ op: 'removeSkill', skillId: s.id })}>✕</button>
            </div>
            {s.gems.map((g, gi) => {
              const gd = data.gemsById.get(g.gemId);
              const isSupport = gi > 0;
              const ws = warnFor(si, gi);
              return (
                <div key={gi} className={`gem-chip ${isSupport ? 'support' : ''} ${g.enabled === false ? 'off' : ''} ${ws.length ? 'warn' : ''}`} title={ws.map((w) => w.text).join(' · ')} {...hov(`${s.id}:${gi}`, gd, g.level)}>
                  <GemIcon gem={gd} support={isSupport} />
                  <span className={`gname gem-${gd?.color || 'none'}`}>{gd?.name || g.gemId}{ws.length > 0 && <span className="warn-badge"> ⚠</span>}</span>
                  <span className="small muted">niv.</span>
                  <input
                    className="input small gem-level"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={40}
                    aria-label={`Niveau de ${gd?.name || 'la gemme'}`}
                    value={g.level}
                    onChange={(e) => updateGems(s, s.gems.map((x, i) => (i === gi ? { ...x, level: Number(e.target.value) } : x)))}
                  />
                  <button className="btn small ghost" title={g.enabled === false ? 'Activer' : 'Désactiver'} aria-label={g.enabled === false ? 'Activer la gemme' : 'Désactiver la gemme'} onClick={() => updateGems(s, s.gems.map((x, i) => (i === gi ? { ...x, enabled: x.enabled === false } : x)))}>{g.enabled === false ? '○' : '●'}</button>
                  <button className="btn small ghost" title="Retirer" aria-label="Retirer la gemme" onClick={() => (s.gems.length === 1 ? doOps({ op: 'removeSkill', skillId: s.id }) : updateGems(s, s.gems.filter((_, i) => i !== gi)))}>✕</button>
                </div>
              );
            })}
            <div className="row" style={{ marginTop: 4, marginLeft: 26 }}>
              <button className="btn small" disabled={supports.length >= 5} onClick={() => setPicker({ mode: 'support', skillId: s.id })}>
                + Soutien ({supports.length}/5)
              </button>
              {main && <span className="small muted">{KIND_FR[data.gemsById.get(main.gemId)?.kind] || ''}</span>}
            </div>
            {warnFor(si, -1).length === 0 && warnings.filter((w) => w.skill === si).map((w, i) => (
              <div key={i} className="gem-warning">⚠ {w.text}</div>
            ))}
            {picker?.skillId === s.id && (
              <GemPicker data={data} buildClass={build.class} kind="support" active={data.gemsById.get(main?.gemId)} exclude={s.gems.map((g) => g.gemId)} onPick={(gd) => { updateGems(s, [...s.gems, { gemId: gd.id, level: gd.maxLevel || 20, quality: 0, enabled: true }]); setPicker(null); }} onCancel={() => setPicker(null)} />
            )}
          </div>
        );
      })}
      {picker?.mode === 'new' ? (
        <GemPicker data={data} buildClass={build.class} kind="skill" onPick={(gd) => { doOps({ op: 'addSkill', gems: [gd.id] }); setPicker(null); }} onCancel={() => setPicker(null)} />
      ) : (
        <button className="btn" onClick={() => setPicker({ mode: 'new' })}>+ Ajouter une compétence</button>
      )}
      {hc.card?.payload?.gem && <GemTooltip key={hc.card.key} gem={data.gemsById.get(hc.card.payload.gem.id) || hc.card.payload.gem} level={hc.card.payload.level} x={hc.card.x} y={hc.card.y} card={hc.cardProps} />}
    </Window>
  );
}

export function GemPicker({ data, kind, active, exclude = [], onPick, onCancel, buildClass }) {
  const [q, setQ] = useState('');
  const [k, setK] = useState(kind);
  const [cls, setCls] = useState(kind === 'support' ? 'all' : buildClass || 'all');
  const [color, setColor] = useState('all');
  const hc = useHoverCard();
  const mobile = useIsMobile();
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return data.gems
      .filter((g) => (k === 'support' ? g.kind === 'support' || g.kind === 'lineage' : k === 'any' ? true : g.kind !== 'support' && g.kind !== 'lineage'))
      .filter((g) => !exclude.includes(g.id))
      .filter((g) => k !== 'support' || !active || canSupport(g, active))
      .filter((g) => k === 'support' || gemMatchesClass(g, cls))
      .filter((g) => k !== 'support' || color === 'all' || g.color === color)
      .filter((g) => !n || g.name.toLowerCase().includes(n) || g.nameEn.toLowerCase().includes(n) || g.tags.some((t) => t.toLowerCase().includes(n)) || (g.description || '').toLowerCase().includes(n))
      .sort((a, b) => (k === 'support' ? (a.tier ?? 0) - (b.tier ?? 0) : classRank(a, buildClass) - classRank(b, buildClass) || (a.tier ?? 99) - (b.tier ?? 99)))
      .slice(0, 200);
  }, [q, k, data, exclude, active, cls, color, buildClass]);
  return (
    <div className="gem-picker">
      <div className="row wrap" style={{ marginBottom: 6 }}>
        <input className="input grow" style={{ minWidth: 180 }} autoFocus={!mobile} placeholder={k === 'support' ? 'Rechercher un soutien (nom, mot-clé, effet)…' : 'Rechercher une gemme (nom, mot-clé)…'} value={q} onChange={(e) => setQ(e.target.value)} />
        {kind !== 'support' && (
          <>
            <select className="input" value={cls} onChange={(e) => setCls(e.target.value)} title="Classe associée (catégories officielles du jeu)">
              {classFilters(data.graph).map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
            <select className="input" value={k} onChange={(e) => setK(e.target.value)}>
              <option value="skill">Aptitudes et esprit</option>
              <option value="any">Toutes</option>
            </select>
          </>
        )}
        {kind === 'support' && (
          <select className="input" value={color} onChange={(e) => setColor(e.target.value)} title="Les soutiens sont communs à toutes les classes ; leur couleur indique l'attribut demandé">
            <option value="all">Toutes couleurs</option>
            <option value="str">Force (rouges)</option>
            <option value="dex">Dextérité (vertes)</option>
            <option value="int">Intelligence (bleues)</option>
          </select>
        )}
        <button className="btn small ghost" onClick={onCancel}>Annuler</button>
      </div>
      {k === 'support' && active && <div className="small muted" style={{ marginBottom: 4 }}>Les soutiens sont communs à toutes les classes. Seuls ceux compatibles avec « {active.name} » sont proposés (règles de Path of Building).</div>}
      <div className="result-list gem-picker-list">
        {list.map((g) => (
          <div
            key={g.id}
            className="result"
            {...pressable(() => onPick(g))}
            onMouseEnter={(e) => hc.show(g.id, g, panelEdge(e), e.clientY, { dock: 'right' })}
            onMouseMove={(e) => hc.follow(g.id, panelEdge(e), e.clientY)}
            onMouseLeave={hc.hide}
          >
            <GemIcon gem={g} support={g.kind === 'support'} />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className={`title gem-${g.color}`}>{g.name}</div>
              <div className="sub">{g.tier ? `Palier ${g.tier} · ` : ''}{k === 'support' ? '' : `${g.category} · `}{g.tags.join(', ')}</div>
            </div>
            {mobile && (
              <button
                className="btn small ghost info-btn"
                aria-label={`Voir la carte de ${g.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  hc.open(g.id, g);
                }}
              >
                Voir
              </button>
            )}
          </div>
        ))}
        {list.length === 0 && <div className="empty">Aucune gemme trouvée.</div>}
      </div>
      {hc.card && <GemTooltip key={hc.card.key} gem={data.gemsById.get(hc.card.key) || hc.card.payload} x={hc.card.x} y={hc.card.y} card={hc.cardProps} />}
    </div>
  );
}
