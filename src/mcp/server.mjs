// Serveur MCP local (stdio) : permet à Claude de lire et modifier les builds, chercher dans les données
// du jeu (en français) et piloter l'interface graphique ouverte dans le navigateur.
//
// Il communique avec le serveur local (http://localhost:4747), qu'il démarre si besoin.
// Les outils eux-mêmes sont dans src/mcp/tools.mjs (partagés avec la version en ligne).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './tools.mjs';
import { SKILL_DIR } from './guide.mjs';

// stdout est réservé au protocole MCP
console.log = (...a) => console.error(...a);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = Number(process.env.POE2_PORT || 4747);
const BASE = `http://127.0.0.1:${PORT}`;
const URL_INTERFACE = `http://localhost:${PORT}`;

async function ping() {
  try {
    const r = await fetch(`${BASE}/api/state`, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}

let starting = null;
async function ensureServer() {
  if (await ping()) return;
  starting ||= (async () => {
    const child = spawn(process.execPath, [path.join(ROOT, 'src', 'server', 'index.mjs')], {
      cwd: ROOT,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (await ping()) return;
    }
    throw new Error(`Le serveur local ne répond pas sur ${BASE}. Lancez "npm start" dans le dossier du projet.`);
  })().finally(() => {
    starting = null;
  });
  return starting;
}

async function api(method, url, body) {
  await ensureServer();
  const r = await fetch(`${BASE}${url}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

async function openInterface() {
  await ensureServer();
  const { openBrowser } = await import('../server/index.mjs');
  openBrowser(URL_INTERFACE);
  return `Interface ouverte : ${URL_INTERFACE}`;
}

// skill expert-build-poe2, lu à chaque appel de guide_expert (toujours à jour)
const lireGuide = (fichier) => fs.readFileSync(path.join(ROOT, SKILL_DIR, fichier), 'utf8');

const server = createMcpServer({ api, interfaceUrl: URL_INTERFACE, openInterface, lireGuide });
const transport = new StdioServerTransport();
await server.connect(transport);
ensureServer().catch((e) => console.error(e.message));
