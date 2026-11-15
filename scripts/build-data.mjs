// Génère toutes les données du projet dans data/ (arbre, gemmes, objets, traductions).
// Usage : node scripts/build-data.mjs [tree|gems|items|translations ...]
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, POB_DIR } from './lib/paths.mjs';
import { buildTree } from './data/tree.mjs';
import { buildGems } from './data/gems.mjs';
import { buildItems } from './data/items.mjs';
import { buildTranslations } from './data/translations.mjs';
import { francise } from './data/francisation.mjs';
import { buildGlossary } from './data/glossary.mjs';

const only = new Set(process.argv.slice(2));
const want = (k) => only.size === 0 || only.has(k);

function save(name, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const file = path.join(DATA_DIR, name);
  fs.writeFileSync(file, JSON.stringify(data));
  console.log(`  -> data/${name} (${(fs.statSync(file).size / 1024).toFixed(0)} Ko)`);
}

async function main() {
  if (!fs.existsSync(POB_DIR)) {
    console.error('Le dépôt Path of Building PoE2 est absent : lancez "npm run setup".');
    process.exit(1);
  }
  let tree;
  if (want('tree') || want('translations')) {
    console.log('Arbre passif...');
    tree = await buildTree();
    if (want('tree')) save('tree.json', tree);
  }
  if (want('gems')) {
    console.log('Gemmes...');
    save('gems.json', await buildGems());
  }
  if (want('items')) {
    console.log('Objets...');
    save('items.json', await buildItems());
  }
  if (want('translations')) {
    console.log('Traductions des modificateurs...');
    save('translations.json', await buildTranslations(tree));
  }
  if (want('glossary')) {
    console.log('Glossaire des mots-clés...');
    save('glossary.json', await buildGlossary());
  }
  console.log('Francisation finale...');
  francise();
  const meta = { generatedAt: new Date().toISOString() };
  try {
    meta.pobCommit = fs.readFileSync(path.join(POB_DIR, '.git', 'HEAD'), 'utf8').trim();
  } catch {}
  save('meta.json', meta);
  console.log('Terminé.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
