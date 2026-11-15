# Progression : campagne → premières cartes → endgame (patch 0.5 / 0.5.5)

Sources : maxroll (leveling guide 0.5.5, permanent stats, trials, atlas), domistae (guides leveling/endgame
0.5.5), mobalytics et game8 (extraits), kami-labs, poe2db (paliers de gemmes). Les seuils chiffrés de vie et
de dégâts par seconde viennent de sites non officiels : ordres de grandeur, pas des règles. ⚠ La 1.0 (11/12/2026) remplace
les Interludes par les Actes 5-6 : la structure de campagne ci-dessous sera à revérifier.

## Sommaire
1. Structure de la campagne et récompenses permanentes
2. Principes de leveling (gemmes, arme, objets, résistances, mouvement)
3. Aptitudes de leveling par classe et transitions
4. Ordre des Épreuves d'ascendance
5. Premières cartes et milieu de jeu (T1 → T15)
6. Endgame
7. Erreurs fréquentes
8. Gabarit de plan par paliers

---

## 1. Campagne 0.5

- 4 actes + 3 Interludes. Repères de niveau : Acte 1 : 1-14, Acte 2 : 14-29, Acte 3 : 30-42, Acte 4 : 42-52,
  Interludes : 52-59 ; cartes à partir du niveau ~65 (zone 65 = T1).
- **Points de passif bonus (24, = Points de Talent d'Ensemble d'armes)** — noms anglais des sources (le nom FR
  en jeu peut différer) : Acte 1 (Crowbell, Una's Lute), Acte 2 (Kabala, Final Letter / Shambrin), Acte 3
  (Mighty Silverfist, Sacrificial Heart), Acte 4 (Omniphobia, Yama the White), Interludes (Oswin, Clearing the
  Way, Abominable Yeti + Hooded One à Kingsmarch). Ne pas les rater.
- **Esprit** : +30 Acte 1 (Roi des Brumes, Freythorn), +30 Acte 3 (Ignagduk, Azak Bog), +40 Interlude 3
  (Lythara, Kriar Village).
- **Résistances** : +10 % froid (Acte 1), +10 % foudre (Acte 2), +10 % feu (Acte 3), +5 au choix (Halls of the
  Dead, définitif), option +5 % toutes (Qimah, modifiable, conseillée par défaut).
- Autres : +20 vie, +5 % vie, +5 % mana ; Valley of the Titans (+1 emplacement de Charme ou bonus de charges),
  Venom Crypts (+25 % Seuil d'Étourdissement, +30 % Seuil d'Altération élémentaire ou +25 % régénération de
  mana — **définitif**, choisir selon les faiblesses du build).
- Quête Acte 4 : choix de 15 % de l'armure appliquée aux dégâts élémentaires ou 12 % de Déviation (selon PoB).

## 2. Principes de leveling

- **Le niveau de gemme fait l'essentiel des dégâts** au début, surtout pour les sorts et les créatures. Monte
  l'aptitude principale avec les gemmes brutes ; réserve les gemmes brutes de haut niveau à l'aptitude
  principale. Kabala (Acte 2) lâche une gemme niv. 7 : gros saut de puissance.
- **Attaques : l'arme avant tout.** Regarde les vendeurs à chaque passage (« 2 minutes de recherche peuvent
  doubler tes dégâts ») ; sinon prends une base normale de ton niveau et améliore-la (orbes de Transmutation,
  d'Augmentation, Régal, d'Alchimie) ; viser 2 châsses de rune (Iron Rune, la plus utile en leveling). Blacksmith's Whetstone (qualité d'arme) vers le niv. 30.
- **Sorts** : +niveaux de sorts (baguette, sceptre, focaliseur, amulette), vitesse d'incantation, mana.
- **Créatures** : « +1 au niveau des gemmes de Créatures » = la meilleure amélioration du début.
- **Priorité d'objets en campagne** (maxroll) : vitesse de déplacement > résistances > vie > dégâts de base >
  multiplicateurs > défenses. La rareté ne compte pas : un objet magique bat souvent un rare.
- Bottes : 10 % (niv. 1) → 15 % (16) → 20 % (33) → 25 % (46) → 30 % (65) de vitesse de déplacement.
- Flacons à jour (Medium 4, Greater 10, Grand 16, Giant 23, Colossal 30, Gargantuan 40, Transcendent 50,
  Ultimate 60) ; suffixes de recharge. Charmes : pierre (Étourdissement), dégel (Gel), élémentaires pour les boss.
- **Jeu de hasard** chez les marchands (un par acte, payé en or) : bases précises (arme, bagues, amulette pour
  +niveaux).
