// Construit data/translations.json : correspondances de modificateurs EN -> FR
// (API officielle du site d'échange, en anglais et en français, + paires issues de l'arbre passif).
import { fetchJson } from '../lib/http.mjs';
import { stripMarkup } from '../lib/html.mjs';

export function templateKey(text) {
  return String(text)
    .replace(/\[([^\]|]+\|)?([^\]]+)\]/g, '$2')
    .replace(/[+-]?\d+(?:\.\d+)?/g, '#')
    .replace(/\+#/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export async function buildTranslations(tree) {
  const map = {};
  let fromTrade = 0;
  try {
    const en = await fetchJson('https://www.pathofexile.com/api/trade2/data/stats');
    const fr = await fetchJson('https://fr.pathofexile.com/api/trade2/data/stats');
    const frById = {};
    for (const cat of fr.result) for (const e of cat.entries) frById[e.id] = e.text;
    for (const cat of en.result) {
      if (cat.id === 'pseudo') continue;
      for (const e of cat.entries) {
        const f = frById[e.id];
        if (!f || f === e.text) continue; // pas encore traduit par GGG
        const k = templateKey(e.text);
        if (!map[k]) {
          map[k] = stripMarkup(f);
          fromTrade++;
        }
      }
    }
  } catch (e) {
    console.warn(`  ! API d'échange indisponible : ${e.message}`);
  }
  let fromTree = 0;
  for (const n of Object.values(tree.nodes)) {
    if (!n.statsEn?.length || n.statsEn.length !== n.stats.length) continue;
    n.statsEn.forEach((s, i) => {
      const k = templateKey(s);
      const frTpl = n.stats[i].replace(/[+-]?\d+(?:\.\d+)?/g, (m) => (m.startsWith('+') ? '+#' : m.startsWith('-') ? '-#' : '#'));
      // on ne garde que si le nombre de valeurs correspond
      if ((k.match(/#/g) || []).length !== (frTpl.match(/#/g) || []).length) return;
      if (!map[k]) {
        map[k] = frTpl;
        fromTree++;
      }
    });
  }
  console.log(`  ${fromTrade} modèles (site d'échange) + ${fromTree} (arbre passif)`);
  return map;
}
