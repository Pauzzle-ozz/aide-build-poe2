// Installation complète : récupère Path of Building PoE2, extrait les images,
// génère les données FR et construit l'interface.
//   npm run setup            -> tout
//   npm run setup -- --update -> met à jour PoB (git pull) et régénère tout
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, POB_DIR } from './lib/paths.mjs';

const update = process.argv.includes('--update');
const [maj, min] = process.versions.node.split('.').map(Number);
if (maj < 22 || (maj === 22 && min < 15)) {
  console.error(`Node.js ${process.versions.node} détecté : la version 22.15 ou plus récente est nécessaire (décompression zstd).`);
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: ROOT, shell: false, ...opts });
  if (r.status !== 0) {
    console.error(`Échec : ${cmd} ${args.join(' ')}`);
    process.exit(r.status || 1);
  }
}

if (!fs.existsSync(path.join(POB_DIR, 'src', 'TreeData'))) {
  fs.mkdirSync(path.dirname(POB_DIR), { recursive: true });
  run('git', ['clone', '--depth', '1', 'https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2.git', POB_DIR]);
} else if (update) {
  run('git', ['-C', POB_DIR, 'pull', '--depth', '1']);
}

run(process.execPath, [path.join(ROOT, 'scripts', 'extract-assets.mjs')]);
run(process.execPath, [path.join(ROOT, 'scripts', 'build-data.mjs')]);
run('npx', ['vite', 'build', '--config', 'vite.config.mjs'], { shell: process.platform === 'win32' });
// Déclare le serveur MCP pour Claude Code (chemin absolu de ce dossier)
fs.writeFileSync(
  path.join(ROOT, '.mcp.json'),
  JSON.stringify({ mcpServers: { 'aide-build-poe2': { command: 'node', args: [path.join(ROOT, 'src', 'mcp', 'server.mjs')] } } }, null, 2) + '\n',
);
console.log('\nInstallation terminée ! Lancez "npm start" puis ouvrez http://localhost:4747');
