// Point d'entrée : node src/server/index.mjs  (ou npm start)
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.mjs';
import { ROOT } from './data.mjs';

export const PORT = Number(process.env.POE2_PORT || 4747);
export const HOST = '127.0.0.1';

export function openBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

export async function startServer({ quiet = false, open = false } = {}) {
  const dist = path.join(ROOT, 'web', 'dist', 'index.html');
  if (!fs.existsSync(dist)) {
    if (!quiet) console.log("Construction de l'interface (première fois)...");
    const { build } = await import('vite');
    await build({ configFile: path.join(ROOT, 'vite.config.mjs'), logLevel: quiet ? 'silent' : 'warn' });
  }
  const { app, attach } = await createApp();
  const server = http.createServer(app);
  attach(server);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, HOST, resolve);
  });
  const url = `http://localhost:${PORT}`;
  if (!quiet) console.log(`Aide Build PoE2 : ${url}`);
  if (open) openBrowser(url);
  return server;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  startServer({ open: process.argv.includes('--open') }).catch((e) => {
    if (e.code === 'EADDRINUSE') console.error(`Le port ${PORT} est déjà utilisé : l'outil tourne peut-être déjà (http://localhost:${PORT}).`);
    else console.error(e);
    process.exit(1);
  });
}
