// Fonction Cloudflare Pages : /mcp/<jeton> (serveur MCP pour Claude), transmis au Worker aide-build-poe2-claude
import { versOutils } from '../../cloudflare/pages.mjs';

export const onRequest = versOutils;
