// Outils HTML : nettoyage des infobulles poe2db (liste blanche) et conversion en texte.
import * as cheerio from 'cheerio';

const KEEP_TAGS = new Set(['div', 'span', 'br']);
const DROP_CLASSES = new Set(['itemboximage', 'gemSkill', 'lazy']);

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Reconstruit un HTML minimal (div/span/br + classes) sans liens, images ni styles. */
export function sanitizeTooltip(html) {
  const $ = cheerio.load(html, null, false);
  const walk = (nodes) => {
    let out = '';
    nodes.each((_, el) => {
      if (el.type === 'text') {
        out += escapeHtml(el.data.replace(/\s+/g, ' '));
        return;
      }
      if (el.type !== 'tag') return;
      const tag = el.name.toLowerCase();
      const cls = ($(el).attr('class') || '').split(/\s+/).filter((c) => /^[A-Za-z][\w-]*$/.test(c));
      if (cls.some((c) => DROP_CLASSES.has(c)) || tag === 'img' || tag === 'script' || tag === 'style') return;
      const inner = walk($(el).contents());
      if (tag === 'br') {
        out += '<br>';
      } else if (KEEP_TAGS.has(tag)) {
        const c = cls.length ? ` class="${cls.join(' ')}"` : '';
        out += `<${tag}${c}>${inner}</${tag}>`;
      } else {
        out += inner; // a, b, i... => on garde le texte
      }
    });
    return out;
  };
  return walk($.root().contents()).replace(/>\s+</g, '><').trim();
}

/** Texte brut d'un fragment HTML (un bloc = une ligne). */
export function htmlToText(html) {
  const $ = cheerio.load(html, null, false);
  $('br').replaceWith('\n');
  $('div').each((_, el) => {
    $(el).prepend('\n');
    $(el).append('\n');
  });
  return $.root()
    .text()
    .replace(/ /g, ' ')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

export function textOf($, el) {
  return $(el).text().replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

/** Retire le balisage de mots-clés du jeu : « [Clé|Texte] » -> « Texte », « [Texte] » -> « Texte » */
export function stripMarkup(s) {
  return String(s ?? '').replace(/\[([^\]|]+)\|([^\]]+)\]/g, '$2').replace(/\[([^\]|]+)\]/g, '$1');
}

export function slugKey(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export { cheerio };