- **Résistances** : ≥ 30 % en campagne, plus contre les boss d'un élément (froid pour le Comte Geonor fin
  d'Acte 1 — Bague de saphir vers le niv. 15 ; feu et foudre en Actes 2-3).
- **Arbre** : aller droit à la première grappe de dégâts de l'aptitude, puis alterner dégâts / vie / défense ;
  prendre tôt les nœuds d'attributs bonus (Aguerri / Battle-hardened). Respec bon marché au début (or).
- Mobilité : Roulade (frames d'invulnérabilité) ; un Bond percutant sur l'Ensemble 2 pour franchir les rebords.

## 3. Aptitudes de leveling et transitions (0.5)

Palier de gemme → niveau requis : 1→1, 3→6, 5→14, 7→22, 9→31, 11→41, 13→52. Vérifie le palier avec
`details_gemme` ; une aptitude finale de palier élevé impose une aptitude de transition.

| Classe | Leveling | Transition / finale typique |
|---|---|---|
| Guerrier | Fracas déferlant (Rolling Slam) + Acharnement I ; Brise-os sur cible « préparée » ; Mur de bouclier dès l'Acte 2 (bouclier niv. 16+ avec ≥ 60 armure, Cri infernal, Cri fortifiant) | Bond percutant, Pieux telluriques (7), Déferlement tellurique (9) |
| Rôdeuse | Flèche de foudre (1) + Paratonnerre jusqu'au niv. 30 | **Tir de glace au niv. 31** (palier 9), + Tir d'élite pour les boss |
| Chasseresse | Taillade tourbillonnante ×3 puis Trombe (1) — besoin de vitesse d'attaque ; ou Lance de foudre (3) | Trombe endgame (Gemling / Marcheuse spirituelle) |
| Mercenaire | Carreaux à fragmentation + Grenade explosive (1) ; Éclats galvaniques au niv. 14 ; Grenade suffocante (5), Grenade à huile pour les boss | Conflagration (13 = niv. 52), grenades Tacticien / Gemling |
| Sorcière | Contagion (1) puis Drain d'essence (3) — classique, toutes ascendances ; créatures : Tireurs d'élite squelettiques, Exhumation, Tempête d'ossements | Drain d'essence Liche, Créatures, Infernaliste |
| Magicienne | Étincelle (1), Bombe de givre (1), Orbe des orages (3), Infusions de froid ; Mur de flammes au début | Comète (11 = niv. 41), Nova de glace, Djinns (Disciple) |
| Moine | Paume meurtrière (1, génère des Charges de pouvoir) + Grondement de tonnerre (1, les dépense) ; Cloche tempétueuse (3) | Frappe de glace (5 = niv. 14), **Assaillement tourbillonnant au niv. 41** (11) |
| Druide | Volcan (1), Fracas bestial, Fureur de la montagne (ours de feu) ; ou Wyverne + Barrage d'huile ; ou Plantes (Enchevêtrement) | Oracle Plantes / Totems, Chaman |

Le Moine démarre lentement avant la 1ʳᵉ ascendance (peu de dégâts dans ses premiers passifs) : le signaler.

## 4. Épreuves d'ascendance

| Points | Épreuve | Moment typique |
|---|---|---|
| 1-2 | Épreuve des Sekhemas (Acte 2, clé : Balbala's Barya) | Acte 2 ; attendre ~niv. 28 aide (Honneur) |
| 3-4 | Épreuve du Chaos (Acte 3, clé : Chimeral Inscribed Ultimatum) | Acte 3 ; résistances feu/froid pour le boss |
| 5-6 | Sekhemas niv. 60+ (3 épreuves) ou Chaos niv. 65+ (10 épreuves) | fin de campagne / premières cartes |
| 7-8 | Sekhemas niv. 75+ (4 épreuves, boss Zarokh) ou Chaos 65+ avec boss et fragments | cartes T11+ (niv. 75-85) |

- Depuis 0.5 on peut changer d'ascendance **au sein de la même classe** (désallouer puis refaire une épreuve
  donnant au moins autant de points) — règles exactes de coût non vérifiées.
- **Ordre des nœuds** : prends d'abord ce qui fait avancer le personnage *maintenant* (souvent la défense ou le
  moteur de leveling), puis le multiplicateur endgame. Exemples : Sagittaire → spécialisation de distance,
  Munitions infinies, Vents convergents, Tireur d'élite mirage ; Artiste martial → Forme vide + Voie du Poing
  de pierre, puis Méridiens runiques ; Disciple → Barya de Kélari + Tromperie, Barya de Ruzhan, Le Quatrième
  enseignement, Rituels sacrés. Lis toujours `ascendances/<classe>.md` pour adapter.
