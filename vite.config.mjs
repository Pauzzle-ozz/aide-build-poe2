import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const API = `http://127.0.0.1:${process.env.POE2_PORT || 4747}`;

/** Version en ligne : les données du jeu (data/*.json) sont publiées avec l'interface */
function copyGameData(outDir) {
  return {
    name: 'copier-donnees-du-jeu',
    apply: 'build',
    writeBundle() {
      const src = path.join(ROOT, 'data');
      const dest = path.join(outDir, 'data');
      fs.mkdirSync(dest, { recursive: true });
      for (const f of fs.readdirSync(src)) if (f.endsWith('.json')) fs.copyFileSync(path.join(src, f), path.join(dest, f));
    },
  };
}

// npm run build      -> web/dist      : interface du serveur local (npm start, Claude via MCP)
// npm run build:web  -> web/dist-web  : version en ligne (Cloudflare Pages), builds gardés dans le navigateur
export default defineConfig(({ mode }) => {
  const web = mode === 'web';
  const outDir = path.join(ROOT, 'web', web ? 'dist-web' : 'dist');
  return {
    root: path.join(ROOT, 'web'),
    plugins: [react(), web && copyGameData(outDir)].filter(Boolean),
    resolve: { alias: { '@core': path.join(ROOT, 'src', 'core') } },
    server: {
      port: 5173,
      fs: { allow: [ROOT] },
      proxy: {
        '/api': API,
        '/data': API,
        '/img': API,
        '/ws': { target: API.replace('http', 'ws'), ws: true },
      },
    },
    build: { outDir, emptyOutDir: true, chunkSizeWarningLimit: 2000 },
  };
});
