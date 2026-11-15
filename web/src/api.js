// Accès au serveur local
export async function api(method, url, body) {
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

/** URL d'image poe2db passant par le cache local */
export const img = (url) => (url ? `/img?u=${encodeURIComponent(url)}` : null);
