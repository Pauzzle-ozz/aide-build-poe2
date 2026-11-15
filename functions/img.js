// Fonction Cloudflare Pages (version en ligne) : /img?u=<icône poe2db>
// Relaie les icônes de gemmes et d'objets de poe2db, mises en cache une semaine,
// comme la route /img du serveur local (src/server/app.mjs).
const WEEK = 604800;

export async function onRequestGet({ request, waitUntil }) {
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
