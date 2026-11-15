# Théorie : défenses (PoE2, patch 0.5)

Sources : code PoB PoE2 (`CalcDefence.lua`, `Data.lua`, `Data/Misc.lua`), notes de patch 0.3 à 0.5, maxroll
(Defence Guide — partiellement obsolète : il parle encore de « Cruel »), game8, guides de builds.
Principe : **aucune couche ne suffit seule**. Un build doit répondre aux trois menaces — gros coups physiques,
dégâts élémentaires/chaos, altérations et dégâts sur la durée — avec mitigation + réserve + récupération.

## Sommaire
1. Résistances
2. Armure
3. Évasion et Déviation
4. Bouclier d'énergie
5. Blocage
6. Réserves particulières : Égide runique (Runic Ward), Mana (L'Esprit dépasse la Matière)
7. Seuils (Étourdissement, Altération) et altérations subies
8. Récupération : Drain, Recoup, régénération, flacons, charmes
9. Clés de voûte défensives
10. Valeurs repères par palier
11. Diagnostiquer « je meurs »

---

## 1. Résistances

- Maximum de base **75 %**, plafond absolu 90 % (« +X % à la Résistance maximale »). Le négatif augmente les
  dégâts subis (passer de 75 % à 50 % **double** les dégâts élémentaires subis).
- **Pénalité de campagne cumulée** (poe2wiki / PoB, 0.5) : −10 % par acte → −30 % après l'Acte 4, −40 % puis
  −50 % dans les Interludes (zones 54-59 puis 60-64), **−60 % en endgame** (zone 65+). Le chaos n'a pas de
  pénalité. En endgame il faut donc ~**135 %** brut par élément pour être à 75 % (moins les bonus de quête :
  +10 % froid, foudre et feu, +5 % au choix, option +5 % toutes résistances chez Qimah → 115-125 % sur
  l'équipement).
  ⚠ La 1.0 (6 actes) changera probablement ces paliers.
- Objectifs : ≥ 30 % pendant la campagne (plus pour les boss d'un élément précis : froid contre le Comte
  Geonor fin d'Acte 1, feu pour les Actes 2-3) ; **75 % élémentaire avant les premières cartes** ; chaos qui
  monte progressivement (viser positif dès les cartes moyennes, 30-75 % en endgame, ou Inoculation du Chaos).
  Surcap utile contre les malédictions et l'Inflammabilité ennemies.

## 2. Armure

- Réduction des dégâts physiques d'une Touche = **A / (A + 10 × D)** (PoB `ArmourRatio = 10` ; maxroll écrit
  12, PoB fait foi pour les calculs), plafond **90 %**. Exemple : 10 000 d'armure vs coup de 1 000 → 50 % ;
  vs coup de 5 000 → 16,7 %. **Forte contre les petits coups, faible contre les gros.**
- Depuis 0.4, l'armure ne peut plus ramener un coup à 0 (minimum 1).
- « X % de l'Armure s'applique aussi aux Dégâts élémentaires » (récompense de quête Acte 4 : 15 %, objets,
  soutiens Réfraction, bases comme Cuirasse de Seigneur de guerre / Paumelles vaal) : rend l'armure utile contre
  l'élémentaire (cœur des builds Titan Force/Armure et Mur de bouclier).
- Réflexes de fer (Iron Reflexes) : convertit l'évasion en armure.
- 0.5 : armure et évasion de base des objets +33 % au niveau 65, +15 % de plus au niveau 80.

## 3. Évasion et Déviation

- **Évasion** : depuis la 0.3, fonctionne contre **toutes les Touches** (attaques, sorts, zones), **sauf** les
  attaques de boss signalées par un flash rouge (notes 0.3.0 ; Acrobatie supprimée). Chance d'être touché
  (PoB) ≈ 1 − 0,95 × E / (E + 4 × Précision ennemie), évasion plafonnée à 95 %. Ne protège pas des DoT.
- **Déviation (Deflection)** : chance = 150 × (1 − A / (A + 0,12 × D)) (A = précision de l'attaquant,
  D = score de Déviation), plafond 95 % (0.5). **Un coup dévié perd 40 % de ses dégâts** (PoB) ; jet séparé
  de l'évasion. Sources : « Gain de Déviation égal à X % de l'Évasion » (gants, bottes, torse), petits nœuds
  (8 % en 0.5), récompense de quête Acte 4 (12 %). Coups déviés (Glancing Blows) : évasion Défavorable,
  Déviation Favorable.
- Couche typique Dextérité : évasion + Déviation + Vent porteur (Sagittaire) + Aveuglement des ennemis.
  Faiblesse : gros coups qui passent, DoT, attaques à flash rouge → ajouter une réserve (ES/vie) et du chaos.

## 4. Bouclier d'énergie (ES)

- Protège la vie de tout **sauf** le Saignement et le Poison (le poison contourne l'ES selon poe2db) ; le
  **chaos retire le double d'ES** (PoB).
- **Recharge** : 12,5 % du maximum par seconde après **4 s** sans dégâts (PoB). 0.5 a transformé beaucoup de
  nœuds de vitesse de recharge en « Démarrage de la Recharge plus rapide ». Leviers : Le Quatrième enseignement
  (Disciple), Adepte martial (−0,2 s par cumul d'Enchaînement dépensé), Danse fantomatique (Ghost Dance :
  régénère 2 % de l'évasion par seconde en ES en 0.5).
- Le seuil d'Étourdissement est basé sur la vie : un build ES a besoin de « Seuil d'Étourdissement basé sur
  l'ES » ou d'un Charme de pierre, sinon il se fait étourdir.
- Batterie surnaturelle (Eldritch Battery) : l'ES devient du mana (coûts doublés). Serment du Zélote, Jeunesse
  éternelle, Foi meurtrie : variantes de récupération (lire `cles-de-voute.md`).

## 5. Blocage

- Maximum de base 50 %, plafond absolu 90 % (PoB). Contre les Touches de face (Levée de bouclier pour le blocage
  actif, jauge de garde). Bâtons de barrière : 12-18 % de blocage. Bloquer empêche les altérations du coup.
- Rempart (Bulwark), Coups déviés : modifient les règles (lire leur texte). 0.5 : Barrière importante (Wide Barrier) et
  Cœur du Gardien (Core of the Guardian) donnent 30 % d'Augmentation des chances de Bloquer.

## 6. Réserves particulières

- **Égide runique (Runic Ward, 0.5)** : réserve qui prend le relais quand la vie tombe à 1, après l'ES puis la
  vie, et se régénère seule. Obtenue par Runeforging (enclume de Verisium) ; les armures sous le niveau 55
  l'obtiennent sans contrepartie. Ressource des aptitudes kalguuranes.
- **L'Esprit dépasse la Matière (Mind Over Matter)** : les dégâts frappent le mana avant la vie (50 % de Perte de
  récupération de mana) → builds « mana stacking » ; très joué (16 % des persos en Forbidden Rites).
- Débordement jusqu'à 2× le maximum possible : Sanguinomancie (vie), Festin sinistre (ES), Reliquats de Mana.
- Transfert de dégâts : « Physique subi sous forme de Foudre » ne s'applique pas aux DoT ; « sous forme de Feu »
  s'applique aussi au Saignement (maxroll).

## 7. Seuils et altérations subies

- **Seuil d'Étourdissement = Vie maximale** (PoB) ; récompense de quête au choix +25 %. Trop peu de vie =
  « mini-étourdissements » constants. Le joueur ne subit pas d'Étourdissement massif… sauf effets précis.
- **Seuil d'Altération** du joueur ≈ 50 % de la vie (PoB, non confirmé en jeu) ; quête : +30 % de Seuil
  d'Altération élémentaire.
- Réponses aux altérations : **Charmes** — Charme de dégel (Gel), Charme de pierre (Étourdissement),
  Charme paratonnerre (Électrocution), Charme d'extinction (Embrasement), Charme de cicatrisation (Saignement),
  Charme antidote (Poison), Charme purifiant ; Charmes en rubis / saphir / topaze contre les boss d'un élément —,
  résistances (réduisent la durée/l'effet), immunités d'ascendance ou d'uniques.
- 0.5 : le Saignement subi par les joueurs n'est plus doublé quand ils bougent (sur les monstres, si).
- Toughness ennemie négative (0.5) : more damage taken (−100 % double les dégâts subis).

## 8. Récupération

- **Drain (Leech)** : 0.5 → **une seule instance par ressource** (la plus rapide), dégâts par coup plafonnés à
  40 000 pour le calcul, plus de Drain instantané. Ne drainer que le type de dégâts qu'on inflige.
  Pacte vaal (0.5) : +50 % de vie drainée, −67 % de vitesse, la vie ne se récupère que par le Drain.
- **Recoup** : les dégâts subis reviennent sur 8 s (4 s avec certains modificateurs ; nœuds de vitesse de
  Recoup en 0.5). Excellent contre beaucoup de petits coups ; Sacrosanctum convertit le Recoup de vie en ES.
- **Régénération** : vie (nœuds, objets), mana (4 %/s de base).
- **Flacons** : paliers de base (Medium niv. 4, Greater 10, Grand 16, Giant 23, Colossal 30, Gargantuan 40,
  Transcendent 50, Ultimate 60) ; Oasis : pas de Charmes mais 30 % Davantage de récupération des flacons.

## 9. Clés de voûte défensives (texte exact dans `cles-de-voute.md`)

| Clé de voûte | Pour qui | Attention |
|---|---|---|
| Inoculation du Chaos | builds ES purs (prise vers 3 000-6 000 ES selon les guides) | vie = 1 ; incompatible avec les effets « contourne l'ES » (Protection épaisse) ; baisse le seuil d'Étourdissement ; jamais de flacon qui retire de la vie |
| L'Esprit dépasse la Matière | gros mana (Int, Batterie surnaturelle) | récupération de mana réduite |
| Batterie surnaturelle | lanceurs de sorts avec ES | coûts doublés, plus d'ES défensive |
| Réflexes de fer | armure | perd l'évasion |
| Coups déviés | évasion/Déviation | évasion Défavorable |
| Serment du Zélote / Jeunesse éternelle / Foi meurtrie | hybrides vie/ES | changent la recharge d'ES |
| Pacte vaal | Drain | plus de récupération hors Drain |
| Posture inflexible | armure lourde | plus de Roulade ni de Sprint |
| Pouls irrégulier (Heartstopper) | défense vs DoT | moins vs DoT récent, plus vs ancien |
| Rempart | bouclier/armure | la Roulade n'évite plus les dégâts |

## 10. Valeurs repères (ordres de grandeur, sources non officielles)

| Palier | Résistances élémentaires | Chaos | Vie / ES | Remarques |
|---|---|---|---|---|
| Campagne Actes 1-2 | ≥ 30 % (froid pour fin Acte 1) | — | vie qui suit le niveau | flacons à jour |
| Campagne Actes 3-4 / Interludes | ≥ 30-50 % malgré la pénalité | — | ~1 000-1 500 | Charmes contre Gel/Étourdissement |
| Cartes T1-T10 (zone 65-74) | **75 %** | début | ~2 000-3 000 PV effectifs | 2 couches (mitigation + réserve) |
| Cartes T11-T15 (75-79) | 75 % (+surcap) | positif → 30 %+ | ~3 000+ | chaos à partir de T11 |
| Endgame / boss ultimes | 75 % (+max res) | 50-75 % ou CI | 4 000-6 000+ (ES 5-6k pour CI) | réponses à toutes les altérations |
Ex. de témoignage : 2 400 vie + 8 000 armure + résistances capées = cartes confortables. Vérifier dans PoB
(« coup maximal encaissable » par type, EHP) plutôt que se fier à un seul chiffre.

## 11. Diagnostiquer « je meurs »

1. **De quoi ?** Gros coup unique (→ réserve, armure, Déviation, blocage, max res) ; enchaînement de petits
   coups (→ évasion, armure, Recoup) ; dégâts élémentaires (→ résistances) ; chaos (→ résistance au chaos /
   ES) ; DoT ou sol (→ régénération, flacons, Charmes, résistances) ; altérations (Gel, Étourdissement,
   Électrocution → Charmes, seuils).
2. **Contrôle des bases** : résistances (pénalité de l'acte comprise), vie/ES par rapport au palier, flacons
   à jour, résistance au chaos.
3. **Couches** : au moins une mitigation + une réserve + une récupération. Ajoute la couche manquante avant
   d'empiler la couche existante (rendement décroissant).
4. **Jouabilité** : la Roulade a des frames d'invulnérabilité (pas contre les zones) ; tuer plus vite est aussi
   une défense (le contrôle — Gel, Verrouillage, Étourdissement — empêche les monstres de frapper).
