// Lancement en un clic (lancer.bat) : remet l'interface à jour, puis démarre l'outil et ouvre le navigateur.
// Si l'outil tourne déjà (par exemple démarré par Claude), ouvre seulement le navigateur.
import path from 'node:path';
import { ROOT } from './lib/paths.mjs';
import { startServer, openBrowser, PORT } from '../src/server/index.mjs';

const url = `http://localhost:${PORT}`;

console.log("Mise à jour de l'interface...");
const { build } = await import('vite');
await build({ configFile: path.join(ROOT, 'vite.config.mjs'), logLevel: 'warn' });

const dejaLance = await fetch(`http://127.0.0.1:${PORT}/`, { signal: AbortSignal.timeout(2000) }).then(() => true, () => false);

if (dejaLance) {
  console.log(`L'outil tourne déjà : ouverture de ${url}`);
  openBrowser(url);
  setTimeout(() => process.exit(0), 2000);
} else {
  await startServer({ open: true });
  console.log("Fermez cette fenêtre pour arrêter l'outil.");
}
