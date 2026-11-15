// Version en ligne : les deux seuls besoins qui passent par un serveur Cloudflare.
// Utilisé par le Worker (cloudflare/worker.mjs) et par les fonctions Pages (functions/).
import { pobSourceUrl } from '../src/core/pob-source.mjs';

const WEEK = 604800;
const json = (obj, status) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

/**
 * /img?u=<icône poe2db> : relaie les icônes de gemmes et d'objets de poe2db, mises en cache une semaine,
 * comme la route /img du serveur local (src/server/app.mjs). Seul cdn.poe2db.tw est accepté.
 */
export async function handleImg(request, waitUntil) {
  let target;
  try {
    target = new URL(new URL(request.url).searchParams.get('u') || '');
  } catch {
    return new Response(null, { status: 400 });
  }
  if (target.protocol !== 'https:' || target.hostname !== 'cdn.poe2db.tw') return new Response(null, { status: 400 });

  const cache = caches.default;
  const key = new Request(request.url, { method: 'GET' });
  const hit = await cache.match(key);
  if (hit) return hit;

  const r = await fetch(target.href, { headers: { 'User-Agent': 'aide-build-poe2/0.1', Referer: 'https://poe2db.tw/' } });
  const type = r.headers.get('Content-Type') || '';
  if (!r.ok || !type.startsWith('image/')) return new Response(null, { status: 404 });
  const res = new Response(r.body, { headers: { 'Content-Type': type, 'Cache-Control': `public, max-age=${WEEK}` } });
  waitUntil(cache.put(key, res.clone()));
  return res;
}

/**
 * /api/pob-url?u=<lien de partage> : récupère le code d'un build partagé sur pobb.in, poe.ninja ou
 * pastebin (le navigateur ne peut pas lire ces sites directement). Seuls ces trois sites sont acceptés.
 */
export async function handlePobUrl(request) {
  let url;
  try {
    url = pobSourceUrl(new URL(request.url).searchParams.get('u') || '');
  } catch (e) {
    return json({ error: e.message }, 400);
  }
  if (!url) return json({ error: 'Lien de partage attendu (pobb.in, poe.ninja ou pastebin).' }, 400);

  const r = await fetch(url, { headers: { 'User-Agent': 'aide-build-poe2/0.1' } });
  if (!r.ok) return json({ error: `Impossible de récupérer ${url} (HTTP ${r.status})` }, 502);
  const text = await r.text();
  if (text.length > 2_000_000) return json({ error: 'Code trop long pour un build Path of Building.' }, 413);
  return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}
