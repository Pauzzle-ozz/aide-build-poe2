// Analyse du texte d'objet au format Path of Building / jeu (copier-coller Ctrl+C),
// et traduction des modificateurs anglais vers le français.

const NUM_RE = /[+-]?\d+(?:\.\d+)?/g;

export function templateKey(text) {
  return String(text)
    .replace(/\[([^\]|]+\|)?([^\]]+)\]/g, '$2')
    .replace(NUM_RE, '#')
    .replace(/\+#/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Traduit une ligne de mod EN -> FR à l'aide de la table de modèles. Renvoie null si inconnue. */
export function translateLine(line, translations) {
  if (!translations) return null;
  const clean = String(line).replace(/\s*\((?:crafted|implicit|rune|enchant|desecrated|fractured)\)\s*$/i, '');
  const key = templateKey(clean);
  let tpl = translations[key];
  // le site d'échange ne connaît que « increased » : on dérive « reduced » -> « de Réduction »
  if (!tpl && /\breduced\b/.test(key)) {
    const inc = translations[key.replace(/\breduced\b/, 'increased')];
    if (inc && /d'Augmentation/.test(inc)) tpl = inc.replace(/d'Augmentation/, 'de Réduction');
  }
  if (!tpl) return null;
  const nums = clean.match(NUM_RE) || [];
  let i = 0;
  const out = tpl.replace(/[+-]?#/g, (m) => {
    const v = nums[i++];
    if (v === undefined) return m;
    const abs = v.replace(/^[+-]/, '');
    if (m.startsWith('+')) return (v.startsWith('-') ? '-' : '+') + abs;
    if (m.startsWith('-')) return '-' + abs;
    // les modèles du site d'échange n'ont pas de signe : on garde celui du texte d'origine
    return v;
  });
  return out;
}

export function translateLines(lines, translations) {
  return (lines || []).map((l) => translateLine(l, translations) || l);
}

const HEADER_KEYS = /^(Unique ID|Item Level|Quality|Sockets|LevelReq|Level|Requires.*|Radius|Limited to|Item Class|Rune|Selected Variant|Selected Alt Variant|Has Alt Variant|Variant|League|Source|Armour|Evasion|Evasion Rating|Energy Shield|Ward|Spirit|Catalyst|Talisman Tier|Charm Slots|Prefix|Suffix|Crafted|Note|Implicits|Physical Damage|Elemental Damage|Critical Hit Chance|Attacks per Second|Reload Time|Block chance|Stack Size)\s*:/i;

/**
 * Parse un objet texte. Accepte le format PoB (« Rarity: RARE ») et le format du jeu
 * (« Rareté: Rare » / « Rarity: Rare » avec séparateurs « -------- »).
 */
export function parseItemText(raw, { variant } = {}) {
  const lines = String(raw)
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^-{4,}$/.test(l));
  let rarity = 'RARE';
  let i = 0;
  const m0 = lines[0]?.match(/^(?:Rarity|Rareté)\s*:\s*(\w+)/i);
  if (m0) {
    const r = m0[1].toUpperCase();
    rarity = { MAGIQUE: 'MAGIC', UNIQUE: 'UNIQUE', NORMAL: 'NORMAL', RARE: 'RARE', MAGIC: 'MAGIC' }[r] || r;
    i = 1;
  }
  if (lines[i]?.match(/^(Item Class|Classe d'objet)\s*:/i)) i++;
  let name = lines[i++] || '';
  let base = name;
  if (rarity === 'RARE' || rarity === 'UNIQUE') {
    base = lines[i++] || '';
  }
  const implicits = [];
  const explicits = [];
  let implicitCount = null;
  let quality = 0;
  let corrupted = false;
  const rest = lines.slice(i);
  const hasImplicitHeader = rest.some((l) => /^Implicits:\s*\d+/i.test(l));
  let inMods = !hasImplicitHeader;
  for (const l0 of rest) {
    let l = l0;
    const imp = l.match(/^Implicits:\s*(\d+)/i);
    if (imp) {
      implicitCount = Number(imp[1]);
      inMods = true;
      continue;
    }
    const q = l.match(/^Quality:\s*\+?(\d+)/i);
    if (q) quality = Number(q[1]);
    if (/^Corrupted$/i.test(l)) {
      corrupted = true;
      continue;
    }
    if (/^(Mirrored|Unidentified|Sanctified|Fractured Item|Synthesised Item)$/i.test(l)) continue;
    if (!inMods || (HEADER_KEYS.test(l) && !/^Grants Skill/i.test(l))) continue;
    // préfixes PoB : {variant:1,2}{range:0.5}{crafted}{tags:...}
    let skip = false;
    l = l.replace(/\{([^}]*)\}/g, (_, inner) => {
      const v = inner.match(/^variant:([\d,]+)/);
      if (v && variant && !v[1].split(',').includes(String(variant))) skip = true;
      return '';
    }).trim();
    if (skip || !l) continue;
    l = l.replace(/\s*\((implicit|enchant|rune|crafted|desecrated|fractured)\)$/i, (m, k) => (k.toLowerCase() === 'implicit' ? '' : m));
    if (implicitCount !== null && implicits.length < implicitCount) implicits.push(l);
    else if (/\(implicit\)$/i.test(l0)) implicits.push(l);
    else explicits.push(l);
  }
  return { rarity, name, base, implicits, explicits, quality, corrupted };
}

/** Texte d'objet au format PoB (anglais) à partir de notre modèle */
export function itemToPobText(item) {
  const lines = [`Rarity: ${item.rarity || 'RARE'}`];
  if (item.rarity === 'RARE' || item.rarity === 'UNIQUE') {
    lines.push(item.nameEn || item.name || 'Objet');
    lines.push(item.baseEn || item.base || '');
  } else {
    lines.push(item.baseEn || item.base || item.nameEn || item.name || '');
  }
  if (item.quality) lines.push(`Quality: ${item.quality}`);
  const imp = item.implicits?.length ? item.implicits : item.implicitsFr || [];
  const exp = item.explicits?.length ? item.explicits : item.explicitsFr || [];
  lines.push(`Implicits: ${imp.length}`);
  lines.push(...imp, ...exp);
  if (item.corrupted) lines.push('Corrupted');
  return lines.join('\n');
}
