// Worker Cloudflare de la version en ligne (configuration : wrangler.jsonc).
// Cloudflare sert d'abord les fichiers de web/dist-web (interface, données du jeu, images) ;
// ce code ne reçoit que les adresses qui ne correspondent à aucun fichier.
import { handleImg, handlePobUrl } from './handlers.mjs';

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (request.method === 'GET' && pathname === '/img') return handleImg(request, (p) => ctx.waitUntil(p));
    if (request.method === 'GET' && pathname === '/api/pob-url') return handlePobUrl(request);
    return env.ASSETS.fetch(request);
  },
};
