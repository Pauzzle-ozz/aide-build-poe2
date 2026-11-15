// Fonction Cloudflare Pages (si le site est publié avec Pages plutôt qu'avec le Worker) : /img
import { handleImg } from '../cloudflare/handlers.mjs';

export const onRequestGet = ({ request, waitUntil }) => handleImg(request, waitUntil);
