// Chargement des données générées (data/*.json) + index de recherche.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { indexData } from '../core/data-index.mjs';

export { norm, matchScore } from '../core/text.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DATA_DIR = path.join(ROOT, 'data');

function readJson(name, fallback) {
  const f = path.join(DATA_DIR, name);
  if (!fs.existsSync(f)) return fallback;
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

export function loadData() {
  const tree = readJson('tree.json', null);
  if (!tree) throw new Error('Données absentes : lancez "npm run setup" (ou "npm run data").');
  return indexData({
    tree,
    gems: readJson('gems.json', []),
    items: readJson('items.json', { bases: [], uniques: [], classes: {} }),
    translations: readJson('translations.json', {}),
    glossary: readJson('glossary.json', { entries: {}, forms: {} }),
  });
}
