import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const POB_DIR = path.join(ROOT, 'sources', 'PathOfBuilding-PoE2');
export const POB_DATA = path.join(POB_DIR, 'src', 'Data');
export const DATA_DIR = path.join(ROOT, 'data');
export const CACHE_DIR = path.join(ROOT, 'data', 'cache');
// Version de l'arbre passif utilisée (dossier dans PathOfBuilding-PoE2/src/TreeData)
export const TREE_VERSION = process.env.POE2_TREE_VERSION || '0_5';
