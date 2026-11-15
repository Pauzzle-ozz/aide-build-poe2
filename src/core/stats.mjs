// Agrégation des statistiques (arbre passif + objets) et calcul des attributs.

const NUM_RE = /[+-]?\d+(?:[.,]\d+)?/g;

function parseNum(s) {
  return Number(String(s).replace(',', '.'));
}

function fmt(n) {
  const r = Math.round(n * 100) / 100;
  return String(r).replace('.', ',');
}

/**
 * Regroupe des lignes identiques à valeurs près et additionne les valeurs.
 * Entrée : [{ text, source }] ; sortie : [{ text, count, sources }]
 */
export function aggregateLines(lines) {
  const groups = new Map();
  for (const { text, source } of lines) {
    if (!text) continue;
    // les plages « (10–20) » ne sont pas additionnées : ligne telle quelle
    if (/\(\s*\d+\s*[–-]\s*\d+\s*\)/.test(text)) {
      const k = `raw:${text}`;
      const g = groups.get(k) || { template: null, text, count: 0, sources: [] };
      g.count++;
      if (source) g.sources.push(source);
      groups.set(k, g);
      continue;
    }
    const nums = text.match(NUM_RE) || [];
    const template = text.replace(NUM_RE, (m) => (m.startsWith('+') ? '+#' : m.startsWith('-') ? '-#' : '#'));
    const g = groups.get(template) || { template, values: nums.map(() => 0), signs: nums.map((m) => m[0]), count: 0, sources: [] };
    nums.forEach((m, i) => {
      g.values[i] = (g.values[i] || 0) + Math.abs(parseNum(m)) * (m.startsWith('-') ? -1 : 1);
    });
    g.count++;
    if (source) g.sources.push(source);
    groups.set(template, g);
  }
  const out = [];
  for (const g of groups.values()) {
    let text = g.text;
    if (g.template) {
      let i = 0;
      text = g.template.replace(/[+-]?#/g, (m) => {
        const v = g.values[i++] ?? 0;
        if (m.startsWith('+')) return (v >= 0 ? '+' : '-') + fmt(Math.abs(v));
        if (m.startsWith('-')) return (v <= 0 ? '-' : '+') + fmt(Math.abs(v));
        return fmt(v);
      });
      if (!g.values.length && g.count > 1) text = `${text} (×${g.count})`;
    } else if (g.count > 1) {
      text = `${text} (×${g.count})`;
    }
    out.push({ text, count: g.count, sources: g.sources });
  }
  return out;
}

// --- Attributs (à partir des textes anglais, plus réguliers)
const ATTRS = ['Strength', 'Dexterity', 'Intelligence'];
const ATTR_KEY = { Strength: 'str', Dexterity: 'dex', Intelligence: 'int' };

export function attributeBonus(linesEn) {
  const flat = { str: 0, dex: 0, int: 0 };
  const inc = { str: 0, dex: 0, int: 0 };
  for (const raw of linesEn) {
    const l = String(raw).trim();
    let m;
    if ((m = l.match(/^([+-]\d+) to all Attributes$/i))) {
      for (const k of Object.keys(flat)) flat[k] += Number(m[1]);
    } else if ((m = l.match(/^([+-]\d+) to (Strength|Dexterity|Intelligence) and (Strength|Dexterity|Intelligence)$/i))) {
      flat[ATTR_KEY[cap(m[2])]] += Number(m[1]);
      flat[ATTR_KEY[cap(m[3])]] += Number(m[1]);
    } else if ((m = l.match(/^([+-]\d+) to (Strength|Dexterity|Intelligence)$/i))) {
      flat[ATTR_KEY[cap(m[2])]] += Number(m[1]);
    } else if ((m = l.match(/^(\d+)% increased (Strength|Dexterity|Intelligence)$/i))) {
      inc[ATTR_KEY[cap(m[2])]] += Number(m[1]);
    } else if ((m = l.match(/^(\d+)% increased Attributes$/i))) {
      for (const k of Object.keys(inc)) inc[k] += Number(m[1]);
    }
  }
  return { flat, inc };
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function computeAttributes(base, linesEn) {
  const { flat, inc } = attributeBonus(linesEn);
  const out = {};
  for (const k of ['str', 'dex', 'int']) {
    out[k] = Math.floor((base[k] + flat[k]) * (1 + inc[k] / 100));
  }
  return out;
}

export { ATTRS };
