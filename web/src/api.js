// Accès au serveur local, ou, dans la version en ligne (vite build --mode web), à l'API
// qui tourne dans le navigateur avec les builds gardés dans la mémoire du navigateur.
export const WEB = import.meta.env.MODE === 'web';

let backend = null;
const webBackend = () => (backend ??= import('./web/backend.js'));

export async function api(method, url, body) {
  if (WEB) return (await webBackend()).request(method, url, body);
  const r = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Erreur HTTP ${r.status}`);
  return j;
}

export const get = (u) => api('GET', u);
export const post = (u, b) => api('POST', u, b || {});

export function connectWs(onMessage, onStatus) {
  if (WEB) {
    // pas de serveur : les notifications viennent directement du stockage du navigateur
    let off = null;
    let closed = false;
    webBackend()
      .then((b) => b.subscribe(onMessage))
      .then((unsubscribe) => {
        if (closed) unsubscribe();
        else {
          off = unsubscribe;
          onStatus(true);
        }
      })
      .catch(() => onStatus(false));
    return () => {
      closed = true;
      off?.();
    };
  }
  let ws;
  let closed = false;
  let retry = 0;
  const open = () => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws`);
    ws.onopen = () => {
      retry = 0;
      onStatus(true);
    };
    ws.onmessage = (e) => {
      try {
        onMessage(JSON.parse(e.data));
      } catch {}
    };
    ws.onclose = () => {
      onStatus(false);
      if (!closed) setTimeout(open, Math.min(5000, 500 * 2 ** retry++));
    };
  };
  open();
  return () => {
    closed = true;
    ws?.close();
  };
}

/** URL d'image poe2db passant par le cache (serveur local, ou fonction Cloudflare en ligne) */
export const img = (url) => (url ? `/img?u=${encodeURIComponent(url)}` : null);
