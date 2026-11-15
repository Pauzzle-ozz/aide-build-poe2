// Import / export au format Path of Building PoE2 (codes de partage, liens pobb.in / poe.ninja).
// Compression et téléchargement côté Node ; la conversion XML <-> build est dans src/core/pob.mjs.
import zlib from 'node:zlib';
import { pobSourceUrl } from '../core/pob.mjs';

export { pobSourceUrl, pobXmlToBuild, buildToPobXml, itemFromText } from '../core/pob.mjs';

export function decodePobCode(code) {
  const clean = String(code).trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const buf = Buffer.from(clean, 'base64');
  try {
    return zlib.inflateSync(buf).toString('utf8');
  } catch {
    return zlib.inflateRawSync(buf).toString('utf8');
  }
}

export function encodePobCode(xml) {
  return zlib.deflateSync(Buffer.from(xml, 'utf8'), { level: 9 }).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
}

/** Récupère un code PoB depuis un lien de partage (pobb.in, poe.ninja, pastebin) */
export async function resolvePobInput(input) {
  const url = pobSourceUrl(input);
  if (!url) return String(input).trim();
  const res = await fetch(url, { headers: { 'User-Agent': 'aide-build-poe2/0.1' } });
  if (!res.ok) throw new Error(`Impossible de récupérer ${url} (HTTP ${res.status})`);
  return (await res.text()).trim();
}

/** Codec utilisé par les routes partagées (src/core/build-routes.mjs) */
export const nodePob = { decode: decodePobCode, encode: encodePobCode, resolveInput: resolvePobInput };
