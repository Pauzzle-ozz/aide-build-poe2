// Prépare le skill expert-build-poe2 à télécharger depuis le site (à importer dans Claude :
// claude.ai/customize/skills). Archive au format attendu par Claude : un dossier expert-build-poe2/
// contenant SKILL.md (avec une note d'édition en ligne) et les fiches references/. Les scripts et les
// évals ne sont pas inclus (ils ont besoin des données du projet).
//   node scripts/skill-zip.mjs <fichier.zip>   (sinon appelé par vite.config.mjs, npm run build:web)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { SKILL_DIR, NOTE_TELECHARGEMENT, avecNote } from '../src/mcp/guide.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NOM = 'expert-build-poe2';

const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Archive ZIP (compression « deflate ») à partir de [{ nom, donnees }] */
function zip(entrees) {
  const date = ((2026 - 1980) << 9) | (11 << 5) | 15; // date fixe : archive identique d'un déploiement à l'autre
  const parties = [];
  const central = [];
  let position = 0;
  for (const { nom, donnees } of entrees) {
    const n = Buffer.from(nom, 'utf8');
    const comp = zlib.deflateRawSync(donnees, { level: 9 });
    const crc = crc32(donnees);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // noms en UTF-8
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(donnees.length, 22);
    local.writeUInt16LE(n.length, 26);
    local.writeUInt16LE(0, 28);
    parties.push(local, n, comp);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(8, 10);
    c.writeUInt16LE(0, 12);
    c.writeUInt16LE(date, 14);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(comp.length, 20);
    c.writeUInt32LE(donnees.length, 24);
    c.writeUInt16LE(n.length, 28);
    c.writeUInt32LE(position, 42);
    central.push(c, n);
    position += 30 + n.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(entrees.length, 8);
  fin.writeUInt16LE(entrees.length, 10);
  fin.writeUInt32LE(cd.length, 12);
  fin.writeUInt32LE(position, 16);
  return Buffer.concat([...parties, cd, fin]);
}

function fichiersDe(dossier, prefixe = '') {
  const out = [];
  for (const e of fs.readdirSync(path.join(dossier, prefixe), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = prefixe ? `${prefixe}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...fichiersDe(dossier, rel));
    else if (e.name.endsWith('.md')) out.push(rel);
  }
  return out;
}

/** Contenu de l'archive du skill */
export function creerZipSkill() {
  const dossier = path.join(ROOT, SKILL_DIR);
  const lire = (rel) => fs.readFileSync(path.join(dossier, rel), 'utf8').replace(/\r\n/g, '\n');
  const entrees = [{ nom: `${NOM}/SKILL.md`, donnees: Buffer.from(avecNote(lire('SKILL.md'), NOTE_TELECHARGEMENT), 'utf8') }];
  for (const rel of fichiersDe(dossier, 'references')) entrees.push({ nom: `${NOM}/${rel}`, donnees: Buffer.from(lire(rel), 'utf8') });
  return zip(entrees);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sortie = process.argv[2] || `${NOM}.zip`;
  fs.writeFileSync(sortie, creerZipSkill());
  console.log(`Skill écrit dans ${sortie}`);
}
