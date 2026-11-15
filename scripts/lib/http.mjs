// Téléchargements avec cache disque (data/cache/http) et limitation de débit,
// pour ne pas solliciter inutilement poe2db / pathofexile.com.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { CACHE_DIR } from './paths.mjs';

const HTTP_CACHE = path.join(CACHE_DIR, 'http');
fs.mkdirSync(HTTP_CACHE, { recursive: true });

const UA = 'aide-build-poe2/0.1 (outil local personnel)';
const MIN_DELAY_MS = Number(process.env.POE2_FETCH_DELAY || 150);
let last = 0;
let queue = Promise.resolve();

function cachePath(url) {
  const h = crypto.createHash('sha1').update(url).digest('hex');
  return path.join(HTTP_CACHE, h);
}

export async function fetchText(url, { refresh = false, referer } = {}) {
  const file = cachePath(url);
  if (!refresh && fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  // file d'attente : une requête à la fois, avec un délai minimal
  const run = async () => {
    const wait = Math.max(0, last + MIN_DELAY_MS - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    let lastErr;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await fetch(url, { headers: { 'User-Agent': UA, ...(referer ? { Referer: referer } : {}) } });
        last = Date.now();
        if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
        if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} pour ${url}`), { fatal: true });
        const text = await res.text();
        fs.writeFileSync(file, text);
        fs.writeFileSync(`${file}.url`, url); // pour retrouver la langue d'une page en cache (glossaire)
        return text;
      } catch (e) {
        lastErr = e;
        if (e.fatal) break;
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1) ** 2));
      }
    }
    throw lastErr;
  };
  const p = queue.then(run, run);
  queue = p.catch(() => {});
  return p;
}

export async function fetchJson(url, opts) {
  return JSON.parse(await fetchText(url, opts));
}
