# Théorie : calcul et scaling des dégâts (PoE2, patch 0.5)

Sources : code de Path of Building PoE2 (`CalcOffence.lua`, `Data/Misc.lua`, constantes « (PoB) »), guides
maxroll « Damage Scaling », game8, poe2db, notes de patch officielles. PoB est une référence de calcul : quand
un chiffre n'est confirmé que par PoB ou par une seule source, il est marqué.

## Sommaire
1. Ordre de calcul d'une Touche
2. Augmentation vs Davantage : la règle qui décide de presque tout
3. Plats ajoutés, « Rajoute X % sous forme de », conversion
4. Critique
5. Vitesse, précision, niveaux de gemmes
6. Mitigation ennemie : résistances, Pénétration, Exposition, malédictions, débuffs
7. Altérations à dégâts (Embrasement, Poison, Saignement)
8. Altérations à accumulation (Gel, Foudroiement, Étourdissement massif, Verrouillage) et Électrocution / Frigorification
9. Dégâts « mécaniques » (projectiles, répétitions, clones, totems, créatures)
10. Évaluer un nœud ou un soutien : méthode chiffrée

---

## 1. Ordre de calcul d'une Touche (PoB, CalcOffence)

1. **Base** : arme (attaques) ou gemme (sorts), + dégâts plats ajoutés × efficacité, × multiplicateur de base
   de l'aptitude (« Dégâts d'attaque X % »).
2. **Conversion** : celle de l'aptitude d'abord, puis la conversion globale sur ce qui reste. Ordre des types :
   Physique → Foudre → Froid → Feu → Chaos. Au-delà de 100 %, les conversions sont réduites au prorata.
3. **« Rajoute X % des Dégâts sous forme de Y »** (gain as extra) : calculé sur la base (convertie ou non),
   avant les Augmentations et les Davantage.
4. **Modificateurs** : pour chaque type *final*, (1 + Σ Augmentations − Σ Réductions) × Π (1 + Davantage)
   × Π (1 − Perte).
5. **Multiplicateurs de Touche** : Touche critique (moyenne = 1 − c + c × (1 + bonus)), chance de dégâts doubles.
6. **Mitigation de l'ennemi** : armure (physique), résistances − Pénétration − Exposition, puis
   « dégâts subis » (Électrocution, Flétrissure…).
7. **dégâts par seconde** = dégât moyen × vitesse × chance de toucher (+ répétitions, projectiles qui touchent, etc.).

## 2. Augmentation vs Davantage

- **Augmentation / Réduction (increased / reduced)** : toutes celles qui s'appliquent vont dans **un seul pot**
  additif. Avec déjà +300 %, un notable « +30 % » ne donne que 430/400 = **+7,5 % réel**.
  Exemple maxroll : +20 % Feu et +20 % Élémentaire donnent ×1,4 ; la 2ᵉ ne vaut que +16,7 %.
- **Davantage / Perte (more / less)** : chaque source multiplie séparément. Deux × 20 % Davantage = ×1,44.
  Sources principales : gemmes de soutien (souvent +20 à +40 %), ascendance, certaines clés de voûte,
  « Davantage » conditionnels (Momentum +40 %, Rageforged…). D'où la grande valeur de chaque emplacement de
  soutien supplémentaire.
- **Réductions vs Pertes** côté défense, même logique : 3 × 20 % de Réduction = −60 % ; 3 × 20 % de Perte =
  −48,8 %.
- Conséquence : diversifier les axes. Quand le pot d'Augmentation est gros, un point vaut mieux en vitesse,
  Touche critique, Pénétration, défense, ou dans un notable qui ouvre un nouvel axe.

