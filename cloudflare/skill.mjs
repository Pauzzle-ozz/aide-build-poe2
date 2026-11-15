// Fichiers du skill expert-build-poe2 embarqués dans le Worker au déploiement (règle « Text » pour
// les .md dans wrangler.jsonc), lus par l'outil guide_expert. Doit couvrir FICHIERS de src/mcp/guide.mjs.
import methode from '../.claude/skills/expert-build-poe2/SKILL.md';
import index from '../.claude/skills/expert-build-poe2/references/ascendances/INDEX.md';
import druid from '../.claude/skills/expert-build-poe2/references/ascendances/druid.md';
import huntress from '../.claude/skills/expert-build-poe2/references/ascendances/huntress.md';
import mercenary from '../.claude/skills/expert-build-poe2/references/ascendances/mercenary.md';
import monk from '../.claude/skills/expert-build-poe2/references/ascendances/monk.md';
import ranger from '../.claude/skills/expert-build-poe2/references/ascendances/ranger.md';
import sorceress from '../.claude/skills/expert-build-poe2/references/ascendances/sorceress.md';
import warrior from '../.claude/skills/expert-build-poe2/references/ascendances/warrior.md';
import witch from '../.claude/skills/expert-build-poe2/references/ascendances/witch.md';
import degats from '../.claude/skills/expert-build-poe2/references/theorie-degats.md';
import defenses from '../.claude/skills/expert-build-poe2/references/theorie-defenses.md';
import ressources from '../.claude/skills/expert-build-poe2/references/ressources-mecaniques.md';
import progression from '../.claude/skills/expert-build-poe2/references/progression.md';
import clesDeVoute from '../.claude/skills/expert-build-poe2/references/cles-de-voute.md';
import etudesDeCas from '../.claude/skills/expert-build-poe2/references/etudes-de-cas.md';
import glossaire from '../.claude/skills/expert-build-poe2/references/glossaire-fr.md';

const FICHIERS_SKILL = {
  'SKILL.md': methode,
  'references/ascendances/INDEX.md': index,
  'references/ascendances/druid.md': druid,
  'references/ascendances/huntress.md': huntress,
  'references/ascendances/mercenary.md': mercenary,
  'references/ascendances/monk.md': monk,
  'references/ascendances/ranger.md': ranger,
  'references/ascendances/sorceress.md': sorceress,
  'references/ascendances/warrior.md': warrior,
  'references/ascendances/witch.md': witch,
  'references/theorie-degats.md': degats,
  'references/theorie-defenses.md': defenses,
  'references/ressources-mecaniques.md': ressources,
  'references/progression.md': progression,
  'references/cles-de-voute.md': clesDeVoute,
  'references/etudes-de-cas.md': etudesDeCas,
  'references/glossaire-fr.md': glossaire,
};

export function lireGuide(fichier) {
  const texte = FICHIERS_SKILL[fichier];
  if (texte == null) throw new Error(`Fichier du skill absent du Worker : ${fichier} (à ajouter dans cloudflare/skill.mjs)`);
  return texte;
}
