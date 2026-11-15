import { useEffect, useState } from 'react';
import Window from '../components/Window.jsx';
import { get } from '../api.js';

export default function HelpPanel({ onClose, connected }) {
  const [state, setState] = useState(null);
  useEffect(() => {
    get('/api/state').then(setState).catch(() => {});
  }, []);
  const root = state?.root || 'C:\\chemin\\vers\\aide build poe2';
  const mcpPath = `${root}\\src\\mcp\\server.mjs`;
  const desktopJson = JSON.stringify({ mcpServers: { 'aide-build-poe2': { command: 'node', args: [mcpPath] } } }, null, 2);
  return (
    <Window title="Aide & connexion à Claude" side="center" onClose={onClose}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <div className="section-title">Utilisation</div>
        <div className="help-keys" style={{ lineHeight: 1.9 }}>
          <div><kbd>M</kbd> mes builds · <kbd>P</kbd> / <kbd>Échap</kbd> arbre passif · <kbd>I</kbd> équipement · <kbd>G</kbd> gemmes · <kbd>C</kbd> personnage · <kbd>N</kbd> notes · <kbd>B</kbd> bibliothèque · <kbd>H</kbd> aide</div>
          <div>Arbre : glisser pour se déplacer, molette pour zoomer, <b>survol</b> = aperçu du chemin, <b>clic</b> = allouer / retirer, <b>clic droit</b> sur un nœud d'attribut = choisir Force / Dextérité / Intelligence.</div>
          <div>Menu du build (en haut) : créer, dupliquer, importer / exporter un code Path of Building. <kbd>M</kbd> affiche tous vos builds avec leur résumé trié (arbre, gemmes, équipement, notes).</div><div><b>Valider</b> (en haut à droite) : toute modification d'un build enregistré reste en brouillon tant que vous ne cliquez pas sur « Valider ». Vous pouvez quitter le build, en ouvrir un autre ou fermer l'outil puis revenir : rien n'est enregistré. « Annuler » revient à la dernière version validée.</div><div><b>Termes soulignés</b> (notes, arbre, gemmes, équipement, personnage, bibliothèque) : survolez un terme du jeu pour lire sa définition officielle ; les noms de gemmes, passifs et uniques ouvrent leur fiche, avec un bouton vers la bibliothèque ou l'arbre. Dans une définition, <b>cliquez</b> sur un mot souligné pour ouvrir le sien (« ← retour » pour revenir).</div><div><b>Infobulles « cartes »</b> (arbre, équipement, gemmes) : elles restent en place quand vous bougez la souris vers elles. Dans les panneaux Gemmes et Équipement, la carte se colle au bord du panneau (elle ne cache plus la liste) et suit la souris en hauteur, puis s'arrête dès que vous allez vers elle. <b>Cliquez sur la carte pour la bloquer.</b> Un clic en dehors (ou Échap) la ferme ; ce clic ne fait rien d'autre, pour éviter d'allouer un passif par erreur.</div><div><b>Définitions à côté de la carte</b> : survolez un mot souligné pour un aperçu, <b>cliquez</b> pour garder sa définition ouverte, en colonne à côté de la carte (jamais par-dessus). Un clic sur un mot d'une définition ouvre la suivante en dessous ; un clic sur un autre mot de la carte ferme toute la série et en ouvre une nouvelle. ✕ ferme une définition et celles qui la suivent.</div><div><b>Panneaux de côté</b> (Gemmes, Personnage, Équipement, Notes) : attrapez le bord intérieur du panneau (curseur ↔) pour l'agrandir ou le rétrécir ; la largeur est mémorisée. Double-clic sur le bord : taille normale.</div><div><b>FR / EN</b> (en haut à droite) : affiche les textes du jeu en anglais officiel (passifs, gemmes, objets, définitions), pratique pour suivre un guide anglais. L'interface de l'outil reste en français ; le nom dans l'autre langue est toujours indiqué.</div><div><b>Bac à sable</b> (bouton sous « AIDE BUILD POE2 », en haut à gauche) : mode libre, sans build sélectionné. Testez l'arbre, les gemmes et l'équipement sans rien modifier ; « Tester dans le bac à sable » y copie un build (l'original reste intact) ; « Enregistrer comme build » garde le résultat.</div><div>Gemmes : classées par classe selon les familles officielles du jeu (Masse = Guerrier, Bâton de combat = Moine, Arc = Rôdeuse, Arbalète = Mercenaire, Lance = Chasseresse, Élémentaire = Magicienne, Occulte = Sorcière, Primitif = Druide). Les soutiens sont communs à toutes les classes : leur couleur indique l'attribut demandé.</div>
        </div>

        <div className="section-title">Brancher Claude (MCP)</div>
        <p>
          Claude peut lire vos builds, chercher dans les données du jeu en français, modifier l'arbre / les gemmes / l'équipement, écrire des notes et
          <b> piloter cette interface</b> (centrer l'arbre, surligner des passifs, ouvrir des panneaux, afficher des messages).
          État de la synchro : <span className={`status-dot ${connected ? 'on' : ''}`} /> {connected ? 'connecté' : 'déconnecté'}.
        </p>
        <p><b>Claude Code</b> — ouvrez Claude Code dans le dossier du projet : le fichier <code>.mcp.json</code> déclare déjà le serveur (acceptez-le au premier lancement). Pour l'avoir partout :</p>
        <textarea className="input code-box" readOnly style={{ minHeight: 60 }} value={`claude mcp add --scope user aide-build-poe2 -- node "${mcpPath}"`} onFocus={(e) => e.target.select()} />
        <p><b>Claude Desktop</b> — ajoutez ceci dans <code>claude_desktop_config.json</code> (Paramètres → Développeur → Modifier la config), puis redémarrez Claude :</p>
        <textarea className="input code-box" readOnly style={{ minHeight: 150 }} value={desktopJson} onFocus={(e) => e.target.select()} />
        <p className="small muted">Le serveur MCP démarre automatiquement ce serveur local (port 4747) s'il n'est pas déjà lancé.</p>

        <div className="section-title">Exemples de demandes à Claude</div>
        <ul>
          <li>« Crée-moi un build Titan orienté Fracas et Armure, niveau 70, et explique-moi la progression dans les notes. »</li>
          <li>« Montre-moi dans l'arbre les meilleures clés de voûte pour un build bouclier d'énergie. »</li>
          <li>« Regarde mon build actuel : quels notables proches m'apporteraient de la résistance au chaos ? »</li>
          <li>« Importe ce build pobb.in et dis-moi ce qu'il faut changer pour le leveling. »</li>
          <li>« Quelles gemmes de soutien vont bien avec Lance de foudre ? Ajoute les 5 meilleures. »</li>
        </ul>

        <div className="section-title">Sources</div>
        <ul className="small">
          <li>Arbre, gemmes, objets (structure & calculs) : <a href="https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2" target="_blank" rel="noreferrer">Path of Building Community (PoE2)</a></li>
          <li>Textes français : <a href="https://poe2db.tw/fr/" target="_blank" rel="noreferrer">poe2db.tw/fr</a> et l'API officielle du site d'échange FR</li>
          <li>Guide pour débuter : <a href="https://kami-labs.fr/path-of-exile-2/guide-debutant-path-of-exile-2/" target="_blank" rel="noreferrer">Kami Labs — guide débutant PoE2</a></li>
          <li>Images du jeu © Grinding Gear Games. Outil non officiel, usage personnel.</li>
        </ul>
      </div>
    </Window>
  );
}