Soutiens « Davantage » courants (PoB, à revérifier avec `details_gemme`) : Brutalité I/II (+25/+30 %
physique, pas d'autre type), Destruction maîtrisée (+25 % sorts), Focalisation élémentaire (+25 % élémentaire),
Exécution II (+50 % contre ennemis à faible Vie), Momentum (+40 %), Incantation réfléchie (Considered Casting,
+35 % sorts, −15 % vitesse d'incantation). Contreparties fréquentes : Ricochet (Chain) −30/−50 %, Tir multiple
(Multishot) −35/−25 %, Poison mortel −25 % de dégâts de Touche. Coût en mana typique : ×1,2 par soutien.

## 3. Plats ajoutés, « Rajoute », conversion

- **Plats ajoutés** : s'ajoutent à la base, avant tout multiplicateur. Énormes en début de jeu (base faible),
  relativement moins forts ensuite. Les plats et l'« Augmentation des Dégâts physiques » **locaux** d'une arme
  ne touchent que les attaques faites avec cette arme ; ils ne touchent pas les sorts.
- **Rajoute X % sous forme de Y** : ajoute une couche de dégâts sans rien retirer ; plusieurs « Rajoute »
  s'additionnent entre eux, puis l'ensemble est multiplié par tout le reste. La partie ajoutée n'est affectée que
  par les modificateurs du **nouveau** type (et des catégories générales qui la couvrent : Élémentaire, Sort…).
- **Conversion** : **pas d'héritage en PoE2** — les dégâts convertis ne profitent que des modificateurs de leur
  type **final**. Du physique converti en feu ne profite plus des « Augmentation des Dégâts physiques ».
  (Différence majeure avec PoE1.) Donc : concentre l'arbre sur le type final.
- Une conversion à 100 % vers un élément permet d'utiliser toutes les mécaniques de cet élément (Gel avec le
  froid, Électrocution avec la foudre, Embrasement avec le feu) et de concentrer soutiens et passifs.
- **Pacte de la flamme noire (Blackflame Covenant)** et **Avatar du feu** sont des conversions : lire leur texte
  exact dans `cles-de-voute.md` (ex. le feu converti en chaos par le Pacte contribue quand même à
  l'Inflammabilité et à l'Embrasement, qui inflige alors du chaos — texte du jeu).

## 4. Critique

- Chance = (base de l'arme pour les attaques, de la gemme pour les sorts — ex. Étincelle 11 %, mains nues 5 %
  — + chance plate) × (1 + Augmentations) × Davantage, plafonnée à 100 %.
- **Bonus de Dégâts critiques de base : +100 %** (une Touche critique fait ×2). Les « +X % de Bonus » plats s'ajoutent à
  cette base, puis les Augmentations du Bonus le multiplient (ex. 50 % d'Augmentation → +150 %, soit ×2,5).
- Valeur moyenne d'un investissement Touche critique : multiplicateur = 1 + c × bonus. Chance et Bonus se multiplient
  entre eux → **les équilibrer**. Investir dans le Bonus sans chance (ou l'inverse) est une erreur classique.
- La Touche critique est peu fiable sans investissement massif (game8) ; le passage aux Touches critiques se fait généralement avec une
  bonne arme / une bonne base, vers le milieu ou la fin de l'endgame. Maxroll conseille ~60-70 % de chance
  avant de compter sur Déclenchement lors de Critiques.
- **Critiques inévitables** (Oracle, Résultat forcé) : 100 % de crits, mais le Bonus est réduit si le tirage
  normal aurait échoué (modélisation PoB : 100/70/40/10 % du Bonus selon le nombre d'échecs) → il faut quand
  même 30-40 % de chance naturelle.
- **Technique résolue (Resolute Technique)** : jamais de Touche critique, précision doublée → builds sans Touches critiques.
- Les altérations sont calculées sur la valeur de la Touche, Touche critique comprise : la Touche critique nourrit aussi les DoT.
- Les monstres ont un Bonus de Dégâts critiques de +30 % (côté défense).

## 5. Vitesse, précision, niveaux de gemmes

- Vitesse d'attaque / d'incantation : multiplie le dégâts par seconde mais aussi le coût en mana par seconde.
- **Précision** (attaques seulement) : chance de toucher ≈ 1,25 × Préc / (Préc + 0,3 × Évasion ennemie)
  (PoB), et elle **baisse avec la distance** (jusqu'à −90 % à portée maximale, PoB). Les sorts ne ratent pas.
  Viser ~100 % de chance de toucher pour un build d'attaque.
- **Niveaux de gemmes** : pour un sort ou une créature, +1 niveau ≈ **+10 à +12 % de dégâts de base** autour
  du niveau 20 (ex. Étincelle 11–216 au niv. 20 → 13–242 au niv. 21 → 20–378 au niv. 25). Les « +X au niveau
  des gemmes de Sort / de Créatures » sont donc un multiplicateur majeur. Les gemmes d'attaque, elles, montent
  surtout leur multiplicateur de l'arme.
- Mais : +niveaux = + coût en mana. Certaines gemmes se gardent volontairement bas niveau (gemmes de setup, de
  déclenchement, de mouvement).

## 6. Mitigation ennemie

- **Résistances ennemies** : les monstres ont des résistances, les boss davantage (configurations PoB courantes
  : boss « standard » 30 % élémentaire, boss ultimes 50 %).
- **Pénétration** : réduit la résistance pour *ce coup* ; **ne descend jamais sous 0 %** ; **ne s'applique pas
  aux altérations / DoT**.
- **Exposition (Exposure)** : −20 % de résistance par défaut ; seule la plus forte de chaque type s'applique
  (non cumulable) ; scalée par « Effet de l'Exposition ». Les DoT en profitent.
- **Malédictions** : une par ennemi par défaut (Murmures du Malheur : +1, mais délai doublé) ; Sensibilité aux
  éléments (Elemental Weakness) ≈ −46 % élémentaire selon game8. Blasphème (Blasphemy) en fait une aura payée en
  Esprit (effet réduit). Les **Marques** sont en plus de la limite de malédictions (1 marque par ennemi).
- **Flux de Rakiata (Rakiata's Flow, soutien de lignage)** : inverse la résistance du monstre (+40 % → −40 %,
  soit +133 % de dégâts dans l'exemple maxroll). Avec lui, ne réduis pas la résistance (Exposition,
  malédictions, Bombe de givre), et évite Flamme sacrée — ça réduit le gain. Vérifier le texte actuel.
- **Bris d'Armure (Armour Break)** : réduit l'armure ennemie, pas sous 0 (sauf Impacts de l'implosion du
  Héraut de la guerre) ; à 0, Armure entièrement brisée pendant 12 s (permet Brisure / Hébétement).
  L'armure des monstres réduit au maximum 75 % des dégâts physiques (PoB).
- **Débuffs « dégâts subis augmentés »** : ils **s'additionnent entre eux** (rendement décroissant).
  Électrocution (Shock) : +20 % de dégâts subis de base (PoB `BaseShockMagnitude`), scalée par l'Amplitude ;
  Flétrissure : 5 % de dégâts de chaos subis par cumul, 10 cumuls ; Intimidation : 10 %.
- **Coup de grâce (Culling Strike)** : tue sous 35 % de Vie (normal, 0.5), 20 % magique, 10 % rare,
  5 % unique (PoB).

## 7. Altérations à dégâts

Constantes PoB (`Data/Misc.lua`) :

| Altération | Dégâts par seconde | Durée de base | Source |
|---|---|---|---|
| Embrasement (Ignite) | 20 % des dégâts de **feu** de la Touche | 4 s | feu, chance via Inflammabilité |
| Poison | 20 % des dégâts **physiques + chaos** de la Touche | 2 s | source explicite de chance requise |
| Saignement (Bleeding) | 15 % des dégâts **physiques** de la Touche | 5 s | source explicite ; ×2 si la cible bouge ou si Aggravé |

- **Amplitude** = calculée sur la **Touche finale avant mitigation** (Augmentations et Davantage de la Touche
  déjà inclus) ; ensuite seuls s'appliquent les modificateurs d'« Amplitude de X / des Altérations à dégâts »,
  de « dégâts plus rapides » et de durée. Les Augmentations de dégâts ne comptent pas deux fois.
- **Ce qui s'applique au DoT** : résistance de la cible, Exposition, malédictions, débuffs de dégâts subis
  (Électrocution). **Ce qui ne s'applique pas** : Pénétration.
- **Cumul : une seule instance par défaut** pour Embrasement, Poison et Saignement (PoB `StacksMax = 1`) — la
  plus forte compte. Les modificateurs « les cibles peuvent être affectées par +N de vos Poisons »,
  Toxicité accablante (Exploratrice, ×2 poisons pour −50 % de durée), « vous pouvez infliger un Embrasement
  supplémentaire » relèvent la limite. Viser beaucoup de poisons sans ces modificateurs = erreur.
- **Chance d'Embraser** : 1 % par tranche de 5 % du Seuil d'Altération de la cible infligée en feu
  (multiplicateur 20, PoB) ; **Électrocution** : 1 % par tranche de 4 % (multiplicateur 25). Les gros coups
  infligent donc les altérations plus facilement ; les monstres uniques ont des seuils très élevés.
- Soutiens typiques : Flamme calcinante I/II (Searing Flame, Davantage d'Amplitude d'Embrasement contre moins de
  dégâts de Touche), Embrasement I/II/III, Flamme éternelle II (durée), Poison I/II/III, Poison mortel I/II,
  Saignement I/II/III, Rupture (Aggravé sur Étourdissement massif). Vérifier les valeurs actuelles.
- Clés de voûte : Assaut écarlate (Saignement Aggravé, 1 s, 50 % Davantage d'Amplitude), Pacte de la flamme
  noire (feu → chaos pour les sorts de feu), Murmures du Malheur (malédictions).

## 8. Altérations à accumulation et altérations de statut

Accumulation (PoB) : % de jauge par coup ≈ dégâts × échelle / seuil du monstre × modificateurs.

| État | Échelle (PoB) | Dégâts qui comptent | Effet |
|---|---|---|---|
| Gel (Freeze) | 2,1 | froid | immobilise ~4 s |
| Foudroiement (Electrocute) | 1,7 | foudre, **seulement avec une source explicite** (soutien, passif) | immobilise |
| Étourdissement massif (Heavy Stun) | 0,58 | physique +50 % Davantage, mêlée +50 % Davantage ; Hébété +50 % | immobilise ~3 s |
| Verrouillage (Pin) | 4,2 | (selon les modificateurs de Verrouillage) | immobilise, sans temps de recharge interne |

- Les monstres uniques ont un seuil ×6 ; une cible Étourdie / Gelée compte comme Immobilisée (débloque des
  bonus « contre les ennemis Immobilisés »).
- **« Préparé » (Primed)** : au-delà d'un certain % d'accumulation, la prochaine Touche lourde applique l'état
  (ex. coups écrasants de Brise-os ou du Titan) — seuils exacts non confirmés.
- **Électrocution (Shock)** : +20 % de dégâts subis (8 s sur les monstres, PoB). **Frigorification
  (Chill)** : ralentissement jusqu'à 50 %. Polcirkeln : un ennemi Frigorifié peut être Brisé comme s'il était
  Gelé (archétypes froid du méta).
- Le contrôle est aussi une défense : un monstre Gelé, Foudroyé, Verrouillé ou Étourdi ne frappe pas.

## 9. Dégâts « mécaniques »

- **Projectiles qui touchent la même cible** (« shotgun ») : multiplicateur direct si l'aptitude le permet.
- **Répétitions, échos, clones** (De temps à autre, Forme vide, Images…) : chaque répétition rejoue tout le
  multiplicateur du personnage.
- **Totems** : ne sont **pas** des créatures ; ils utilisent vos dégâts de sort et votre vitesse d'incantation.
  Nombre de totems × cadence × niveau de gemme.
- **Créatures et compagnons** : **ne profitent pas** de vos modificateurs de dégâts, seulement des
  modificateurs « Les Créatures… / des Créatures » et des +niveaux de gemmes de Créatures ; Talisman
  nécromantique transfère les bonus de l'amulette aux créatures.
- **Déclencheurs / méta-gemmes** : les dégâts du sort déclenché suivent ses propres stats ; la fréquence dépend
  de l'Énergie gagnée (voir `ressources-mecaniques.md`).
- **Effet composé** (maxroll) : en supposant ~3 % Davantage par point, retirer les 24 derniers points divise le
  dégâts par seconde par ~2. Les petites améliorations se composent : ne les néglige pas en fin de build.

## 10. Évaluer un nœud ou un soutien (méthode)

1. Vérifie que la stat s'applique (tags, Touche vs DoT, type final après conversion, joueur vs créatures).
2. Additionne le pot existant du même type (via `lire_build` « stats cumulées » ou
   `planifier_arbre.mjs --stats`).
3. Gain réel d'une Augmentation de X % : (100 + total + X) / (100 + total) ; d'un Davantage : (1 + X).
4. Pondère par la disponibilité (permanent / conditionnel / boss seulement).
5. Divise par le coût (points de chemin compris, ou emplacement de soutien et mana).
6. Compare avec la meilleure alternative sur un autre axe (vitesse, Touche critique, Pénétration, niveau de gemme,
   défense). Exprime le résultat en multiplicateur (« ~×1,12 ») et propose la vérification PoB.
