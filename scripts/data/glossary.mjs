// Construit data/glossary.json : le glossaire officiel du jeu (mots-clés soulignés dans les infobulles),
// en français, depuis poe2db.tw/fr/Keywords, + toutes les formes rencontrées de chaque mot-clé
// (« Électrocution », « électrocuté », « Électrocutez »…) relevées dans les pages poe2db en cache.
import fs from 'node:fs';
import path from 'node:path';
import { CACHE_DIR } from '../lib/paths.mjs';
import { fetchText } from '../lib/http.mjs';
import { cheerio } from '../lib/html.mjs';

const KEYWORDS_URL = 'https://poe2db.tw/fr/Keywords';
const KEYWORDS_URL_EN = 'https://poe2db.tw/us/Keywords';
// formes trop générales pour être soulignées partout
const SKIP_FORMS = new Set(['niveau', 'niveaux', 'objet', 'objets', 'le', 'la', 'les', 'de', 'des', 'sur', 'arme', 'armes',
  'level', 'levels', 'item', 'items', 'weapon', 'weapons', 'the', 'of', 'on', 'and', 'for',
  // mots courants que le jeu ne souligne que dans un contexte précis : hors contexte, ils induiraient en erreur
  'rayon', 'gagnez', 'gagnent', 'gagne', 'perdez', 'perd', 'perdue', 'tuer', 'pouvoir', 'supplémentaire', 'infligez',
  'coup', 'coups', 'lié', 'charger', 'revient', 'reviennent', 'revenir',
  'extra', 'lose', 'fully', 'broken', 'load', 'struck', 'normal']);

