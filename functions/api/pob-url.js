// Fonction Cloudflare Pages (si le site est publié avec Pages plutôt qu'avec le Worker) : /api/pob-url
import { handlePobUrl } from '../../cloudflare/handlers.mjs';

export const onRequestGet = ({ request }) => handlePobUrl(request);
