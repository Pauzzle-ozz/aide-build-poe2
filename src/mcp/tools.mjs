// Outils MCP de l'Aide Build PoE2 (lire et modifier les builds, chercher dans les données du jeu
// en français, piloter l'interface). Partagés entre :
//   - le serveur MCP local (stdio, src/mcp/server.mjs), qui passe par le serveur local (port 4747) ;
//   - la version en ligne (Worker Cloudflare, cloudflare/worker.mjs), qui passe par l'onglet du site
//     ouvert chez l'utilisateur, où sont enregistrés ses builds.
// Les outils n'appellent que l'API de l'outil (routes de src/core/build-routes.mjs,
// src/core/search-routes.mjs et /api/ui), via la fonction `api` fournie.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerGuide } from './guide.mjs';

const q = (o) =>
  '?' +
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');

const RAPPEL_METHODE = "Pour concevoir ou analyser ce build, suis la méthode du skill expert : guide_expert (sujet « methode » si ce n'est pas déjà fait, puis « ascendance » pour cette classe).";

const ok = (data) => ({ content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 1) }] });
const fail = (e) => ({ isError: true, content: [{ type: 'text', text: `Erreur : ${e.message || e}` }] });
const tool = (fn) => async (args) => {
  try {
    return ok(await fn(args || {}));
  } catch (e) {
    return fail(e);
  }
};

function formatSummary(s) {
  const L = [];
  L.push(`# ${s.name}  (id: ${s.id})${s.id === 'bac-a-sable' ? ' — BAC À SABLE (mode libre, pas un build enregistré)' : ''}`);
  if (s.pending) L.push(`⚠ MODIFICATIONS NON VALIDÉES (brouillon) : ${s.pendingChanges.join(', ')}. L'utilisateur doit cliquer sur « Valider » pour les enregistrer.`);
  L.push(`Classe : ${s.class?.name || '?'}${s.ascendancy ? ` — Ascendance : ${s.ascendancy.name}` : ' — pas d\'ascendance'} — Niveau ${s.level}`);
  L.push(`Points passifs : ${s.points.passiveUsed} utilisés (≈ ${s.points.passiveAvailableAtLevel} disponibles au niveau ${s.level}, max ${s.points.passiveMax}) — Ascendance : ${s.points.ascendancyUsed}/${s.points.ascendancyMax}`);
  if (s.attributes) L.push(`Attributs : Force ${s.attributes.str} · Dextérité ${s.attributes.dex} · Intelligence ${s.attributes.int}`);
  if (s.keystones.length) L.push(`\n## Clés de voûte\n${s.keystones.map((k) => `- ${k.name} : ${k.stats.join(' / ')}`).join('\n')}`);
  if (s.ascendancyNodes.length) L.push(`\n## Passifs d'ascendance\n${s.ascendancyNodes.map((k) => `- ${k.name} : ${k.stats.join(' / ')}`).join('\n')}`);
  if (s.notables.length) L.push(`\n## Notables (${s.notables.length})\n${s.notables.map((k) => `- ${k.name} [${k.id}]`).join('\n')}`);
  L.push(`\n## Compétences (gemmes)`);
  if (!s.skills.length) L.push('(aucune)');
  s.skills.forEach((sk, i) => {
    L.push(`${i + 1}. [id ${sk.id}]${sk.label ? ` ${sk.label} :` : ''} ${sk.gems.map((g) => `${g.name} (niv ${g.level}${g.quality ? `, q${g.quality}` : ''}${g.enabled ? '' : ', désactivée'})`).join(' + ')}${sk.enabled ? '' : ' — désactivé'}`);
  });
  if (s.skillWarnings?.length) L.push(`⚠ Problèmes de gemmes :\n${s.skillWarnings.map((w) => `- ${w}`).join('\n')}`);
  L.push(`\n## Équipement`);
  if (!s.items.length) L.push('(rien d\'équipé)');
  for (const it of s.items) L.push(`- ${it.slotLabel} : ${it.name}${it.base && it.base !== it.name ? ` (${it.base})` : ''} [${it.rarity}]${it.mods.length ? `\n    ${it.mods.join('\n    ')}` : ''}`);
  L.push(`\n## Statistiques cumulées de l'arbre passif\n${s.passiveStats.join('\n') || '(aucune)'}`);
  if (s.itemStats.length) L.push(`\n## Statistiques cumulées de l'équipement\n${s.itemStats.join('\n')}`);
  if (s.notes) L.push(`\n## Notes\n${s.notes}`);
  return L.join('\n');
}

