// Version en ligne : bouton « ✦ Claude » de la barre du haut et fenêtre pour connecter Claude
// (lien personnel à ajouter comme connecteur dans Claude). Voir web/src/web/claude.js.
import { useEffect, useState } from 'react';
import { Modal } from './Window.jsx';
import { useDialog } from './Dialog.jsx';

let claudeModule = null;
// uniquement dans la version en ligne (rien de tout cela dans l'interface du serveur local)
const chargerClaude = () => (claudeModule ??= import.meta.env.MODE === 'web' ? import('../web/claude.js') : new Promise(() => {}));

function useClaude() {
  const [st, setSt] = useState(null);
  const [mod, setMod] = useState(null);
  useEffect(() => {
    let off = null;
    let fini = false;
    chargerClaude().then((m) => {
      if (fini) return;
      m.demarrer();
      setMod(m);
      off = m.suivre(setSt);
    });
    return () => {
      fini = true;
      off?.();
    };
  }, []);
  return [st, mod];
}

const STATUT = {
  arrete: { texte: 'Claude non connecté', point: '' },
  connexion: { texte: 'Connexion à Claude en cours…', point: 'wait' },
  pret: { texte: 'Prêt : Claude peut accéder à vos builds', point: 'on' },
  autreOnglet: { texte: 'Claude est relié à un autre onglet de ce site', point: 'wait' },
};

export default function ClaudeButton({ showToast }) {
  const [st, mod] = useClaude();
  const [open, setOpen] = useState(false);
  const statut = st?.actif ? st.statut : 'arrete';
  return (
    <>
      <button
        className="btn small claude-btn"
        onClick={() => setOpen(true)}
        title={`${STATUT[statut].texte}. Cliquez pour connecter Claude à vos builds.`}
        aria-label={`Claude : ${STATUT[statut].texte}`}
      >
        <span className={`status-dot ${STATUT[statut].point}`} aria-hidden="true" /> ✦<span className="tb-label"> Claude</span>
      </button>
      {open && <ClaudeModal st={st} mod={mod} statut={statut} onClose={() => setOpen(false)} showToast={showToast} />}
    </>
  );
}

function ClaudeModal({ st, mod, statut, onClose, showToast }) {
  const lien = st?.jeton && mod ? mod.lienMcp(st.jeton) : '';
  const copier = (texte, quoi) =>
    navigator.clipboard.writeText(texte).then(
      () => showToast(`${quoi} copié !`),
      () => showToast('Copie impossible : sélectionnez le texte et copiez-le à la main.', 'error'),
    );
  const dialog = useDialog();
  const changerLien = async () => {
    const ok = await dialog.confirm("Créer un nouveau lien ? L'ancien ne fonctionnera plus : il faudra remplacer le connecteur dans Claude.", {
      title: 'Nouveau lien',
      okLabel: 'Créer un nouveau lien',
      danger: true,
    });
    if (!ok) return;
    mod.changerLien();
    showToast('Nouveau lien créé : remplacez-le dans les connecteurs de Claude.');
  };
  return (
    <Modal title="Connecter Claude" onClose={onClose}>
      <div className="claude-connect">
        <p>
          Claude peut <b>créer et modifier vos builds avec vous</b> : il cherche les passifs, les gemmes et l'équipement, écrit les notes,
          et vous voyez tout changer en direct sur cette page. Vos builds restent dans ce navigateur.
        </p>

        {!st?.actif ? (
          <div className="row" style={{ justifyContent: 'center', margin: '14px 0' }}>
            <button className="btn validate" disabled={!mod} onClick={() => mod.activer()}>
              Activer la connexion à Claude
            </button>
          </div>
        ) : (
          <>
            <div className="row" style={{ gap: 8, margin: '8px 0 12px' }}>
              <span className={`status-dot ${STATUT[statut].point}`} />
              <span>{STATUT[statut].texte}</span>
              {statut === 'autreOnglet' && (
                <button className="btn small" onClick={() => mod.utiliserCetOnglet()}>Utiliser cet onglet</button>
              )}
            </div>

            <div className="section-title">1. Copiez votre lien personnel</div>
            <div className="row" style={{ gap: 6 }}>
              <input className="input grow" readOnly value={lien} onFocus={(e) => e.target.select()} />
              <button className="btn small" onClick={() => copier(lien, 'Lien')}>Copier</button>
            </div>
            <p className="small muted">
              Gardez-le pour vous : tant que cette page est ouverte, il permet de lire et modifier vos builds.
            </p>

            <div className="section-title">2. Ajoutez-le dans Claude</div>
            <p>
              Sur <a href="https://claude.ai" target="_blank" rel="noreferrer">claude.ai</a> ou dans l'application Claude : ouvrez les réglages, rubrique
              <b> Connecteurs</b>, puis <b>Ajouter un connecteur personnalisé</b>. Nom : <i>Aide Build PoE2</i>, adresse : votre lien. Les comptes gratuits
              ont droit à un connecteur personnalisé.
            </p>
            <p className="small muted">Avec Claude Code, dans un terminal :</p>
            <div className="row" style={{ gap: 6 }}>
              <input className="input grow code" readOnly value={`claude mcp add --transport http aide-build-poe2 ${lien}`} onFocus={(e) => e.target.select()} />
              <button className="btn small" onClick={() => copier(`claude mcp add --transport http aide-build-poe2 ${lien}`, 'Commande')}>Copier</button>
            </div>

            <div className="section-title">3. Parlez à Claude</div>
            <p>
              Par exemple : « Crée-moi un build de Moine pour débuter, du niveau 1 à 30, et explique-moi les passifs dans les notes. »
              <br />
              <b>Gardez cette page ouverte</b> pendant que Claude travaille : c'est elle qui détient vos builds.
            </p>
            {st.derniereAction && (
              <p className="small muted">Dernière action de Claude : {new Date(st.derniereAction).toLocaleTimeString('fr-FR')}.</p>
            )}

            <div className="section-title">4. Conseillé : ajoutez le skill « Expert build »</div>
            <p>
              Le skill apprend à Claude la méthode d'un expert : synergies, calcul des dégâts, défenses, progression du niveau 1 aux cartes.
              Avec le connecteur, Claude la consulte déjà de lui-même ; ajouté dans Claude, le skill sert aussi dans toutes vos autres conversations.
            </p>
            <div className="row wrap" style={{ gap: 8, alignItems: 'center' }}>
              <a className="btn small" href="/expert-build-poe2.zip" download>Télécharger le skill (.zip)</a>
              <span className="small muted">
                puis sur <a href="https://claude.ai/customize/skills" target="_blank" rel="noreferrer">claude.ai/customize/skills</a> : bouton « + », importez
                le fichier tel quel (sans le décompresser) et activez le skill.
              </span>
            </div>
            <p className="small muted">
              L'import de skills dépend de votre abonnement Claude (exécution de code activée). Claude Code : décompressez le fichier dans le dossier
              <code> ~/.claude/skills/</code>.
            </p>

            <div className="row wrap" style={{ gap: 6, justifyContent: 'flex-end', marginTop: 10 }}>
              <button className="btn small" onClick={changerLien} title="Si vous avez partagé votre lien par erreur">Changer de lien</button>
              <button className="btn small danger" onClick={() => mod.desactiver()}>Désactiver</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