const decode = (() => {
  const cache = new Map();
  return (s) => {
    if (!/[&<]/.test(s)) return s;
    if (!cache.has(s)) cache.set(s, cheerio.load(`<p>${s}</p>`)('p').text());
    return cache.get(s);
  };
})();
const slugOf = (href) => decodeURIComponent(String(href || '').replace(/^\/?(fr|us)\//, '').replace(/^\//, '').split(/[?#]/)[0]);
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Définition : texte + mots-clés imbriqués conservés sous forme de <span class="kw" data-k="…"> */
function cleanDefinition($, el) {
  let out = '';
  const walk = (nodes) => {
    nodes.each((_, n) => {
      if (n.type === 'text') out += escapeHtml(n.data.replace(/\s+/g, ' '));
      else if (n.type === 'tag') {
        if (n.name === 'br') out += '<br>';
        else if (n.name === 'a' && /KeywordPopups/.test($(n).attr('class') || '')) {
          out += `<span class="kw" data-k="${escapeHtml(slugOf($(n).attr('href')))}">${escapeHtml($(n).text())}</span>`;
        } else walk($(n).contents());
      }
    });
  };
  walk($(el).contents());
  return out.replace(/(<br>\s*){3,}/g, '<br><br>').trim();
}

function parseKeywords(html) {
  const $ = cheerio.load(html);
  const out = {};
  $('div.col').each((_, col) => {
    const a = $(col).find('a.strong').first();
    const def = $(col).find('div.fontinRegular').first();
    if (!a.length || !def.length) return;
    const slug = slugOf(a.attr('href'));
    const title = a.text().trim();
    if (!slug || !title || out[slug] || /DNT/.test(title)) return; // entrées internes non utilisées
    out[slug] = { t: title, d: cleanDefinition($, def) };
  });
  return out;
}

// Abréviations internes du jeu (définition « [DNT] Str ») : le mot est souligné en jeu mais n'a pas de définition
// propre ; on le renvoie au terme complet (« Force » -> Force, « Dex » -> Dextérité, « Force/Dex » -> Attributs).
const PLACEHOLDER_ALIASES = {
  Str: 'Strength',
  Dex: 'Dexterity',
  Int: 'Intelligence',
  Str_Dex: 'Attributes',
  Str_Int: 'Attributes',
  Dex_Int: 'Attributes',
  Str_Dex_Int: 'Attributes',
  'Two-Hander': 'Two-Handed',
};
const isPlaceholder = (d) => /^\s*\[?DNT\b/.test(d || '');

export async function buildGlossary() {
  const entries = parseKeywords(await fetchText(KEYWORDS_URL));
  // version anglaise officielle (bouton FR / EN de l'interface, recherche « shock » -> Électrocution)
  try {
    const en = parseKeywords(await fetchText(KEYWORDS_URL_EN));
    for (const [slug, e] of Object.entries(en)) {
      if (entries[slug]) Object.assign(entries[slug], { tEn: e.t, dEn: e.d });
    }
  } catch (e) {
    console.warn(`  ! glossaire anglais indisponible : ${e.message}`);
  }

  // entrées sans vraie définition : retirées, leurs formes (« dex », « force/int »…) renvoient au terme complet
  const alias = new Map();
  const aliasTitles = [];
  for (const [slug, e] of Object.entries(entries)) {
    if (!isPlaceholder(e.d)) continue;
    delete entries[slug];
    const to = PLACEHOLDER_ALIASES[slug];
    if (!to) continue;
    alias.set(slug, to);
    aliasTitles.push([to, e]);
  }
  for (const [slug, to] of alias) if (!entries[to]) alias.delete(slug);
  const resolve = (slug) => alias.get(slug) || slug;
  const relink = (d) => d && d.replace(/data-k="([^"]+)"/g, (m, k) => (alias.has(k) ? `data-k="${alias.get(k)}"` : m));
  for (const e of Object.values(entries)) {
    e.d = relink(e.d);
    if (e.dEn) e.dEn = relink(e.dEn);
  }

  // Formes : toutes les ancres « KeywordPopups » des pages poe2db en cache, séparées par langue
  // (une page anglaise a un fichier « .url » contenant /us/ ; les autres pages du cache sont en français)
  const counts = { fr: new Map(), en: new Map() }; // forme -> Map(slug -> n)
  const add = (lang, form, rawSlug) => {
    const slug = resolve(rawSlug);
    const f = form.trim().toLowerCase();
    if (f.length < 3 || /^\d/.test(f) || SKIP_FORMS.has(f) || !entries[slug]) return;
    const c = counts[lang];
    if (!c.has(f)) c.set(f, new Map());
    const m = c.get(f);
    m.set(slug, (m.get(slug) || 0) + 1);
  };
  for (const [slug, e] of [...Object.entries(entries), ...aliasTitles]) {
    for (let i = 0; i < 3; i++) {
      add('fr', e.t, slug);
      if (e.tEn) add('en', e.tEn, slug);
    }
  }
  const dir = path.join(CACHE_DIR, 'http');
  const re = /<a\b([^>]*\bKeywordPopups\b[^>]*)>([^<]{2,60})<\/a>/g;
  const files = { fr: 0, en: 0 };
  for (const f of fs.readdirSync(dir)) {
    if (f.includes('.')) continue; // fichiers « .url »
    const txt = fs.readFileSync(path.join(dir, f), 'utf8');
    if (!txt.includes('KeywordPopups')) continue;
    const urlFile = path.join(dir, `${f}.url`);
    const lang = fs.existsSync(urlFile) && /\/us\//.test(fs.readFileSync(urlFile, 'utf8')) ? 'en' : 'fr';
    files[lang]++;
    for (const m of txt.matchAll(re)) {
      const href = (m[1].match(/\bhref="([^"]+)"/) || [])[1];
      if (!href) continue;
      add(lang, decode(m[2]), slugOf(href));
    }
  }
  // Quelques titres sont restés en anglais sur la page française (« Melee », « Allies »…) : on prend la graphie
  // française officielle employée par le jeu dans ses infobulles (« mêlée », « alliés »), même mot aux accents près.
  const plainAscii = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  for (const [slug, e] of Object.entries(entries)) {
    if ((e.tEn && e.t !== e.tEn) || !/^[\x20-\x7E]+$/.test(e.t)) continue;
    let best = null;
    for (const [f, m] of counts.fr) {
      const n = m.get(slug);
      // au moins 2 occurrences : écarte les fautes de frappe isolées (« Éxpédition »)
      if (n >= 2 && f !== e.t.toLowerCase() && plainAscii(f) === e.t.toLowerCase() && (!best || n > best[1])) best = [f, n];
    }
    if (best) e.t = best[0].charAt(0).toLocaleUpperCase('fr') + best[0].slice(1);
  }

  // - une forme identique au titre d'un terme renvoie toujours à ce terme (« drain » -> Drain, pas Drain de Vie) ;
  // - un mot isolé d'un titre composé n'est pas gardé (« vie » seul ne doit pas ouvrir « Drain de Vie »)
  const pick = (c, titleKey) => {
    const byTitle = new Map();
    for (const [slug, e] of Object.entries(entries)) if (e[titleKey]) byTitle.set(e[titleKey].toLowerCase(), slug);
    const out = {};
    for (const [f, m] of c) {
      if (byTitle.has(f)) {
        out[f] = byTitle.get(f);
        continue;
      }
      const slug = [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const words = String(entries[slug][titleKey] || '').toLowerCase().split(/[\s'’-]+/);
      if (words.length > 1 && words.includes(f)) continue;
      out[f] = slug;
    }
    return out;
  };
  const forms = pick(counts.fr, 't');
  const formsEn = pick(counts.en, 'tEn');
  const nEn = Object.values(entries).filter((e) => e.tEn).length;
  console.log(`  ${Object.keys(entries).length} termes officiels (${nEn} en anglais), ${Object.keys(forms).length} formes FR (${files.fr} pages), ${Object.keys(formsEn).length} formes EN (${files.en} pages)`);
  return { entries, forms, formsEn };
}
