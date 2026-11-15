# Aide Build PoE2

Outil **local** et **entièrement en français** pour préparer ses builds Path of Exile 2, avec une interface
qui reprend les menus du jeu (arbre passif, équipement, gemmes, personnage) et un **serveur MCP** qui permet
à Claude de lire vos builds, chercher dans les données du jeu, modifier le build et piloter l'interface en direct.

## Télécharger et lancer (Windows)

**1. Installer Node.js** (une seule fois)
Allez sur [nodejs.org](https://nodejs.org), cliquez sur le bouton de téléchargement (version « LTS »), ouvrez le
fichier téléchargé et cliquez sur « Suivant » jusqu'au bout, sans rien changer.

**2. Télécharger l'outil**
En haut de cette page GitHub, cliquez sur le bouton vert **« <> Code »**, puis sur **« Download ZIP »**.

**3. Décompresser**
Dans votre dossier Téléchargements, faites un clic droit sur `aide-build-poe2-main.zip` → **« Extraire tout… »** →
**« Extraire »**. Vous pouvez ensuite déplacer le dossier obtenu où vous voulez (sur le Bureau, par exemple).

**4. Lancer**
Ouvrez le dossier `aide-build-poe2-main` (s'il en contient un autre du même nom, ouvrez-le aussi), puis double-cliquez
sur **`lancer`**.
- La première fois, il installe ce qu'il faut (1 à 2 minutes), puis l'outil s'ouvre dans votre navigateur.
- Si Windows affiche « Windows a protégé votre ordinateur » : cliquez sur **« Informations complémentaires »**, puis
  sur **« Exécuter quand même »**.
- Pour arrêter l'outil, fermez la fenêtre noire. Pour le rouvrir, double-cliquez à nouveau sur `lancer`.

**Mettre à jour** : refaites les étapes 2 à 4, puis copiez le dossier `builds` de l'ancien dossier dans le nouveau pour
garder vos builds.

*Avec Git (pour les habitués)* : `git clone https://github.com/Pauzzle-ozz/aide-build-poe2.git`, puis `git pull`
pour mettre à jour.

## Régénérer les données (après une mise à jour du jeu)

Les données du jeu sont déjà incluses. Pour les régénérer (nécessite Git) :

```bash
npm run setup -- --update   # télécharge Path of Building PoE2, extrait les images, génère les données FR
```

La première fois, cela télécharge environ 800 Mo (dépôt PoB) et ~1 000 infobulles de gemmes sur poe2db (mises en
cache dans `data/cache`). Sans `lancer.bat` : `npm install` puis `npm start` et ouvrir http://localhost:4747.

## Ce que fait l'interface

| Raccourci | Panneau |
|---|---|
| `M` | Mes builds : liste de tous les builds (par classe) et résumé trié du build choisi, avec accès direct à son arbre, ses gemmes, son équipement et ses notes |
| `P` / `Échap` | Arbre passif : glisser pour se déplacer, molette pour zoomer, survol = aperçu du chemin et du coût, clic = allouer / retirer, clic droit sur un nœud d'attribut = Force / Dextérité / Intelligence, barre de recherche (anneaux jaunes comme en jeu) |
| `I` | Équipement, disposé comme l'inventaire du jeu : uniques, objets rares avec vos mods, ou objet collé depuis le jeu (Ctrl+C) |
| `G` | Gemmes : compétences + jusqu'à 5 gemmes de soutien, infobulles FR complètes. Filtre par classe (familles officielles du jeu), soutiens filtrés selon leur compatibilité réelle |
| `C` | Personnage : attributs, points, clés de voûte, total des bonus de l'arbre et de l'équipement |
| `N` | Notes du build (Markdown) |
| `B` | Bibliothèque rangée par personnage : choisissez une classe (portraits en haut) et tout est trié pour elle, avec un sommaire cliquable. **Passifs** : ses ascendances, puis l'arbre commun trié par distance depuis son départ (et par thème). **Gemmes** : sa famille officielle par palier (aptitudes 1→13, esprit 4→14), ses aptitudes d'ascendance, puis les soutiens communs par couleur et palier. **Uniques / Bases** : ses armes, les armures adaptées à ses attributs (par emplacement et type de défense, triées par niveau), puis bijoux, flacons et charmes communs, et enfin les autres armes |
| `H` | Aide + configuration de Claude |

Menu du build (en haut à gauche) : créer, dupliquer, renommer, supprimer, **importer / exporter un code Path of Building**
(liens pobb.in et poe.ninja acceptés). L'export permet de vérifier les dégâts et défenses calculés par PoB.

Les builds sont de simples fichiers JSON dans `builds/`.

**Valider** (en haut à droite) : les modifications d'un build enregistré sont écrites dans un brouillon
(`builds/_brouillon-<id>.json`) et non dans le build lui-même. On peut quitter le build et revenir sans rien perdre ni rien changer :
« Valider » enregistre le brouillon, « Annuler » le supprime. La liste des builds signale ceux qui ont des modifications non validées.

**Termes soulignés** : partout où un texte du jeu s'affiche (notes, arbre, gemmes, équipement, personnage, bibliothèque),
les termes officiels sont soulignés comme en jeu, avec leur définition officielle au survol (glossaire `data/glossary.json`,
tiré de poe2db.tw/fr/Keywords et /us/Keywords). Les noms de gemmes, passifs et uniques ouvrent leur fiche. Dans une
définition, un clic sur un mot souligné ouvre le sien (avec « ← retour »).

**Infobulles « cartes »** (arbre, équipement, gemmes) : elles restent en place ; dans les panneaux Gemmes et Équipement elles se
collent au bord du panneau et suivent la souris en hauteur, puis s'arrêtent quand on va vers elles. Un clic sur la carte la bloque ;
un clic en dehors ou Échap la ferme (ce clic-là ne fait rien d'autre).

**Définitions à côté des cartes** : survol d'un mot souligné = aperçu ; clic = définition gardée ouverte, en colonne à côté de la
carte. Un clic dans une définition ouvre la suivante en dessous ; un clic sur un autre mot de la carte remplace toute la série.

**Panneaux de côté redimensionnables** : glisser le bord intérieur (curseur ↔) ; largeur mémorisée ; double-clic = taille normale.

**FR / EN** (en haut à droite) : bascule les textes du jeu en anglais officiel (passifs, gemmes, objets, définitions, noms de
classes) ; l'interface de l'outil reste en français. Les textes anglais viennent de Path of Building et des pages /us/ de poe2db.

**Bac à sable** (bouton sous « AIDE BUILD POE2 », en haut à gauche) : un mode libre où aucun build n'est sélectionné. On y teste l'arbre, les gemmes et l'équipement sans jamais modifier un build enregistré. Il est conservé à part (`builds/_bac-a-sable.json`), n'apparaît pas dans la liste des builds, peut recevoir une copie d'un build (« Tester dans le bac à sable ») et peut être enregistré comme nouveau build.

## Brancher Claude (MCP)

- **Claude Code** : ouvrez Claude Code dans ce dossier ; `.mcp.json` déclare déjà le serveur `aide-build-poe2`.
  Pour l'avoir depuis n'importe quel dossier :
  `claude mcp add --scope user aide-build-poe2 -- node "C:\Users\...\aide build poe2\src\mcp\server.mjs"`
- **Claude Desktop** : dans `claude_desktop_config.json` :
  ```json
  { "mcpServers": { "aide-build-poe2": { "command": "node", "args": ["C:\\...\\aide build poe2\\src\\mcp\\server.mjs"] } } }
  ```

Le serveur MCP démarre tout seul le serveur local (port 4747) s'il ne tourne pas déjà.

Outils disponibles pour Claude : `etat_outil`, `ouvrir_interface`, `lister_builds`, `creer_build`, `bac_a_sable`, `ouvrir_build`,
`lire_build`, `modifier_build`, `dupliquer_build`, `supprimer_build`, `rechercher_passifs`, `details_passif`,
`allouer_passifs`, `retirer_passifs`, `apercu_chemin`, `choisir_attributs`, `reinitialiser_arbre`,
`rechercher_gemmes`, `details_gemme`, `soutiens_compatibles` (règles de compatibilité de PoB + « une gemme par catégorie de soutien et par aptitude »), `ajouter_competence`, `modifier_competence`, `retirer_competence`,
`rechercher_objets`, `equiper_objet`, `retirer_objet`, `ecrire_notes`, `importer_pob`, `exporter_pob`,
`valider_modifications`, `annuler_modifications`, `glossaire`, `verifier_texte`,
`naviguer_interface` (centrer / surligner / ouvrir un panneau) et `afficher_message` (encart « Claude » dans l'interface).

**Vocabulaire officiel** : les consignes du serveur MCP imposent à Claude les termes du client français. `glossaire` donne
les termes officiels et leur définition (on peut chercher en anglais : « shock » → Électrocution). `verifier_texte` repère
le jargon et l'anglais (crit, AoE, buff, minion…). `ecrire_notes` lance cette vérification automatiquement et demande de
corriger avant de terminer. Les modifications faites par Claude restent aussi en brouillon jusqu'à ce que vous cliquiez sur « Valider ».

Exemples : « Crée-moi un Titan orienté Fracas niveau 70 et explique la progression dans les notes »,
« Montre-moi dans l'arbre les clés de voûte utiles pour un build bouclier d'énergie ».

## Organisation du code

```
scripts/            génération des données (PoB + poe2db + API d'échange FR) et des images
  extract-assets.mjs  textures DDS du jeu -> atlas WebP (web/public/assets)
  build-data.mjs      data/tree.json, gems.json, items.json, translations.json
src/core/           logique partagée navigateur / serveur : arbre, stats, modèle de build, opérations,
                    stockage des builds (build-store), routes de l'API (build-routes, search-routes),
                    conversion PoB, glossaire
src/server/         serveur local : Express, WebSocket temps réel, fichiers builds/*.json
src/mcp/            outils MCP pour Claude (tools.mjs, partagés) ; server.mjs = serveur MCP local (stdio)
web/                interface React (Vite) ; web/src/web/ = version en ligne (builds dans le navigateur, relais Claude)
cloudflare/         Worker de la version en ligne : icônes poe2db, liens PoB, serveur MCP en ligne et relais
```

Mode développement (rechargement à chaud) : `npm run dev`.

## Version en ligne (Cloudflare)

`npm run build:web` construit dans `web/dist-web` une version sans serveur : l'API des builds tourne dans le
navigateur (mêmes routes que le serveur local) et **chaque visiteur garde ses builds dans son navigateur**
(localStorage), avec sauvegarde/restauration dans un fichier depuis « Mes builds ».

**Claude en ligne** : le bouton « ✦ Claude » donne à chaque navigateur un lien personnel secret
`https://<site>/mcp/<jeton>`, à ajouter dans Claude comme connecteur personnalisé (réglages → Connecteurs).
Le Worker y sert les mêmes outils que le serveur MCP local (`src/mcp/tools.mjs`) ; chaque appel est relayé
par un Durable Object (`SessionClaude`, un par lien) vers l'onglet du site, par WebSocket (`/relais/<jeton>`),
et exécuté sur les builds du navigateur. L'onglet doit donc rester ouvert pendant que Claude travaille.

Déploiement **Cloudflare Workers** (configuration dans `wrangler.jsonc`) : projet relié au dépôt GitHub,
nom `aide-build-poe2` (le même que dans `wrangler.jsonc`), Build command `npm run build:web`,
Deploy command `npx wrangler deploy`, Path `/`. Chaque `git push` sur `main` republie le site.
Test en local : `npm run build:web` puis `npx wrangler dev`.

## Traductions

Tout est affiché en français. Ordre de priorité : textes officiels du jeu (poe2db FR, API officielle du site d'échange FR), puis traductions manuelles (`scripts/data/traductions-manuelles.json`) pour le contenu que le jeu n'a pas encore traduit ; celles-ci sont signalées « Traduction non officielle » dans les infobulles. Après une mise à jour des données, `scripts/data/a-traduire.json` liste ce qui reste à traduire.

## Limites connues

- Pas de calcul de DPS / défenses intégré : exportez vers Path of Building pour ça.
- Une centaine de notables récents n'ont pas encore de nom français dans les données du jeu : ils restent en anglais.
- Les sets d'armes (points de passif par set) sont conservés à l'import/export PoB mais pas éditables dans l'arbre.

## Sources et crédits

- [Path of Building Community — PoE2](https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2) : arbre passif, gemmes, objets, images.
- [poe2db.tw/fr](https://poe2db.tw/fr/) : noms, effets et infobulles en français.
- API officielle du site d'échange (fr.pathofexile.com) : traduction des modificateurs.
- [Kami Labs — guide débutant PoE2](https://kami-labs.fr/path-of-exile-2/guide-debutant-path-of-exile-2/) (lien dans l'aide).

Path of Exile 2 et ses images sont la propriété de Grinding Gear Games. Outil de fan non officiel, non affilié à Grinding Gear Games.
