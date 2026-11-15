// Mode développement : serveur API (port 4747) + Vite avec rechargement à chaud (port 5173).
import { spawn } from 'node:child_process';
import path from 'node:path';
import { ROOT } from './lib/paths.mjs';

const procs = [
  spawn(process.execPath, ['--watch-path=src', path.join(ROOT, 'src', 'server', 'index.mjs')], { cwd: ROOT, stdio: 'inherit' }),
  spawn('npx', ['vite', '--config', 'vite.config.mjs', '--open'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' }),
];
const stop = () => procs.forEach((p) => p.kill());
process.on('SIGINT', stop);
process.on('exit', stop);
