import { useEffect, useRef, useState } from 'react';
import { passivePointsForLevel, questPointsForLevel } from '@core/tree-logic.mjs';
import { api, get, post, WEB } from '../api.js';
import { Modal } from './Window.jsx';
import { isSandbox, openSandbox, resetSandbox, saveSandbox, leaveSandbox, SANDBOX_ID } from '../sandbox.js';
import { useLang } from '../lang.jsx';

export default function TopBar({ data, build, builds, doOps, showToast, connected, refreshList, switchBuild, setBuild, openPanel }) {
  const { graph } = data;
  const { lang, setLang } = useLang();
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState(null);
  const menuRef = useRef(null);
  const used = graph.pointsUsed(build);
  const avail = passivePointsForLevel(build.level);
  const maxAsc = data.tree.points?.ascendancy ?? 8;
  const sandbox = isSandbox(build);

  useEffect(() => {
    if (!menu) return;
    const h = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenu(false);
    };
    window.addEventListener('mousedown', h);
    return () => window.removeEventListener('mousedown', h);
  }, [menu]);

  const changeClass = async (value) => {
    const [cls, asc] = value.split('|');
    if (cls !== build.class && build.tree.nodes.length && !confirm('Changer de classe retire les passifs qui ne sont plus reliés au point de départ. Continuer ?')) return;
    await doOps([{ op: 'setClass', class: cls }, { op: 'setAscendancy', ascendancy: asc || null }]);
  };

  const newBuild = async () => {
    const name = prompt('Nom du nouveau build :', 'Nouveau build');
    if (!name) return;
    const b = await post('/api/builds', { name, class: build.class });
    setBuild(b);
    refreshList();
    setMenu(false);
  };
  const duplicate = async () => {
    const b = await post(`/api/builds/${build.id}/duplicate`, {});
    setBuild(b);
    refreshList();
    setMenu(false);
  };
  const rename = async () => {
    const name = prompt('Nouveau nom :', build.name);
    if (name) await doOps({ op: 'rename', name });
    refreshList();
    setMenu(false);
  };
  // --- bac à sable
  const enterSandbox = async () => {
    setMenu(false);
    if (sandbox) return;
    setBuild(await openSandbox());
    showToast('Bac à sable : vos builds enregistrés ne seront pas modifiés.');
  };
  const copyToSandbox = async () => {
    setMenu(false);
    const sb = await get(`/api/builds/${SANDBOX_ID}`).catch(() => null);
    const hasContent = sb && (sb.tree.nodes.length || sb.skills.length || Object.keys(sb.items).length);
    if (hasContent && !confirm('Le bac à sable contient déjà des essais : les remplacer par une copie de ce build ?')) return;
    setBuild(await openSandbox({ fromBuild: build.id }));
    showToast(`Copie de « ${build.name} » dans le bac à sable : l'original reste intact.`);
  };
  const emptySandbox = async () => {
    setMenu(false);
    if (!confirm('Vider le bac à sable (arbre, gemmes, équipement, notes) ?')) return;
    setBuild(await resetSandbox(build.class));
  };
  const saveAsBuild = async () => {
    setMenu(false);
    const name = prompt('Nom du nouveau build :', build.copiedFrom ? build.name.replace(/^Bac à sable \(copie de « (.*) »\)$/, '$1 (variante)') : 'Nouveau build');
    if (!name) return;
    setBuild(await saveSandbox(name));
    refreshList();
    showToast(`Build « ${name} » enregistré.`);
  };
  const exitSandbox = async () => {
    try {
      setBuild(await leaveSandbox());
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  // --- brouillon / validation
  const validate = async () => {
    try {
      setBuild(await post(`/api/builds/${build.id}/validate`));
      refreshList();
      showToast(`Modifications validées : « ${build.name} » est enregistré.`);
    } catch (e) {
      showToast(e.message, 'error');
    }
  };
  const discard = async () => {
    if (!confirm(`Annuler toutes les modifications non validées de « ${build.name} » ? (${(build.pendingChanges || []).join(', ')})`)) return;
    setBuild(await post(`/api/builds/${build.id}/discard`));
    refreshList();
    showToast('Modifications annulées : retour à la version enregistrée.');
  };

  const remove = async () => {
    if (!confirm(`Supprimer définitivement le build « ${build.name} » ?`)) return;
    const r = await api('DELETE', `/api/builds/${build.id}`);
    setBuild(await get(`/api/builds/${r.activeBuildId}`));
    refreshList();
    setMenu(false);
  };

  return (
    <>
    <div className="topbar">
      <div className="brand">
        Aide Build PoE2
        <button
          className={`sb-toggle ${sandbox ? 'on' : ''}`}
          onClick={sandbox ? exitSandbox : enterSandbox}
          title={sandbox ? 'Revenir au dernier build ouvert' : 'Mode libre : expérimenter sans modifier aucun build'}
        >
          {sandbox ? '✦ Bac à sable actif · quitter' : '✦ Passer en bac à sable'}
        </button>
      </div>
      <div className="sep" />
      <div style={{ position: 'relative' }} ref={menuRef}>
        <button className={`btn ${sandbox ? 'sandbox-btn' : ''}`} onClick={() => { if (!menu) refreshList(); setMenu((m) => !m); }} title="Changer / gérer les builds">
          {sandbox ? 'Bac à sable (aucun build)' : build.name} ▾
        </button>
        {menu && (
          <div className="window build-menu" style={{ left: 0, top: 40, bottom: 'auto' }}>
            <div className="window-body" style={{ padding: 6 }}>
              <div className="row wrap" style={{ padding: 6, gap: 6 }}>
                <button className="btn small" onClick={() => { openPanel('builds'); setMenu(false); }}>Tous mes builds (M)</button>
                <button className="btn small" onClick={newBuild}>+ Nouveau</button>
                {!sandbox && (
                  <>
                    <button className="btn small" onClick={duplicate}>Dupliquer</button>
                    <button className="btn small" onClick={rename}>Renommer</button>
                  </>
                )}
                <button className="btn small" onClick={() => { setModal('import'); setMenu(false); }}>Importer PoB</button>
                <button className="btn small" onClick={() => { setModal('export'); setMenu(false); }}>Exporter PoB</button>
                {!sandbox && <button className="btn small danger" onClick={remove}>Supprimer</button>}
              </div>
              {builds.map((b) => {
                const c = graph.classById[b.class];
                const a = b.ascendancy && graph.ascById[b.ascendancy];
                return (
                  <div key={b.id} className={`item ${b.id === build.id ? 'on' : ''}`} onClick={() => { switchBuild(b.id); setMenu(false); }}>
                    <div>{b.name} {b.pending && <span className="tag pending">non validé</span>}</div>
                    <div className="small muted">{a ? a.name : c?.name} · niveau {b.level}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <select className="input" value={`${build.class}|${build.ascendancy || ''}`} onChange={(e) => changeClass(e.target.value)} title="Classe et ascendance">
        {graph.classes.map((c) => (
          <optgroup key={c.id} label={c.name}>
            <option value={`${c.id}|`}>{c.name} (sans ascendance)</option>
            {c.ascendancies.map((a) => (
              <option key={a.id} value={`${c.id}|${a.id}`}>{c.name} — {a.name}</option>
            ))}
          </optgroup>
        ))}
      </select>
      <label className="row small" title="Niveau du personnage">
        Niv.
        <input className="input" type="number" min={1} max={100} value={build.level} style={{ width: 62 }} onChange={(e) => doOps({ op: 'setLevel', level: Number(e.target.value) }, { quiet: true })} />
      </label>
      <div className="points">
        <div className={`pt ${used.passive > avail ? 'over' : ''}`} title={`Points de passif : ${used.passive} utilisés, ${avail} disponibles au niveau ${build.level} (dont ${questPointsForLevel(build.level)} Points de Talent d'Ensemble d'armes, donnés par les quêtes)`}>
          Passifs <b>{used.passive}</b> / {avail}
        </div>
        <div className={`pt ${used.ascendancy > maxAsc ? 'over' : ''}`} title="Points d'ascendance (8 au maximum, via les Épreuves)">
          Ascendance <b>{used.ascendancy}</b> / {maxAsc}
        </div>
      </div>
      <div className="grow" />
      {!sandbox && (build.pending ? (
        <div className="validate-box" title={`Modifications non enregistrées dans le build : ${(build.pendingChanges || []).join(', ') || 'modifications'}. « Valider » les enregistre, « Annuler » revient à la version validée.`}>
          <span className="pending-dot" />
          <span className="small">Non validé : {(build.pendingChanges || []).join(', ') || 'modifications'}</span>
          <button className="btn small validate" onClick={validate}>Valider</button>
          <button className="btn small ghost" onClick={discard}>Annuler</button>
        </div>
      ) : (
        <div className="small muted" title="Le build enregistré correspond à ce que vous voyez">✓ Build enregistré</div>
      ))}
      <div className="lang-toggle" title="Langue des textes du jeu (infobulles, passifs, gemmes, objets, définitions). L'interface de l'outil reste en français.">
        <button className={lang === 'fr' ? 'on' : ''} onClick={() => setLang('fr')}>FR</button>
        <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
      </div>
      {!WEB && (
        <div className="row small muted" style={{ whiteSpace: 'nowrap' }} title={connected ? 'Synchronisé en temps réel (Claude peut piloter l\'interface)' : 'Connexion au serveur perdue'}>
          <span className={`status-dot ${connected ? 'on' : ''}`} /> {connected ? 'En direct' : 'Hors ligne'}
        </div>
      )}
      {modal === 'import' && <ImportModal onClose={() => setModal(null)} showToast={showToast} setBuild={setBuild} refreshList={refreshList} />}
      {modal === 'export' && <ExportModal onClose={() => setModal(null)} build={build} showToast={showToast} />}
    </div>
    {sandbox && (
      <div className="sandbox-banner">
        <span className="tag-sb">Bac à sable</span>
        <span>Mode libre : aucun build n'est sélectionné, vos builds enregistrés ne sont pas modifiés.{build.copiedFrom ? ' Vous travaillez sur une copie.' : ''}</span>
        <span className="grow" />
        <button className="btn small" onClick={saveAsBuild}>Enregistrer comme build</button>
        <button className="btn small" onClick={emptySandbox}>Vider</button>
        <button className="btn small" onClick={exitSandbox}>Quitter le bac à sable</button>
      </div>
    )}
    </>
  );
}

function ImportModal({ onClose, showToast, setBuild, refreshList }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      const r = await post('/api/pob/import', { code, name: name || undefined });
      setBuild(r.build);
      refreshList();
      showToast(r.warnings.length ? `Importé avec ${r.warnings.length} avertissement(s) : ${r.warnings.slice(0, 3).join(' · ')}` : 'Build importé !', r.warnings.length ? 'error' : 'info');
      onClose();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Importer un build Path of Building" onClose={onClose}>
      <p className="muted small">Collez un code d'export PoB (PoE2) ou un lien pobb.in / poe.ninja.</p>
      <textarea className="input code-box" value={code} onChange={(e) => setCode(e.target.value)} placeholder="eNrtfWtz2ziy6HfP..." autoFocus />
      <div className="row" style={{ marginTop: 8 }}>
        <input className="input grow" placeholder="Nom du build (facultatif)" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn" disabled={!code.trim() || busy} onClick={go}>{busy ? 'Import…' : 'Importer'}</button>
      </div>
    </Modal>
  );
}

function ExportModal({ onClose, build, showToast }) {
  const [code, setCode] = useState('');
  useEffect(() => {
    get(`/api/builds/${build.id}/pob`).then((r) => setCode(r.code)).catch((e) => showToast(e.message, 'error'));
  }, [build.id]);
  return (
    <Modal title="Exporter vers Path of Building" onClose={onClose}>
      <p className="muted small">Copiez ce code puis, dans Path of Building PoE2 : <i>Import/Export Build → Import from code</i>. Pratique pour vérifier les dégâts et la défense calculés par PoB.</p>
      <textarea className="input code-box" readOnly value={code} onFocus={(e) => e.target.select()} />
      <div className="row" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
        <button className="btn" onClick={() => navigator.clipboard.writeText(code).then(() => showToast('Code copié !'))}>Copier</button>
      </div>
    </Modal>
  );
}
