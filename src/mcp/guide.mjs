// Outil MCP « guide_expert » : donne à Claude le contenu du skill expert-build-poe2
// (.claude/skills/expert-build-poe2/), par morceaux, quelle que soit la façon dont Claude est branché
// (Claude Code, application Claude, connecteur du site). Le skill reste la seule source : le serveur
// local lit ses fichiers, le Worker en ligne les embarque au déploiement, et le site propose le skill
// complet en téléchargement (scripts/skill-zip.mjs).
import { z } from 'zod';

export const SKILL_DIR = '.claude/skills/expert-build-poe2';

/** Sujets du guide -> fichier du skill */
export const SUJETS = {
  methode: { fichier: 'SKILL.md', titre: 'Méthode : démarche, règles et pièges (toujours en premier)' },
  ascendance: { fichier: null, titre: "Passifs d'ascendance d'une classe (texte officiel) : préciser « classe »" },
  ascendances: { fichier: 'references/ascendances/INDEX.md', titre: 'Liste des classes et ascendances' },
  degats: { fichier: 'references/theorie-degats.md', titre: 'Calcul des dégâts : augmentation / davantage, Touche critique, conversion, altérations, pénétration' },
  defenses: { fichier: 'references/theorie-defenses.md', titre: 'Couches défensives, formules, valeurs repères par palier' },
  ressources: { fichier: 'references/ressources-mecaniques.md', titre: "Esprit, mana, attributs, charges, Ensembles d'armes, méta-gemmes" },
  progression: { fichier: 'references/progression.md', titre: 'Leveling, ordre des ascendances, passage aux cartes, mid game' },
  'cles-de-voute': { fichier: 'references/cles-de-voute.md', titre: "Les clés de voûte de l'arbre (texte officiel)" },
  'etudes-de-cas': { fichier: 'references/etudes-de-cas.md', titre: 'Builds forts du patch et pourquoi ils sont forts' },
  glossaire: { fichier: 'references/glossaire-fr.md', titre: 'Traduction EN -> FR officiel des termes de mécanique' },
};

/** Fichiers du skill utilisés par le guide (fiches d'ascendance comprises) */
export const FICHIERS = [
  ...Object.values(SUJETS).map((s) => s.fichier).filter(Boolean),
  ...['druid', 'huntress', 'mercenary', 'monk', 'ranger', 'sorceress', 'warrior', 'witch'].map((c) => `references/ascendances/${c}.md`),
];

// Fichier du skill -> sujet du guide (pour la note en tête de la méthode)
const VERS_SUJET = {
  'references/theorie-degats.md': 'degats',
  'references/theorie-defenses.md': 'defenses',
  'references/ressources-mecaniques.md': 'ressources',
  'references/progression.md': 'progression',
  'references/cles-de-voute.md': 'cles-de-voute',
  'references/etudes-de-cas.md': 'etudes-de-cas',
  'references/glossaire-fr.md': 'glossaire',
  'references/ascendances/<classe>.md': 'ascendance (avec « classe »)',
};

/** Note en tête de la méthode quand elle est lue par l'outil guide_expert */
export const NOTE_OUTIL =
  '> Tu lis le skill « expert-build-poe2 » via l\'outil guide_expert. Les fichiers `references/…` cités plus bas se lisent avec ' +
  'guide_expert : ' + Object.entries(VERS_SUJET).map(([f, s]) => `\`${f}\` → sujet « ${s} »`).join(' ; ') + '. ' +
  'Les scripts `scripts/*.mjs` et les fichiers `data/…` ne sont pas disponibles ici : pour le coût des chemins, utilise ' +
  'apercu_chemin, rechercher_passifs et details_passif ; pour le vocabulaire, glossaire et verifier_texte.\n\n';

/** Note en tête de la méthode dans le skill téléchargeable (édition pour Claude, sans les scripts) */
export const NOTE_TELECHARGEMENT =
  '> **Édition téléchargée depuis le site Aide Build PoE2.** Les données et les builds viennent du connecteur ' +
  '« Aide Build PoE2 » (outils rechercher_passifs, details_passif, apercu_chemin, rechercher_gemmes, soutiens_compatibles, ' +
  'lire_build, glossaire, verifier_texte…). Les scripts `scripts/*.mjs` et les fichiers `data/…` cités plus bas ne sont pas ' +
  'inclus : pour le coût des chemins, utilise apercu_chemin et rechercher_passifs ; pour le vocabulaire, glossaire et verifier_texte. ' +
  'Les fiches `references/…` sont incluses.\n\n';

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Retire l'en-tête YAML du SKILL.md et normalise les fins de ligne */
export function sansEntete(texte) {
  return String(texte).replace(/\r\n/g, '\n').replace(/^---\n[\s\S]*?\n---\n+/, '');
}

/** Insère une note juste après l'en-tête YAML du SKILL.md */
export function avecNote(skillMd, note) {
  const t = String(skillMd).replace(/\r\n/g, '\n');
  const m = t.match(/^---\n[\s\S]*?\n---\n+/);
  return m ? m[0] + note + t.slice(m[0].length) : note + t;
}

/** Classe ou ascendance (FR/EN) -> fiche d'ascendance, d'après INDEX.md */
function ficheAscendance(index, classe) {
  const q = norm(classe).replace(/[^a-z]+/g, ' ').trim();
  if (!q) return null;
  for (const ligne of sansEntete(index).split('\n')) {
    const m = ligne.match(/^- (.*)→\s*(ascendances\/[\w-]+\.md)/);
    if (!m) continue;
    const noms = norm(m[1]).split(/[^a-z]+/).filter(Boolean).join(' ');
    if ((' ' + noms + ' ').includes(' ' + q + ' ')) return `references/${m[2]}`;
  }
  return null;
}

/**
 * Enregistre l'outil guide_expert.
 * @param lire (fichier relatif au skill) => texte (synchrone ou non)
 */
export function registerGuide(server, { lire, ok, fail }) {
  server.registerTool('guide_expert', {
    title: 'Guide expert (méthode de build)',
    description:
      "MÉTHODE D'EXPERT pour concevoir, analyser, corriger ou expliquer un build Path of Exile 2 (skill expert-build-poe2). " +
      "À APPELER EN PREMIER, avant de créer, remplir ou analyser un build et avant de répondre à une question sur les passifs, les gemmes, " +
      "les ascendances, les dégâts ou les défenses : sujet « methode » d'abord (démarche et règles, une fois par conversation), puis selon le besoin " +
      Object.entries(SUJETS).filter(([k]) => k !== 'methode').map(([k, s]) => `« ${k} » (${s.titre})`).join(', ') + '.',
    inputSchema: {
      sujet: z.enum(Object.keys(SUJETS)).describe('« methode » en premier'),
      classe: z.string().optional().describe('Pour « ascendance » : classe ou ascendance, FR ou EN (ex : « Moine », « Évocateur », « Witch »)'),
    },
  }, async ({ sujet, classe }) => {
    try {
      let fichier = SUJETS[sujet]?.fichier;
      if (sujet === 'ascendance') {
        if (!classe) throw new Error('Précisez « classe » (ex : « Moine », « Évocateur »).');
        fichier = ficheAscendance(await lire(SUJETS.ascendances.fichier), classe);
        if (!fichier) throw new Error(`Classe ou ascendance inconnue : ${classe}. Liste : guide_expert sujet « ascendances ».`);
      }
      const texte = sansEntete(await lire(fichier));
      return ok(sujet === 'methode' ? NOTE_OUTIL + texte : texte);
    } catch (e) {
      return fail(e);
    }
  });
}
