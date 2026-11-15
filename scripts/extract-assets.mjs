// Extrait les images du jeu (fournies par Path of Building PoE2) vers web/public/assets :
//  - atlas d'icônes de l'arbre passif, cadres, fonds de groupes
//  - fonds de classes / ascendances
//  - icônes de gemmes
//  - éléments d'interface (en-têtes d'infobulles, emplacements d'équipement)
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { readDds, decodeLayer } from './lib/dds.mjs';
import { evalLuaFile } from './lib/lua.mjs';
import { POB_DIR, TREE_VERSION, ROOT } from './lib/paths.mjs';

const TREE_DIR = path.join(POB_DIR, 'src', 'TreeData', TREE_VERSION);
const OUT = path.join(ROOT, 'web', 'public', 'assets');
fs.mkdirSync(path.join(OUT, 'tree'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'asc'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'ui'), { recursive: true });

const sprites = { atlases: [], items: {} };

// Les coordonnées sont soit un index de couche (1-based), soit [x, y, xMax, yMax, couche]
function norm(v) {
  if (Array.isArray(v)) return { layer: v[4], x: v[0], y: v[1], w: v[2] - v[0] + 1, h: v[3] - v[1] + 1 };
  return { layer: v, x: 0, y: 0, w: null, h: null };
}

/** Construit un atlas à partir des couches d'un fichier DDS. */
async function buildAtlas(file, rawNames, prefix, outName, { maxLayers = Infinity } = {}) {
  const dds = readDds(file);
  const names = Object.fromEntries(Object.entries(rawNames).map(([k, v]) => [k, norm(v)]));
  const entries = Object.entries(names)
    .filter(([, c]) => c.layer >= 1 && c.layer <= dds.arraySize)
    .slice(0, maxLayers)
    .map(([k, c]) => [k, c.layer, c]);
  if (!entries.length) return;
  // une couche peut être partagée par plusieurs noms
  const layers = [...new Set(entries.map(([, i]) => i))].sort((a, b) => a - b);
  const cols = Math.ceil(Math.sqrt(layers.length));
  const rows = Math.ceil(layers.length / cols);
  const W = cols * dds.width;
  const H = rows * dds.height;
  const composites = [];
  const pos = {};
  layers.forEach((layer, n) => {
    const px = decodeLayer(dds, layer - 1);
    const x = (n % cols) * dds.width;
    const y = Math.floor(n / cols) * dds.height;
    pos[layer] = { x, y };
    composites.push({ input: px, raw: { width: dds.width, height: dds.height, channels: 4 }, left: x, top: y });
  });
  const atlasIndex = sprites.atlases.length;
  const rel = `tree/${outName}.webp`;
  let atlas = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(composites)
    .png()
    .toBuffer();
  if (prefix === 'skills' || prefix === 'gem') {
    // icônes rondes, comme dans le jeu
    const r = dds.width / 2;
    const circles = layers.map((layer) => `<circle cx="${pos[layer].x + r}" cy="${pos[layer].y + r}" r="${r - 0.5}" fill="#fff"/>`).join('');
    const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${circles}</svg>`);
    if (prefix === 'skills') atlas = await sharp(atlas).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  }
  await sharp(atlas).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(OUT, rel));
  sprites.atlases.push(rel);
  // Version assombrie/désaturée (nœuds non alloués), comme dans le jeu
  let dimIndex = null;
  if (prefix === 'skills') {
    dimIndex = sprites.atlases.length;
    const relDim = `tree/${outName}-dim.webp`;
    await sharp(path.join(OUT, rel)).modulate({ saturation: 0.25, brightness: 0.5 }).webp({ quality: 88, alphaQuality: 100 }).toFile(path.join(OUT, relDim));
    sprites.atlases.push(relDim);
  }
  for (const [name, layer, c] of entries) {
    const w = Math.min(c.w ?? dds.width, dds.width - c.x);
    const h = Math.min(c.h ?? dds.height, dds.height - c.y);
    sprites.items[`${prefix}:${name}`] = [atlasIndex, pos[layer].x + c.x, pos[layer].y + c.y, w, h];
    if (dimIndex !== null) sprites.items[`skills-dim:${name}`] = [dimIndex, pos[layer].x + c.x, pos[layer].y + c.y, w, h];
  }
  console.log(`  atlas ${rel} (${layers.length} images, ${W}x${H})`);
}

async function main() {
  console.log(`Extraction des images (arbre ${TREE_VERSION})...`);
  const tree = JSON.parse(fs.readFileSync(path.join(TREE_DIR, 'tree.json'), 'utf8'));

  for (const [file, names] of Object.entries(tree.ddsCoords)) {
    const base = file.replace('.dds.zst', '');
    const m = base.match(/^([a-z-]+)_(\d+)_(\d+)_/);
    const kind = m ? m[1] : base;
    const full = path.join(TREE_DIR, file);
    // (les fichiers skills-disabled sont identiques à skills : on génère notre propre version assombrie)
    if (['skills', 'group-background', 'jewel-sockets'].includes(kind)) {
      await buildAtlas(full, names, kind, base.replace(/_(BC1|BC7|RGBA)$/, ''));
    } else if (kind === 'ascendancy-background') {
      const dds = readDds(full);
      for (const [name, raw] of Object.entries(names)) {
        const c = norm(raw);
        const px = decodeLayer(dds, c.layer - 1);
        const size = dds.width > 2000 ? 2048 : 1024;
        const slug = name.replace(/^Classes/, '').replace(/[^A-Za-z0-9]+/g, '_');
        const rel = `asc/${slug}.webp`;
        let img = sharp(px, { raw: { width: dds.width, height: dds.height, channels: 4 } });
        if (c.w) img = sharp(await img.extract({ left: c.x, top: c.y, width: Math.min(c.w, dds.width), height: Math.min(c.h, dds.height) }).png().toBuffer());
        await img
          .resize(size, size)
          .webp({ quality: 82, alphaQuality: 90 })
          .toFile(path.join(OUT, rel));
        sprites.items[`asc:${name}`] = rel;
      }
      console.log(`  ${Object.keys(names).length} fonds de classes/ascendances`);
    }
  }

  // Icônes de gemmes
  const skillAssets = evalLuaFile(path.join(POB_DIR, 'src', 'Data', 'Skills', 'SkillAssets.lua'));
  for (const [file, names] of Object.entries(skillAssets.ddsCoords)) {
    if (!file.startsWith('gem-icons_64_64')) continue;
    await buildAtlas(path.join(POB_DIR, 'src', 'Data', 'Skills', file), names, 'gem', 'gem-icons_64');
  }

  // Éléments d'interface PNG
  const uiDir = path.join(POB_DIR, 'src', 'Assets');
  let n = 0;
  for (const f of fs.readdirSync(uiDir)) {
    if (f.endsWith('.png')) {
      fs.copyFileSync(path.join(uiDir, f), path.join(OUT, 'ui', f));
      n++;
    }
  }
  console.log(`  ${n} éléments d'interface copiés`);

  fs.writeFileSync(path.join(OUT, 'sprites.json'), JSON.stringify(sprites));
  console.log(`OK : ${Object.keys(sprites.items).length} sprites -> web/public/assets/sprites.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
