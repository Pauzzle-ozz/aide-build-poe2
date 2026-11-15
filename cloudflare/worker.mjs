// Worker Cloudflare de la version en ligne (configuration : wrangler.jsonc).
// Cloudflare sert d'abord les fichiers de web/dist-web (interface, données du jeu, images) ;
// ce code ne reçoit que les adresses qui ne correspondent à aucun fichier :
//   /img                icônes poe2db (cache)
//   /api/pob-url        liens de partage Path of Building
//   /mcp/<jeton>        serveur MCP pour Claude (connecteur personnalisé, lien personnel du visiteur)
//   /relais/<jeton>     WebSocket ouvert par l'onglet du site : relaie les demandes de Claude vers
//                       le navigateur, où sont enregistrés les builds (web/src/web/claude.js)
import { DurableObject } from 'cloudflare:workers';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createMcpServer } from '../src/mcp/tools.mjs';
import { handleImg, handlePobUrl } from './handlers.mjs';

const JETON = '([a-f0-9]{32})';
const RELAIS = new RegExp(`^/relais/${JETON}$`);
const MCP = new RegExp(`^/mcp/${JETON}/?$`);
const OUVERT = 1; // WebSocket.OPEN
const DELAI = 25000;

const PAS_D_ONGLET =
  "Le site Aide Build PoE2 n'est pas ouvert chez l'utilisateur, ou la connexion à Claude n'y est pas active. " +
  "Demande-lui d'ouvrir le site dans son navigateur et de vérifier, avec le bouton « ✦ Claude » en haut à droite, que la connexion est « prête », puis réessaie.";

/** Un relais par lien personnel : garde le WebSocket de l'onglet du site et lui transmet les demandes de Claude */
export class SessionClaude extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.attente = new Map();
    this.compteur = 0;
    // les « ping » de l'onglet reçoivent « pong » sans réveiller le relais
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  /** Ouverture du WebSocket par l'onglet (un seul onglet relié à la fois : le plus récent) */
  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket attendu', { status: 426 });
    for (const ancien of this.ctx.getWebSockets()) {
      try {
        ancien.close(4000, 'Claude est relié à un autre onglet');
      } catch {}
    }
    const [client, serveur] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(serveur);
    return new Response(null, { status: 101, webSocket: client });
  }

  /** Appel de l'API de l'outil, exécuté dans l'onglet (appelé par le serveur MCP) */
  async appeler(method, url, body) {
    const ws = this.ctx.getWebSockets().filter((w) => w.readyState === OUVERT).at(-1);
    if (!ws) throw new Error(PAS_D_ONGLET);
    const id = ++this.compteur;
    const reponse = new Promise((resolve, reject) => {
      const minuterie = setTimeout(() => {
        this.attente.delete(id);
        reject(new Error("Le site ne répond pas (onglet en veille ?). Demande à l'utilisateur d'afficher l'onglet du site, puis réessaie."));
      }, DELAI);
      this.attente.set(id, { resolve, reject, minuterie });
    });
    ws.send(JSON.stringify({ id, method, url, body: body ?? null }));
    return reponse;
  }

  webSocketMessage(ws, message) {
    if (typeof message !== 'string') return;
    let m;
    try {
      m = JSON.parse(message);
    } catch {
      return;
    }
    const a = this.attente.get(m?.id);
    if (!a) return;
    this.attente.delete(m.id);
    clearTimeout(a.minuterie);
    if (m.ok) a.resolve(m.result);
    else a.reject(new Error(m.error || 'Erreur dans le site.'));
  }

  webSocketClose(ws, code, reason) {
    try {
      ws.close(code, reason);
    } catch {}
    if (this.ctx.getWebSockets().some((w) => w !== ws && w.readyState === OUVERT)) return;
    for (const [id, a] of this.attente) {
      clearTimeout(a.minuterie);
      a.reject(new Error(PAS_D_ONGLET));
      this.attente.delete(id);
    }
  }
}

/** Serveur MCP sans session : chaque requête de Claude est traitée seule, les outils passent par le relais */
async function serveurMcp(request, env, jeton, origine) {
  // pas de flux d'évènements (GET) ni de session à fermer (DELETE) : autorisé par le protocole
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
  const relais = env.SESSIONS.get(env.SESSIONS.idFromName(jeton));
  const server = createMcpServer({ api: (method, url, body) => relais.appeler(method, url, body), interfaceUrl: origine, enLigne: true });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;
    if (request.method === 'GET' && pathname === '/img') return handleImg(request, (p) => ctx.waitUntil(p));
    if (request.method === 'GET' && pathname === '/api/pob-url') return handlePobUrl(request);
    let m;
    if ((m = pathname.match(RELAIS))) {
      // seul le site lui-même peut ouvrir le relais
      if (request.headers.get('Origin') !== url.origin) return new Response('Origine refusée', { status: 403 });
      return env.SESSIONS.get(env.SESSIONS.idFromName(m[1])).fetch(request);
    }
    if ((m = pathname.match(MCP))) return serveurMcp(request, env, m[1], url.origin);
    return env.ASSETS.fetch(request);
  },
};