- Ascendances confortables pour débuter (tier lists « starter » 0.5) : Sagittaire, Infernaliste, Artiste
  martial, Marcheuse spirituelle, Tacticien, Légionnaire Serti.

## 5. Premières cartes et milieu de jeu (zone 65 → 79, T1 → T15)

- **Avant la T1** : résistances élémentaires à **75 %** (pénalité −60 %), flacons Ultimate, bottes 25-30 %,
  3ᵉ ascendance en cours, aptitude finale en place si possible.
- **Atlas 0.5** : Waygate à la Ziggurat, premier contrat de bête (Hilda), Precursor Tower → Fortress ; points
  d'Atlas via les cartes de Fortress, les Towers et les pinacles ; paliers de quête T6, T11, T14 ; priorité
  aux chances de Waystones. Les Waystones doivent être identifiées (0.5). Stationner en T11 pour s'équiper et
  finir les niveaux est un bon plan.
- **Repères (non officiels)** :
  - défense : ~2 000-3 000 PV effectifs en T1-T10, ~3 000+ pour T15 ; chaos positif à partir de T11 ;
  - dégâts par seconde mono-cible : ~100 k pour passer T15 de justesse, 200-500 k pour farmer confortablement, 1 M+ pour les
    boss ultimes ; auto-test : un rare meurt en moins de 3 s, sinon renforcer avant de monter.
- **Monter en puissance avec peu de monnaie** : résistances → vie → arme ; bagues et arme sont les achats les
  plus rentables ; crafter soi-même (Essences, Runes, Arbre de la Genèse de Breach pour bijoux et ceintures,
  Présages de Ritual).
- **Quand passer au build « final »** : quand les pièces qui activent le moteur sont disponibles (unique clé,
  arme à fort dégâts par seconde, assez d'Esprit pour la méta-gemme, seuil de Touche critique atteint). Avant, garder la version budget
  plutôt que d'acheter des multiplicateurs sans défense.

## 6. Endgame (80+)

- 4ᵉ ascendance ; clé de voûte défensive au bon moment (Inoculation du Chaos vers 3 000-6 000 ES selon les
  guides) ; Touche critique si le build s'y prête ; Joyaux (souvent sous-estimés, gros impact dans les builds de sorts) ;
  soutiens de lignage ; uniques « build-enabling » ; résistance au chaos 50-75 % ; max res ; réponses à toutes
  les altérations. Vérifier dans PoB (boss ultimes ≈ 50 % de résistances élémentaires).

## 7. Erreurs fréquentes

- Garder un rare ou un unique moins bon qu'un objet magique ; ignorer les vendeurs (attaques).
- Bottes et flacons pas à jour ; rester immobile.
- 50 % de résistance au lieu de 75 % (= dégâts élémentaires subis doublés) ; affronter le Comte Geonor sans
  résistance au froid.
- Gaspiller les gemmes brutes de haut niveau ; monter des gemmes au-delà de son mana ; garder des soutiens
  coûteux sans valeur (Accélération).
- Rater des points de passif ou de l'Esprit ; faire un choix définitif (Venom Crypts, tatouages) sans
  réfléchir au build.
- Entrer dans les Sekhemas sans assez de vie ni de reliques.
- Monter de palier de cartes trop vite ; négliger le seuil d'Étourdissement et les mods de Waystone ; ne pas
  suivre le scénario de la Fortress.
- Passer aux Touches critiques ou à l'hybride trop tôt (attendre une bonne arme).

## 8. Gabarit de plan par paliers (à adapter)

Pour chaque palier, donne :
- **Aptitudes** (et soutiens validés par `soutiens_compatibles`), avec ce qui change par rapport au palier
  précédent ;
- **Passifs** à prendre dans l'ordre (coût en points), et ce qu'on respec en arrivant au palier ;
- **Ascendance** (points disponibles à ce palier) ;
- **Objets** : 2-3 priorités ; une base / un unique accessible ;
- **Défense** : résistances visées (pénalité de l'acte comprise), vie/ES, couche ajoutée ;
- **Esprit** : réservations possibles avec l'Esprit disponible à ce moment ;
- **Signal de passage** au palier suivant (niveau, gemme débloquée, objet obtenu, palier de cartes).

Paliers suggérés : niv. 1-15 / 15-30 / 30-50 / 50-65 (fin de campagne) / cartes T1-T10 / T11-T15 / endgame.
Dans l'outil, un build par palier (« Nom 1/4 — Niv. 1 à 15 »…) avec des notes complètes.
