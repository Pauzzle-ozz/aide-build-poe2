// Fonction Cloudflare Pages (version en ligne) : /api/pob-url?u=<lien de partage>
// Récupère le code d'un build partagé sur pobb.in, poe.ninja ou pastebin (le navigateur
// ne peut pas lire ces sites directement). Seuls ces trois sites sont acceptés.
import { pobSourceUrl } from '../../src/core/pob-source.mjs';

const json = (obj, status) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

export async function onRequestGet({ request }) {
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
