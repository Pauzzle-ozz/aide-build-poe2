// Stockage des builds sur disque (builds/*.json). La logique (brouillons, bac à sable,
// build actif) est partagée avec la version en ligne : voir src/core/build-store.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './data.mjs';
import { BuildStore as CoreBuildStore } from '../core/build-store.mjs';

export { SANDBOX_ID } from '../core/build-store.mjs';
export const BUILDS_DIR = path.join(ROOT, 'builds');

/** Un fichier builds/<nom>.json par objet */
function fileDisk(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = (name) => path.join(dir, `${name}.json`);
  return {
    read: (name) => (fs.existsSync(file(name)) ? JSON.parse(fs.readFileSync(file(name), 'utf8')) : null),
    write: (name, obj) => fs.writeFileSync(file(name), JSON.stringify(obj, null, 2)),
    remove: (name) => fs.rmSync(file(name), { force: true }),
    has: (name) => fs.existsSync(file(name)),
    names: () => fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)),
  };
}

export class BuildStore extends CoreBuildStore {
  constructor(data) {
    super(data, fileDisk(BUILDS_DIR));
  }
}