const METHODE =
  "MÉTHODE : avant de concevoir, remplir, analyser ou corriger un build, et avant de répondre à une question sur les passifs, les gemmes, les ascendances, les dégâts ou les défenses, " +
  "appelle guide_expert (sujet « methode », une fois par conversation), puis les fiches utiles (« ascendance » de la classe, « degats », « defenses », « progression »…), et applique ses règles. ";

function instructions({ interfaceUrl, enLigne }) {
  const ouverte = `L'utilisateur voit une interface graphique de style jeu dans son navigateur (${interfaceUrl}) qui se met à jour en direct quand tu modifies un build. `;
  const onglet = enLigne
    ? "Ses builds sont enregistrés dans son navigateur : l'onglet du site doit rester ouvert pendant que tu travailles (sinon les outils renvoient une erreur qui l'explique). "
    : '';
  return (
    METHODE +
    (enLigne ? "Outil de création de builds Path of Exile 2, entièrement en français. Les données (arbre passif, gemmes, objets) viennent de Path of Building PoE2 et de poe2db (FR). " : "Outil local de création de builds Path of Exile 2, entièrement en français. Les données (arbre passif, gemmes, objets) viennent de Path of Building PoE2 et de poe2db (FR). ") +
    ouverte +
    onglet +
    "Réponds toujours en français et utilise les noms FR du jeu. Avant de recommander un passif, une gemme ou un objet, vérifie qu'il existe avec les outils de recherche. Utilise naviguer_interface pour montrer à l'utilisateur ce dont tu parles (centrer l'arbre sur un passif, ouvrir un panneau, surligner des nœuds) et afficher_message pour laisser une explication visible dans l'interface. Pour un exemple de build, crée un nouveau build (creer_build) plutôt que d'écraser celui de l'utilisateur, sauf demande explicite. VOCABULAIRE : dans tout texte destiné à l'utilisateur (notes, messages), utilise UNIQUEMENT les termes officiels du client français : ceux du glossaire du jeu (outil glossaire) et les noms FR des gemmes, passifs et objets (outils de recherche). Pas de jargon ni d'anglais (crit, shock, AoE, leech, buff, DPS, minion, skill…). Les termes officiels sont soulignés dans l'interface avec leur définition officielle au survol ; ecrire_notes et verifier_texte te signalent les termes à corriger : corrige-les avant de terminer. Les modifications d'un build enregistré restent en BROUILLON tant que l'utilisateur n'a pas cliqué sur « Valider » dans l'interface : ne valide pas à sa place, sauf s'il te le demande (outil valider_modifications) ou si tu viens de créer ce build à sa demande et que tu as fini de le remplir. Pour tester une idée ou montrer une variante sans rien enregistrer, utilise le bac à sable (outil bac_a_sable, id « bac-a-sable ») : c'est un espace libre qui ne modifie aucun build ; « copier » y met une copie d'un build existant."
  );
}

