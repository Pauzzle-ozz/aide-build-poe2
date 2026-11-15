// Fonction Cloudflare Pages : /img (icônes poe2db, mises en cache)
import { handleImg } from '../cloudflare/handlers.mjs';

export const onRequestGet = ({ request, waitUntil }) => handleImg(request, waitUntil);
