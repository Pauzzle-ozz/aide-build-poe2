# Ressources et systèmes : Esprit, mana, attributs, points, Ensembles d'armes, gemmes, méta-gemmes

Sources : PoB PoE2 (données des gemmes, `QuestRewards.lua`, `Data.lua`), notes de patch 0.3-0.5, maxroll,
game8, mobalytics, mémoire du projet (règles vérifiées dans les données). Valeurs de coût à revérifier avec
`details_gemme` (elles varient avec le niveau de la gemme).

## Sommaire
1. Points de passif et d'ascendance
2. Ensembles d'armes
3. Attributs et prérequis
4. Esprit (budget et coûts)
5. Mana
6. Gemmes : emplacements, soutiens, paliers, lignage
7. Méta-gemmes et Énergie (Déclenchement lors de…, Évocations, Totems)
8. Charges, Rage, Enchaînement, Infusions et autres ressources de combat

---

## 1. Points

- **123 points de passif** au niveau 100 : 99 (1 par niveau) + **24 Points de Talent d'Ensemble d'armes**
  (12 quêtes × 2). Quelques points bonus en endgame (Martyr du Premier Édit, faveur d'Olroth : non vérifié
  dans les données).
- **8 points d'ascendance** : 4 Épreuves × 2 (voir `progression.md` pour l'ordre et les niveaux).
- Chasseur de sorcières : un nœud transforme 100 points normaux en points d'Ensemble d'armes (second arbre).
- Respec : payant en or, coût croissant avec le niveau (Hooded One à l'Acte 1, puis Doryani) ; nœuds
  d'attributs à −50 %. Pense la respec dans le plan de progression (aptitude de leveling ≠ aptitude finale).

## 2. Ensembles d'armes

- Deux ensembles (touche de changement). Les 24 Points de Talent d'Ensemble d'armes peuvent être placés
  **séparément** pour l'ensemble 1 et l'ensemble 2 (jusqu'à 24 nœuds propres à chacun), actifs seulement quand
  l'ensemble correspondant est équipé. Une branche commencée avec un ensemble ne se prolonge pas avec l'autre.
  Les sources tierces disent qu'ils ne vont ni dans les clés de voûte ni dans les châsses de joyau (non vérifié).
- Chaque aptitude est **affectée** à un ensemble (ou aux deux) : elle utilise les passifs et l'arme de cet
  ensemble. Usages typiques :
  - isoler une Marque, une malédiction, un Sceau de pouvoir, Trombe ou Forme vide sur l'ensemble 2 avec des
    passifs dédiés ;
  - arme de mobilité / utilitaire (masse bas niveau + Bond percutant pour franchir les rebords) ;
  - deux spécialisations (physique sur l'ensemble 1, chaos sur l'ensemble 2…).
- Pièges : mauvaise affectation = buffs perdus ou totems qui disparaissent ; **Esprit différent entre les
  ensembles** = réservations qui sautent au changement (duplique la source d'Esprit, ex. même sceptre).
- L'outil conserve les sets à l'import/export PoB mais ne les édite pas encore dans l'arbre (README).

## 3. Attributs

- Force : +2 vie par point (moitié avec Sang de géant). Intelligence : +2 mana par point. Dextérité :
  précision (+5 ou +6 par point selon les sources). Pas de bonus de dégâts inhérent.
- Classe de départ (For/Dex/Int) : Guerrier 15/7/7, Rôdeuse et Chasseresse 7/15/7, Mercenaire 11/11/7,
  Moine 7/11/11, Magicienne et Sorcière 7/7/15, Druide 11/7/11.
- Prérequis d'une gemme ≈ arrondi((5 + (niveau requis − 3) × 1,7) × (pondération/100)^0,9) + 4 (PoB) : une
  gemme mono-attribut de niveau 20 (niveau requis 90) demande ~155-160. **Chaque soutien ajoute +5** au
  prérequis de sa couleur sur l'aptitude. Un soutien dont le prérequis n'est pas rempli est désactivé (0.3).
- Nœuds « +5 à n'importe quel Attribut » : choix For/Dex/Int (`choisir_attributs`). Prends seulement ce qu'il
  faut pour les gemmes et l'équipement, le reste en Force (vie) en général.
- Contournements : Capacité d'adaptation (Légionnaire Serti : tous les prérequis avec l'attribut le plus
  haut), Efficacité accrue (double les bonus inhérents des attributs), Voie du Poing de pierre (ignore les
  prérequis des gants).

## 4. Esprit

- **0 de base**. Quêtes : **100 au total** — +30 Roi des Brumes (Freythorn, Acte 1), +30 Ignagduk (Azak Bog,
  Acte 3), +40 Lythara (Kriar Village, Interlude 3). +10 en endgame (faveur d'Uhtred, non vérifié).
- Équipement : **sceptre** (~100 de base, la plus grosse source ; un seul), torse (implicite / préfixe),
  amulette (implicite), uniques (Hurlement de l'Alpha +100, Aubétreinte +100, Étreinte du Paria +50, Mante
  animique +75…). Le préfixe « Lord's » est passé à 20-26 % d'Augmentation d'Esprit en 0.5.
- Ascendance : « Guidez-moi à travers la Grâce… » (Évocateur, Esprit selon l'ES/évasion du torse), Flux sacré
  (Chaman, +40 par emplacement de Charme vide), Volonté de Beidat (Infernaliste, Esprit selon la vie réservée),
  Tacticien (réductions de coût).
- **Coûts typiques (PoB 0.5)** :
  | Coût | Gemmes |
  |---|---|
  | 30 | Hérauts (glace, tonnerre, cendre, peste), Danseur du vent, Danse fantomatique, Régulation des charges, Reliquats de Mana, Armure arctique, Berserk, Frénésie du combat, Convalescence, Siphonnage des éléments, Attrition, Festin sinistre |
  | 60 | Meute de loups, Archer mirage, Conflux élémentaire |
  | 100 | Déclenchement lors de Critiques, Déclenchement lors d'Altérations élémentaires, Archimage, Trinité, Rage éternelle |
  | 75 / totem | Lien ancestral |
  | variable | Créatures et compagnons (selon niveau ; Domptage de bête = % de l'Esprit max) |
  Blasphème : coût par malédiction (≈60, game8). Les soutiens ajoutés à une gemme d'Esprit augmentent sa
  réservation.
- Modificateurs : Confiance mutuelle (+30 % d'efficacité pour les Compagnons, −20 % pour le reste), Seigneur
  des Terres sauvages (50 % de Perte d'Esprit), Idolâtrie (Marcheuse spirituelle, efficacité par Idole).
- **Budget** : liste toujours les réservations et leur total vs l'Esprit disponible **à ce palier**
  (100 en fin de campagne sans sceptre ; ~150-250 en endgame selon l'équipement). Ex. classique : 2 Hérauts
  (60) en fin de campagne, puis une méta-gemme à 100 avec le sceptre.

## 5. Mana

- Mana maximal ≈ 4 × niveau + 30 + 2 × Intelligence (PoB) ; régénération 4 %/s de base.
- Chaque soutien multiplie le coût (souvent ×1,2) ; les +niveaux de gemme augmentent le coût. Gemmes gardées
  bas niveau par choix : Taillade tourbillonnante 1, Enchevêtrement 1, Volcan ≤ 7, Bombe vivante 3…
- Solutions : Drain de mana, mana à la mort, Efficacité I, Esprit de Lavianga (flacon de mana permanent, très
  joué), régénération, Batterie surnaturelle, Magie du sang (coûts en vie), Pacte pyromantique (Infernaliste).
- Signal d'alerte : un build qui doit s'arrêter de lancer pour attendre son mana manque de *récupération*,
  pas forcément de mana maximal.

## 6. Gemmes

- **9 aptitudes** actives de base (+3 pour le Légionnaire Serti) ; jusqu'à **5 soutiens** par aptitude :
  2 châsses de soutien de base, portées à 3 / 4 / 5 par les Orbes du joaillier inférieur / supérieur / parfait
  (ils fixent le nombre de châsses ; game8, poe2wiki). En leveling, réserve les Orbes du joaillier à l'aptitude
  principale. Certaines aptitudes d'ascendance gagnent des châsses avec le niveau du personnage (Forme vide,
  Protecteur sauvage : 5ᵉ au niv. 65).
- On ne peut pas sertir deux copies de la même gemme d'aptitude dans les emplacements principaux (0.3).
- **Soutiens** : une même gemme de soutien peut servir sur **plusieurs aptitudes** (0.3 : « You can use as many
  copies as you like ») ; **une seule gemme par Catégorie de soutien au sein d'une aptitude** (ex. Armement
  élémentaire I et III dans le même groupe → non ; texte du jeu + PoB). Toujours `soutiens_compatibles`.
- **Paliers (tiers)** → niveau du personnage pour la gemme brute : 1→1, 3→6, 5→14, 7→22, 9→31, 11→41, 13→52.
  Niveaux de gemme → niveau requis : 5→14, 10→36, 15→64, 16→66, 17→72, 18→78, 19→84, 20→90 (après 66, chaque
  niveau coûte ~6 niveaux de personnage, d'où l'importance des « +niveaux » d'équipement en endgame).
- Gemmes brutes (Uncut) : Aptitude (niv. 1-20, à réserver à l'aptitude principale pour les hauts niveaux),
  Soutien (paliers I à V), Esprit (niv. 4-20). Prisme de lapidaire (Gemcutter's Prism) : qualité, pour les gemmes qu'on garde.
- **Qualité** : effets propres à chaque gemme ; avec Thaumaturgie avancée (Légionnaire Serti) la qualité donne
  des effets supplémentaires → axe de puissance.
- **Soutiens de lignage (Lineage)** : très puissants, endgame ; Solus Ipse permet des copies supplémentaires.
- **Corruption / Flux thaumaturgique** : peut faire monter le niveau, mais irréversible ; la corruption peut
  aussi faire perdre niveau ou qualité.

## 7. Méta-gemmes et Énergie

Une méta-gemme héberge des aptitudes et les déclenche quand son **Énergie** atteint le maximum, puis repart à 0.
Méta-gemmes présentes dans les données 0.5 : Déclenchement lors de Critiques, lors d'Altérations élémentaires,
lors de l'Esquive, lors de la mort d'une Créature (Esprit) ; Déclenchement en Bloquant, lors de l'utilisation
d'un Charme ; Évocation élémentaire / de barrière / de Ravageur / féroce ; Totem incantateur, Totem Guerrier
ancestral ; Projection de sortilèges ; Canon mortier ; Forme vide ; Bondissement. (Déclenchement lors
d'Électrocution n'apparaît pas dans les données 0.5 → ne pas le conseiller sans vérifier.)

- **Gain d'Énergie** (game8/maxroll, à revérifier dans `details_gemme`) : Critiques → selon la rareté/Puissance
  de l'ennemi touché (normal 1, magique 2, rare 5, unique 20) ; Esquive → par mètre de Roulade ; mort d'une
  Créature → selon sa Puissance ; Altérations élémentaires → par Gel/Embrasement/Électrocution infligé ;
  Évocation élémentaire → par altération élémentaire ; Évocation de barrière → par ES perdue ; de Ravageur → par
  ennemis tués en mêlée ; féroce → par mana dépensé.
- Le coût d'un sort déclenché en Énergie dépend de son temps d'incantation de base → les sorts lents (Comète)
  coûtent cher : il faut **beaucoup de Touches**, pas de gros coups.
- Cadence rituelle (clé de voûte) : les Évocations déclenchent toutes les 2 s, sans gagner d'Énergie pendant.
- Fluctuation (Fluke) : −40 % à +60 % de dégâts sur les sorts déclenchés.
- **Totem incantateur** : seul le niveau du sort compte ; limite 1 de base (2 avec Totem incantateur niv. 14,
  +1 Bois de cœur sans nom, ×2 Lien ancestral). Les totems utilisent vos modificateurs de sort.

## 8. Ressources de combat

- **Charges** (endurance / frénésie / pouvoir) : 3 maximum chacune, 15 s ; **aucun bonus inhérent en PoE2** —
  ce sont des ressources consommées par des aptitudes (Tir de barrage +1 répétition par Frénésie, Frappe
  fulgurante, Totem incantateur, Déchirure, Forme vide…) ou par Régulation des charges (consomme une charge de
  chaque type toutes les ~4,3 s pour des Davantage). Résonance permute les types ; Conducteur de Charges les
  donne aux alliés.
- **Rage** : 30 max de base, coûts fixés à 10 (0.4) ; Faim primitive la transforme.
- **Enchaînement (Combo)** : cumuls gagnés par les Frappes réussies, perdus au changement d'arme (sauf Maître
  martial) ; consommés par des aptitudes (Cloche tempétueuse : 4 ; jusqu'à 3 cloches en 0.5) ;
  Culmination, Enchaînement destructeur, Enchaînement maîtrisé les scalent.
- **Momentum** : après 2 m parcourus pendant l'utilisation, 40 % Davantage pour le reste de l'utilisation.
- **Infusions et Reliquats** (Magicienne) : Claquement, Bombe de givre ou un Gel créent des Reliquats
  d'Infusion (12 s) ; certains sorts consomment les Infusions (≈3× les dégâts de Nova de glace / Dards de
  givre). 3 Infusions stockées par défaut ; Équilibre élémentaire change l'élément des Reliquats.
- **Gloire** (Étendard de guerre, Marteau des Dieux), **Instabilité**, **Vent porteur** (Sagittaire), **Plumes**
  (Marcheuse spirituelle) : ressources d'ascendance/aptitude — lire le texte dans `ascendances/`.
