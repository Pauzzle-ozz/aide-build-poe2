// Fonction Cloudflare Pages : /api/pob-url (liens de partage Path of Building)
import { handlePobUrl } from '../../cloudflare/handlers.mjs';

export const onRequestGet = ({ request }) => handlePobUrl(request);
