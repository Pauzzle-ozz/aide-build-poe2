// Fonction Cloudflare Pages : /relais/<jeton> (WebSocket de l'onglet), transmis au Worker aide-build-poe2-claude
import { versOutils } from '../../cloudflare/pages.mjs';

export const onRequest = versOutils;
