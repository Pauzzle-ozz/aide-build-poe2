import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const API = `http://127.0.0.1:${process.env.POE2_PORT || 4747}`;

export default defineConfig({
  root: path.join(ROOT, 'web'),
  plugins: [react()],
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
  build: { outDir: path.join(ROOT, 'web', 'dist'), emptyOutDir: true, chunkSizeWarningLimit: 2000 },
});
