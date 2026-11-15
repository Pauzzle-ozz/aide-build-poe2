// Bac à sable : espace libre qui ne modifie jamais un build enregistré.
import { get, post } from './api.js';

export const SANDBOX_ID = 'bac-a-sable';
export const isSandbox = (build) => build?.id === SANDBOX_ID;

/** Ouvre le bac à sable (tel qu'on l'a laissé), vide, ou rempli avec une copie d'un build */
export async function openSandbox({ fromBuild, reset, cls } = {}) {
  return post('/api/sandbox/open', { fromBuild, reset, class: cls });
}

export async function resetSandbox(cls) {
  return post('/api/sandbox/reset', { class: cls });
}

/** Enregistre le bac à sable comme nouveau build et l'ouvre */
export async function saveSandbox(name) {
  return post('/api/sandbox/save', { name });
}

/** Retour au dernier build ouvert */
export async function leaveSandbox() {
  const r = await post('/api/sandbox/leave', {});
  return get(`/api/builds/${r.activeBuildId}`);
}
