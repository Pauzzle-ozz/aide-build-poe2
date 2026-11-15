// Fonctions Cloudflare Pages : transmet au Worker « aide-build-poe2-claude » (liaison de service OUTILS)
// les adresses du serveur MCP (/mcp/<jeton>) et du relais vers l'onglet (/relais/<jeton>).
export function versOutils({ request, env }) {
  if (!env.OUTILS) {
    return new Response(
      JSON.stringify({
        error:
          "Liaison de service OUTILS absente : dans Cloudflare, projet Pages « aide-build-poe2 » → Settings → Bindings, " +
          'vérifiez la liaison de service OUTILS vers le Worker aide-build-poe2-claude (déclarée dans wrangler.jsonc), puis redéployez le site.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8' } },
    );
  }
  return env.OUTILS.fetch(request);
}