/** Crée le serveur MCP. `api(méthode, url, corps)` renvoie la réponse JSON de l'API de l'outil. */
export function createMcpServer({ api, interfaceUrl, openInterface = null, enLigne = false, lireGuide = null }) {
  async function ui(cmd) {
    try {
      return await api('POST', '/api/ui', cmd);
    } catch {
      return null;
    }
  }

  async function ops(build, list) {
    return api('POST', `/api/builds/${encodeURIComponent(build || 'active')}/ops`, { ops: list, source: 'claude' });
  }

  const server = new McpServer(
    { name: 'aide-build-poe2', version: '0.2.0' },
    {
      instructions: instructions({ interfaceUrl, enLigne }),
    },
  );

  if (lireGuide) registerGuide(server, { lire: lireGuide, ok, fail });

  server.registerTool('etat_outil', {
    title: "État de l'outil",
    description: "Vérifie que l'outil tourne, indique si l'interface est ouverte et quel build est actif.",
    inputSchema: {},
  }, tool(async () => {
    const st = await api('GET', '/api/state');
    const b = await api('GET', '/api/builds/active');
    return { url: interfaceUrl, interfaceOuverte: st.uiClients > 0, bacASableActif: !!st.inSandbox, versionArbre: st.treeVersion, buildActif: { id: b.id, nom: b.name, classe: b.class, ascendance: b.ascendancy, niveau: b.level, modificationsNonValidees: b.pending ? b.pendingChanges : [] } };
  }));

  if (openInterface) {
    server.registerTool('ouvrir_interface', {
      title: "Ouvrir l'interface",
      description: "Ouvre l'interface graphique de l'outil dans le navigateur de l'utilisateur.",
      inputSchema: {},
    }, tool(openInterface));
  }

  server.registerTool('lister_builds', {
    title: 'Lister les builds',
    description: 'Liste les builds enregistrés (id, nom, classe, ascendance, niveau).',
    inputSchema: {},
  }, tool(async () => {
    const [list, st] = await Promise.all([api('GET', '/api/builds'), api('GET', '/api/state')]);
    return list.map((b) => ({ ...b, actif: b.id === st.activeBuildId }));
  }));

  server.registerTool('creer_build', {
    title: 'Créer un build',
    description: "Crée un nouveau build (et l'affiche dans l'interface). Classe/ascendance en FR ou EN (ex : « Guerrier », « Titan », « Sorceress »). Avant de le remplir : guide_expert (« methode », puis « ascendance »).",
    inputSchema: {
      nom: z.string().describe('Nom du build'),
      classe: z.string().describe('Classe ou ascendance (FR ou EN)'),
      ascendance: z.string().optional().describe("Ascendance (facultatif si déjà donnée dans 'classe')"),
      niveau: z.number().int().min(1).max(100).optional(),
    },
  }, tool(async ({ nom, classe, ascendance, niveau }) => {
    const b = await api('POST', '/api/builds', { name: nom, class: 'Warrior', level: niveau || 1, source: 'claude' });
    const r = await ops(b.id, [{ op: 'setClass', class: classe, ascendancy: ascendance }]);
    await api('POST', `/api/builds/${b.id}/validate`);
    return { id: r.build.id, nom: r.build.name, classe: r.build.class, ascendance: r.build.ascendancy, niveau: r.build.level, methode: RAPPEL_METHODE };
  }));

  server.registerTool('ouvrir_build', {
    title: 'Ouvrir un build',
    description: "Rend un build actif : l'interface de l'utilisateur bascule dessus.",
    inputSchema: { build: z.string().describe('Id ou nom du build') },
  }, tool(async ({ build }) => api('POST', `/api/builds/${encodeURIComponent(build)}/activate`)));

  server.registerTool('lire_build', {
    title: 'Lire un build',
    description: "Résumé complet d'un build : classe, points, attributs, clés de voûte, notables, gemmes, équipement, statistiques cumulées, notes. Sans 'build' : le build actif. Pour l'analyser : guide_expert.",
    inputSchema: {
      build: z.string().optional().describe('Id ou nom (défaut : build actif)'),
      langue: z.enum(['fr', 'en']).optional().describe('fr par défaut ; en pour avoir les textes anglais'),
    },
  }, tool(async ({ build, langue }) => formatSummary(await api('GET', `/api/builds/${encodeURIComponent(build || 'active')}/summary${q({ lang: langue })}`)) + `\n\n---\n${RAPPEL_METHODE}`));

  server.registerTool('modifier_build', {
    title: 'Modifier un build',
    description: 'Renomme le build, change son niveau, sa classe ou son ascendance.',
    inputSchema: {
      build: z.string().optional(),
      nom: z.string().optional(),
      niveau: z.number().int().min(1).max(100).optional(),
      classe: z.string().optional(),
      ascendance: z.string().optional().describe('Nom d\'ascendance, ou "aucune"'),
    },
  }, tool(async ({ build, nom, niveau, classe, ascendance }) => {
    const list = [];
    if (nom) list.push({ op: 'rename', name: nom });
    if (niveau) list.push({ op: 'setLevel', level: niveau });
    if (classe) list.push({ op: 'setClass', class: classe });
    if (ascendance) list.push({ op: 'setAscendancy', ascendancy: /^aucune|none$/i.test(ascendance) ? null : ascendance });
    if (!list.length) throw new Error('Rien à modifier');
    const r = await ops(build, list);
    return { id: r.build.id, nom: r.build.name, classe: r.build.class, ascendance: r.build.ascendancy, niveau: r.build.level, resultats: r.results };
  }));

  server.registerTool('bac_a_sable', {
    title: 'Bac à sable',
    description: "Mode libre, hors des builds enregistrés : ouvrir, copier un build dedans (l'original reste intact), vider, enregistrer comme nouveau build, ou quitter (retour au dernier build). Une fois ouvert, les autres outils (allouer_passifs, ajouter_competence…) agissent sur le bac à sable, qui est le build actif.",
    inputSchema: {
      action: z.enum(['ouvrir', 'copier', 'vider', 'enregistrer', 'quitter']),
      build: z.string().optional().describe("Pour « copier » : id ou nom du build à copier (défaut : build actif)"),
      nom: z.string().optional().describe("Pour « enregistrer » : nom du nouveau build"),
      classe: z.string().optional().describe("Pour « vider » : classe de départ (FR/EN)"),
    },
  }, tool(async ({ action, build, nom, classe }) => {
    if (action === 'ouvrir') {
      const b = await api('POST', '/api/sandbox/open', {});
      return `Bac à sable ouvert (${b.class}${b.ascendancy ? ' / ' + b.ascendancy : ''}, niveau ${b.level}). Les builds enregistrés ne seront pas modifiés.`;
    }
    if (action === 'copier') {
      const src = await api('GET', `/api/builds/${encodeURIComponent(build || 'active')}`);
      await api('POST', '/api/sandbox/open', { fromBuild: src.id });
      return `Copie de « ${src.name} » placée dans le bac à sable, qui est maintenant actif. L'original n'est pas modifié.`;
    }
    if (action === 'vider') {
      await api('POST', '/api/sandbox/open', { reset: true, class: classe || undefined });
      return 'Bac à sable vidé et ouvert.';
    }
    if (action === 'enregistrer') {
      const b = await api('POST', '/api/sandbox/save', { name: nom });
      return { id: b.id, nom: b.name, message: 'Bac à sable enregistré comme nouveau build (maintenant ouvert).' };
    }
    const r = await api('POST', '/api/sandbox/leave', {});
    return `Bac à sable quitté : build actif ${r.activeBuildId}.`;
  }));

  server.registerTool('valider_modifications', {
    title: 'Valider les modifications',
    description: "Enregistre le brouillon d'un build (équivaut au bouton « Valider » de l'interface). À utiliser seulement si l'utilisateur le demande, ou pour un build que tu viens de créer à sa demande.",
    inputSchema: { build: z.string().optional() },
  }, tool(async ({ build }) => {
    const b = await api('POST', `/api/builds/${encodeURIComponent(build || 'active')}/validate`);
    return `Modifications validées : « ${b.name} » est enregistré.`;
  }));

  server.registerTool('annuler_modifications', {
    title: 'Annuler les modifications',
    description: "Jette le brouillon d'un build et revient à sa version enregistrée. Seulement à la demande explicite de l'utilisateur.",
    inputSchema: { build: z.string().optional() },
  }, tool(async ({ build }) => {
    const b = await api('POST', `/api/builds/${encodeURIComponent(build || 'active')}/discard`);
    return `Brouillon annulé : « ${b.name} » est revenu à sa version enregistrée.`;
  }));

  server.registerTool('dupliquer_build', {
    title: 'Dupliquer un build',
    description: 'Copie un build (utile pour proposer une variante sans toucher l\'original).',
    inputSchema: { build: z.string().optional(), nom: z.string().optional() },
  }, tool(async ({ build, nom }) => {
    const b = await api('POST', `/api/builds/${encodeURIComponent(build || 'active')}/duplicate`, { name: nom });
    return { id: b.id, nom: b.name };
  }));

  server.registerTool('supprimer_build', {
    title: 'Supprimer un build',
    description: "Supprime définitivement un build. N'utiliser que si l'utilisateur l'a explicitement demandé.",
    inputSchema: { build: z.string(), confirmer: z.literal(true).describe("Doit valoir true (demande explicite de l'utilisateur)") },
  }, tool(async ({ build }) => {
    const b = await api('GET', `/api/builds/${encodeURIComponent(build)}`);
    await api('DELETE', `/api/builds/${b.id}`);
    return `Build « ${b.name} » supprimé.`;
  }));

  // ---------- Arbre passif
  server.registerTool('rechercher_passifs', {
    title: 'Rechercher des passifs',
    description: "Cherche dans l'arbre passif (noms et effets, FR ou EN). Renvoie id, nom, type, effets et le nombre de points pour l'atteindre depuis l'arbre du build actif.",
    inputSchema: {
      recherche: z.string().describe('Mots-clés : ex « critique », « bouclier d\'énergie », « Resolute Technique »'),
      type: z.enum(['any', 'keystone', 'notable', 'normal', 'jewel']).optional().describe('keystone = clé de voûte'),
      ascendance: z.enum(['build', 'only', 'none', 'all']).optional().describe("build (défaut) : arbre + ascendance du build ; only : seulement ascendances ; none : sans ascendance ; all : tout"),
      limite: z.number().int().min(1).max(100).optional(),
      build: z.string().optional(),
    },
  }, tool(async ({ recherche, type, ascendance, limite, build }) =>
    api('GET', `/api/search/passives${q({ q: recherche, type, ascendancy: ascendance === 'build' ? undefined : ascendance, limit: limite, build })}`)));

  server.registerTool('details_passif', {
    title: "Détails d'un passif",
    description: "Détails d'un nœud (par id ou nom) : effets FR/EN, voisins, chemin depuis l'arbre actuel.",
    inputSchema: { passif: z.string().describe('Id ou nom'), build: z.string().optional() },
  }, tool(async ({ passif, build }) => api('GET', `/api/passives/${encodeURIComponent(passif)}${q({ build })}`)));

  server.registerTool('allouer_passifs', {
    title: 'Allouer des passifs',
    description: "Alloue des passifs (ids ou noms FR/EN) en ajoutant automatiquement le chemin le plus court depuis l'arbre actuel. L'interface se met à jour et montre les nœuds ajoutés.",
    inputSchema: {
      passifs: z.array(z.union([z.string(), z.number()])).describe('Ids ou noms, dans l\'ordre souhaité'),
      attribut: z.enum(['Force', 'Dextérité', 'Intelligence']).optional().describe("Choix pour les nœuds d'attribut alloués"),
      build: z.string().optional(),
      montrer: z.boolean().optional().describe("Centrer l'interface sur le dernier passif (défaut : oui)"),
    },
  }, tool(async ({ passifs, attribut, build, montrer }) => {
    const r = await ops(build, [{ op: 'allocate', nodes: passifs, attribute: attribut }, ...(attribut ? [{ op: 'setAllAttributes', attribute: attribut }] : [])]);
    const res = r.results[0];
    const added = res.added.flatMap((a) => a.path.map((p) => p.id));
    if (montrer !== false && res.added.length) {
      await ui({ action: 'focus', panel: 'tree', node: res.added[res.added.length - 1].target.id, highlight: added });
    }
    const used = r.build.tree.nodes.length;
    return { alloues: res.added.map((a) => ({ cible: a.target, pointsAjoutes: a.path.length, chemin: a.path.map((p) => p.name) })), erreurs: res.errors, totalNoeudsAlloues: used };
  }));

  server.registerTool('retirer_passifs', {
    title: 'Retirer des passifs',
    description: "Désalloue des passifs (et tout ce qui n'est plus relié au départ).",
    inputSchema: { passifs: z.array(z.union([z.string(), z.number()])), build: z.string().optional() },
  }, tool(async ({ passifs, build }) => {
    const r = await ops(build, [{ op: 'deallocate', nodes: passifs }]);
    return { retires: r.results[0].removed };
  }));

  server.registerTool('apercu_chemin', {
    title: 'Aperçu de chemin',
    description: "Calcule (sans allouer) le chemin et le coût en points pour atteindre un passif, et le surligne dans l'interface.",
    inputSchema: { passif: z.string(), build: z.string().optional() },
  }, tool(async ({ passif, build }) => {
    const d = await api('GET', `/api/passives/${encodeURIComponent(passif)}${q({ build })}`);
    if (d.pathFromTree) await ui({ action: 'focus', panel: 'tree', node: d.id, preview: d.pathFromTree.map((p) => p.id) });
    return { passif: { id: d.id, nom: d.name, effets: d.stats }, dejaAlloue: d.allocated, coutEnPoints: d.pathFromTree ? d.pathFromTree.length : null, chemin: d.pathFromTree?.map((p) => p.name) };
  }));

  server.registerTool('choisir_attributs', {
    title: "Choisir les attributs",
    description: "Choisit Force / Dextérité / Intelligence pour les nœuds « +5 à n'importe quel Attribut » (un nœud précis, ou tous les nœuds alloués).",
    inputSchema: {
      attribut: z.enum(['Force', 'Dextérité', 'Intelligence']),
      noeud: z.number().int().optional().describe('Id du nœud ; absent = tous les nœuds d\'attribut alloués'),
      ecraser: z.boolean().optional().describe('Remplacer aussi les choix déjà faits (défaut : non)'),
      build: z.string().optional(),
    },
  }, tool(async ({ attribut, noeud, ecraser, build }) => {
    const r = await ops(build, [noeud ? { op: 'setAttribute', node: noeud, attribute: attribut } : { op: 'setAllAttributes', attribute: attribut, overwrite: ecraser }]);
    return r.results[0];
  }));

  server.registerTool('reinitialiser_arbre', {
    title: "Réinitialiser l'arbre",
    description: "Retire tous les passifs alloués du build.",
    inputSchema: { build: z.string().optional() },
  }, tool(async ({ build }) => {
    await ops(build, [{ op: 'resetTree' }]);
    return 'Arbre réinitialisé.';
  }));

  // ---------- Gemmes
  server.registerTool('rechercher_gemmes', {
    title: 'Rechercher des gemmes',
    description: "Cherche des gemmes (aptitude, soutien, esprit, méta, lignage) par nom, mot-clé ou description (FR/EN). Chaque gemme a une catégorie officielle (famille d'arme du jeu : Masse=Guerrier, Bâton de combat=Moine, Arc=Rôdeuse, Arbalète=Mercenaire, Lance=Chasseresse, Élémentaire=Magicienne, Occulte=Sorcière, Primitif=Druide) ; les soutiens sont communs à toutes les classes.",
    inputSchema: {
      recherche: z.string().optional(),
      type: z.enum(['any', 'skill', 'support', 'spirit', 'meta', 'lineage']).optional(),
      tag: z.string().optional().describe('Mot-clé exact, ex « Projectile », « Feu », « Minion »'),
      classe: z.string().optional().describe('Classe associée (FR/EN, ex « Moine », « Sorceress ») ou « commune »'),
      limite: z.number().int().min(1).max(100).optional(),
    },
  }, tool(async ({ recherche, type, tag, classe, limite }) => api('GET', `/api/search/gems${q({ q: recherche, kind: type, tag, class: classe, limit: limite })}`)));

  server.registerTool('details_gemme', {
    title: "Détails d'une gemme",
    description: "Infobulle complète d'une gemme en français (coût, prérequis, description, effets par niveau, qualité) + données PoB.",
    inputSchema: { gemme: z.string().describe('Nom FR/EN ou id') },
  }, tool(async ({ gemme }) => {
    const g = await api('GET', `/api/gems/${encodeURIComponent(gemme)}`);
    const { tooltipHtml, ...rest } = g;
    return rest;
  }));

  server.registerTool('ajouter_competence', {
    title: 'Ajouter une compétence',
    description: "Ajoute un groupe de gemmes au build : la première est la gemme d'aptitude, les suivantes ses gemmes de soutien.",
    inputSchema: {
      gemmes: z.array(z.string()).min(1).describe('[gemme principale, soutien 1, soutien 2, ...] (noms FR/EN)'),
      niveau: z.number().int().min(1).max(40).optional(),
      libelle: z.string().optional(),
      build: z.string().optional(),
    },
  }, tool(async ({ gemmes, niveau, libelle, build }) => {
    const r = await ops(build, [{ op: 'addSkill', gems: gemmes, level: niveau, label: libelle }]);
    await ui({ action: 'focus', panel: 'skills' });
    return { id: r.results[0].skill.id, gemmes: r.results[0].gems, avertissements: r.results[0].warnings };
  }));

  server.registerTool('soutiens_compatibles', {
    title: 'Soutiens compatibles',
    description: "Liste les gemmes de soutien qui peuvent réellement modifier une aptitude donnée (règles de Path of Building), avec leur palier (tier). À utiliser AVANT de choisir des soutiens.",
    inputSchema: {
      gemme: z.string().describe("Gemme d'aptitude (nom FR/EN)"),
      recherche: z.string().optional().describe('Filtre (ex : « foudre », « critique », « zone »)'),
      palier_max: z.number().int().optional().describe('Palier (tier) maximal, pour le leveling'),
      limite: z.number().int().min(1).max(200).optional(),
    },
  }, tool(async ({ gemme, recherche, palier_max, limite }) => api('GET', `/api/gems/${encodeURIComponent(gemme)}/supports${q({ q: recherche, maxTier: palier_max, limit: limite })}`)));

  server.registerTool('modifier_competence', {
    title: 'Modifier une compétence',
    description: "Remplace les gemmes, le libellé ou l'activation d'un groupe de gemmes (id donné par lire_build).",
    inputSchema: {
      id: z.string(),
      gemmes: z.array(z.string()).optional(),
      libelle: z.string().optional(),
      active: z.boolean().optional(),
      build: z.string().optional(),
    },
  }, tool(async ({ id, gemmes, libelle, active, build }) => {
    const r = await ops(build, [{ op: 'updateSkill', skillId: id, gems: gemmes, label: libelle, enabled: active }]);
    return { gemmes: r.results[0].skill.gems.map((g) => g.gemId), avertissements: r.results[0].warnings };
  }));

  server.registerTool('retirer_competence', {
    title: 'Retirer une compétence',
    description: 'Supprime un groupe de gemmes du build.',
    inputSchema: { id: z.string(), build: z.string().optional() },
  }, tool(async ({ id, build }) => {
    await ops(build, [{ op: 'removeSkill', skillId: id }]);
    return 'Compétence retirée.';
  }));

  // ---------- Objets
  server.registerTool('rechercher_objets', {
    title: 'Rechercher des objets',
    description: 'Cherche des objets uniques ou des objets de base (FR/EN), filtrables par emplacement ou classe d\'objet.',
    inputSchema: {
      recherche: z.string().optional(),
      type: z.enum(['unique', 'base']).optional().describe('unique (défaut) ou base'),
      emplacement: z.string().optional().describe('Helmet, Body Armour, Gloves, Boots, Amulet, Ring 1, Belt, Weapon 1, Weapon 2, Flask 1, Charm 1...'),
      classe: z.string().optional().describe("Classe d'objet, ex « Bow », « Arc », « Focus »"),
      limite: z.number().int().min(1).max(100).optional(),
    },
  }, tool(async ({ recherche, type, emplacement, classe, limite }) => {
    const list = await api('GET', `/api/search/items${q({ q: recherche, kind: type, slot: emplacement, class: classe, limit: limite })}`);
    return list.map(({ textEn, iconUrl, slots, ...it }) => it);
  }));

  server.registerTool('equiper_objet', {
    title: 'Équiper un objet',
    description: "Équipe un objet dans un emplacement : un unique (par nom), ou un objet de base avec des mods (rare/magique), ou un texte d'objet copié du jeu/PoB.",
    inputSchema: {
      emplacement: z.string().describe('Ex : « Casque », « Helmet », « Bague 2 », « Weapon 1 »'),
      unique: z.string().optional().describe("Nom d'un objet unique"),
      base: z.string().optional().describe("Nom de l'objet de base (pour un rare/magique)"),
      nom: z.string().optional().describe("Nom de l'objet rare"),
      rarete: z.enum(['NORMAL', 'MAGIC', 'RARE']).optional(),
      mods: z.array(z.string()).optional().describe('Modificateurs explicites (FR ou EN)'),
      implicites: z.array(z.string()).optional(),
      texte: z.string().optional().describe("Texte complet de l'objet (copié du jeu ou de PoB)"),
      build: z.string().optional(),
    },
  }, tool(async ({ emplacement, unique, base, nom, rarete, mods, implicites, texte, build }) => {
    const r = await ops(build, [{ op: 'equip', slot: emplacement, unique, base, name: nom, rarity: rarete, mods, implicits: implicites, text: texte }]);
    await ui({ action: 'focus', panel: 'items', slot: r.results[0].slot });
    const it = r.results[0].item;
    return { emplacement: r.results[0].slot, objet: { nom: it.name, base: it.base, rarete: it.rarity, mods: [...(it.implicitsFr || []), ...(it.explicitsFr || [])] } };
  }));

  server.registerTool('retirer_objet', {
    title: 'Retirer un objet',
    description: "Vide un emplacement d'équipement.",
    inputSchema: { emplacement: z.string(), build: z.string().optional() },
  }, tool(async ({ emplacement, build }) => {
    await ops(build, [{ op: 'unequip', slot: emplacement }]);
    return 'Objet retiré.';
  }));

  // ---------- Notes, PoB, interface
  server.registerTool('glossaire', {
    title: 'Glossaire officiel du jeu',
    description: "Termes officiels du client français avec leur définition officielle (les mots soulignés dans l'interface). Avec « recherche » : les termes correspondants et leur définition (FR ou EN accepté, ex. « Électrocution », « shock », « Pénétration »). Sans argument : la liste complète des termes officiels. À consulter avant d'écrire des notes pour employer le bon vocabulaire.",
    inputSchema: { recherche: z.string().optional(), limite: z.number().int().min(1).max(50).optional() },
  }, tool(async ({ recherche, limite }) => {
    if (!recherche) {
      const r = await api('GET', '/api/glossary');
      return `${r.nombre} termes officiels :\n${r.termes.join(' · ')}`;
    }
    let res = await api('GET', `/api/glossary${q({ q: recherche, limit: limite })}`);
    if (!res.length) {
      // terme anglais ou jargon : on propose l'équivalent officiel
      const chk = await api('POST', '/api/glossary/check', { text: recherche });
      const prop = chk.aCorriger[0]?.proposition;
      if (prop) res = await api('GET', `/api/glossary${q({ q: prop.replace(/\s*\(.*$/, ''), limit: limite })}`);
      if (prop) return { equivalentOfficiel: prop, termes: res };
    }
    return res;
  }));

  server.registerTool('verifier_texte', {
    title: 'Vérifier le vocabulaire',
    description: "Vérifie un texte (notes, explication) : liste les termes officiels reconnus (qui seront soulignés) et le jargon / l'anglais à remplacer, avec le terme officiel proposé.",
    inputSchema: { texte: z.string() },
  }, tool(async ({ texte }) => api('POST', '/api/glossary/check', { text: texte })));

  server.registerTool('ecrire_notes', {
    title: 'Écrire des notes',
    description: "Écrit dans les notes du build (Markdown) : explications, ordre de progression, conseils. Visible dans le panneau Notes.",
    inputSchema: { texte: z.string(), ajouter: z.boolean().optional().describe('Ajouter à la suite (défaut : remplacer)'), build: z.string().optional() },
  }, tool(async ({ texte, ajouter, build }) => {
    const r = await ops(build, [{ op: 'setNotes', notes: texte, append: !!ajouter }]);
    await ui({ action: 'focus', panel: 'notes' });
    const chk = await api('POST', '/api/glossary/check', { text: r.build.notes || texte });
    return {
      message: 'Notes enregistrées (en brouillon si le build est enregistré : l\'utilisateur valide).',
      termesOfficielsSoulignes: chk.termesOfficielsReconnus,
      aCorriger: chk.aCorriger,
      consigne: chk.aCorriger.length ? 'Des termes non officiels ont été détectés : réécris les notes avec ecrire_notes en utilisant les propositions (vérifie au besoin avec glossaire).' : 'Vocabulaire conforme.',
    };
  }));

  server.registerTool('importer_pob', {
    title: 'Importer un build PoB',
    description: 'Importe un build depuis un code Path of Building PoE2 ou un lien pobb.in / poe.ninja, et l\'ouvre dans l\'interface.',
    inputSchema: { code_ou_lien: z.string(), nom: z.string().optional() },
  }, tool(async ({ code_ou_lien, nom }) => {
    const r = await api('POST', '/api/pob/import', { code: code_ou_lien, name: nom, source: 'claude' });
    return { id: r.build.id, nom: r.build.name, classe: r.build.class, ascendance: r.build.ascendancy, niveau: r.build.level, avertissements: r.warnings };
  }));

  server.registerTool('exporter_pob', {
    title: 'Exporter vers PoB',
    description: "Génère un code d'import Path of Building PoE2 pour le build (pour calculer les DPS dans PoB).",
    inputSchema: { build: z.string().optional() },
  }, tool(async ({ build }) => (await api('GET', `/api/builds/${encodeURIComponent(build || 'active')}/pob`)).code));

  server.registerTool('naviguer_interface', {
    title: "Naviguer dans l'interface",
    description: "Pilote l'interface graphique : ouvrir un panneau, centrer l'arbre sur un passif, surligner des nœuds, ouvrir une fiche de gemme/objet.",
    inputSchema: {
      panneau: z.enum(['arbre', 'equipement', 'gemmes', 'stats', 'notes', 'bibliotheque']).optional(),
      centrer_sur: z.union([z.string(), z.number()]).optional().describe('Id ou nom de passif à centrer'),
      surligner: z.array(z.union([z.string(), z.number()])).optional().describe('Passifs à surligner (ids ou noms)'),
      zoom: z.number().min(0.05).max(2).optional(),
      recherche_bibliotheque: z.string().optional().describe('Texte à rechercher dans la bibliothèque'),
    },
  }, tool(async ({ panneau, centrer_sur, surligner, zoom, recherche_bibliotheque }) => {
    const panelMap = { arbre: 'tree', equipement: 'items', gemmes: 'skills', stats: 'stats', notes: 'notes', bibliotheque: 'library' };
    const resolveId = async (ref) => (/^\d+$/.test(String(ref)) ? Number(ref) : (await api('GET', `/api/passives/${encodeURIComponent(ref)}`)).id);
    const node = centrer_sur !== undefined ? await resolveId(centrer_sur) : undefined;
    const highlight = surligner ? await Promise.all(surligner.map(resolveId)) : undefined;
    const r = await ui({ action: 'focus', panel: panneau ? panelMap[panneau] : node ? 'tree' : undefined, node, highlight, zoom, search: recherche_bibliotheque });
    if (!r?.uiClients) return `Commande envoyée, mais l'interface n'est pas ouverte${openInterface ? ' (utilise ouvrir_interface)' : ''}.`;
    return 'Interface mise à jour.';
  }));

  server.registerTool('afficher_message', {
    title: 'Afficher un message',
    description: "Affiche un encart « Claude » dans l'interface (explication courte, conseil). Markdown simple accepté.",
    inputSchema: { texte: z.string(), titre: z.string().optional() },
  }, tool(async ({ texte, titre }) => {
    const r = await ui({ action: 'message', title: titre, text: texte });
    return r?.uiClients ? 'Message affiché.' : "L'interface n'est pas ouverte.";
  }));

  return server;
}
