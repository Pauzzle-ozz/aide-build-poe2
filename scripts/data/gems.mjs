// Construit data/gems.json : gemmes (PoB, EN) + noms / mots-clés / infobulles FR (poe2db).
import fs from 'node:fs';
import path from 'node:path';
import { POB_DATA } from '../lib/paths.mjs';
import { evalLuaFile } from '../lib/lua.mjs';
import { fetchText } from '../lib/http.mjs';
import { cheerio, sanitizeTooltip, htmlToText, textOf, slugKey, stripMarkup } from '../lib/html.mjs';

const POE2DB = 'https://poe2db.tw';
const PAGES = [
  ['Skill_Gems', 'skill'],
  ['Support_Gems', 'support'],
  ['Spirit_Gems', 'spirit'],
  ['Meta_Skill_Gem', 'meta'],
  ['Lineage_Supports', 'lineage'],
];

// Catégories officielles de l'interface de taille des gemmes (une par classe de départ)
export const GEM_CATEGORY_CLASS = {
  Masse: 'Warrior',
  'Bâton de combat': 'Monk',
  Arc: 'Ranger',
  Arbalète: 'Mercenary',
  Lance: 'Huntress',
  Élémentaire: 'Sorceress',
  Occulte: 'Witch',
  Primitif: 'Druid',
};
const WEAPON_CATEGORY = { Quarterstaff: 'Bâton de combat', Bow: 'Arc', Crossbow: 'Arbalète', Spear: 'Lance', Talisman: 'Primitif', 'One Hand Mace': 'Masse', 'Two Hand Mace': 'Masse' };
const WEAPON_FR = {
  Quarterstaff: 'Bâton de combat', 'One Hand Mace': 'Masse à une main', 'Two Hand Mace': 'Masse à deux mains', Bow: 'Arc', Crossbow: 'Arbalète',
  Spear: 'Lance', Talisman: 'Talisman', Staff: 'Bâton', Wand: 'Baguette', Sceptre: 'Sceptre', Claw: 'Griffe', Dagger: 'Dague', Flail: 'Fléau',
  'One Hand Sword': 'Épée à une main', 'Two Hand Sword': 'Épée à deux mains', 'One Hand Axe': 'Hache à une main', 'Two Hand Axe': 'Hache à deux mains',
  Shield: 'Bouclier', Buckler: 'Targe', Unarmed: 'Mains nues', 'Any Martial Weapon': "N'importe quelle arme martiale",
  'Any non-Talisman Martial Weapon': "N'importe quelle arme martiale (hors Talisman)",
};
export const weaponReqFr = (req) => (req ? req.split(/,\s*/).map((w) => WEAPON_FR[w] || w).join(', ') : null);

// Stubs pour exécuter les fichiers Skills/*.lua de PoB
const SKILL_PRELUDE = `
local function num(v) if type(v) == "number" then return math.tointeger(v) or 0 end return 0 end
bit = {
  bor = function(...) local r = 0 for _, v in ipairs({...}) do r = r | num(v) end return r end,
  band = function(a, ...) local r = num(a) for _, v in ipairs({...}) do r = r & num(v) end return r end,
  bxor = function(a, b) return num(a) ~ num(b) end,
  bnot = function(a) return ~num(a) end,
  lshift = function(a, n) return num(a) << num(n) end,
  rshift = function(a, n) return num(a) >> num(n) end,
}
local proxyMeta
proxyMeta = {
  __index = function(t, k) return setmetatable({}, proxyMeta) end,
  __call = function(...) return {} end,
}
SkillType = setmetatable({}, { __index = function(t, k) return "SkillType." .. tostring(k) end })
setmetatable(_G, { __index = function(t, k) return setmetatable({}, proxyMeta) end })
return nil
`;
const SKILL_CALL = `
local skills = {}
local function stub(...) return {} end
__ret(skills, stub, stub, stub)
return skills
`;

function loadPobSkills() {
  const dir = path.join(POB_DATA, 'Skills');
  const skills = {};
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.lua') || f === 'SkillAssets.lua') continue;
    const s = evalLuaFile(path.join(dir, f), { prelude: SKILL_PRELUDE, callWith: SKILL_CALL });
    for (const [id, sk] of Object.entries(s || {})) {
      const levels = sk.levels && typeof sk.levels === 'object' ? Object.values(sk.levels) : [];
      skills[id] = {
        name: sk.name,
        description: sk.description || null,
        icon: sk.icon || null,
        castTime: sk.castTime ?? null,
        support: !!sk.support,
        gemFamily: Array.isArray(sk.gemFamily) ? sk.gemFamily : [],
        hidden: !!sk.hidden,
        color: sk.color ?? null,
        skillTypes: Object.keys(sk.skillTypes || {}).map((k) => k.replace(/^SkillType\./, '')),
        requireSkillTypes: Object.values(sk.requireSkillTypes || {}).map((k) => String(k).replace(/^SkillType\./, '')),
        excludeSkillTypes: Object.values(sk.excludeSkillTypes || {}).map((k) => String(k).replace(/^SkillType\./, '')),
        maxLevel: levels.length,
        costLevel1: levels[0]?.cost || null,
        spiritLevel1: levels[0]?.spiritReservationFlat ?? levels[0]?.cost?.Spirit ?? null,
      };
    }
  }
  return skills;
}

async function loadPoe2dbGems(lang = 'fr') {
  const bySlug = {};
  const categories = {};
  for (const [page, kind] of PAGES) {
    let html;
    try {
      html = await fetchText(`${POE2DB}/${lang}/${page}`);
    } catch (e) {
      console.warn(`  ! poe2db ${lang}/${page} indisponible : ${e.message}`);
      continue;
    }
    const $ = cheerio.load(html);
    // Tableau « Gemcutting » : Arme | Palier | Gemmes  => catégorie officielle
    $('[id$="Gemcutting"] tr').each((_, tr) => {
      const td = $(tr).find('td');
      if (td.length < 3) return;
      const cat = textOf($, td[0]);
      $(td[2]).find('a[href]').each((__, a) => {
        const h = ($(a).attr('href') || '').replace(/^\/(fr|us)\//, '');
        if (h && !h.startsWith('http')) categories[h] = cat;
      });
    });
    $('a[data-hover*="GemEffects_hover"]').each((_, a) => {
      const href = $(a).attr('href') || '';
      const slug = href.replace(/^\/(fr|us)\//, '').replace(/^\//, '');
      if (!slug || slug.includes('/')) return;
      const entry = (bySlug[slug] ||= { slug, kinds: new Set() });
      entry.kinds.add(kind);
      entry.hover ||= $(a).attr('data-hover');
      const cls = ($(a).attr('class') || '').match(/gem_(red|green|blue|white)/);
      if (cls) entry.color ||= cls[1];
      const img = $(a).find('img').attr('src');
      if (img) entry.iconUrl ||= img;
      const txt = textOf($, a);
      if (txt && !img && !entry.name) {
        entry.name = txt;
        const tags = $(a).parent().find('.gem_tags a').map((_, t) => textOf($, t)).get();
        if (tags.length) entry.tags = tags;
      }
    });
  }
  return { bySlug, categories };
}

async function fetchGemPage(nameEn, lang = 'fr', slugIn = null) {
  const slug = slugIn || nameEn.replace(/['’]/g, '').replace(/,/g, '%2C').replace(/[: ]+/g, '_');
  try {
    const html = await fetchText(`${POE2DB}/${lang}/${slug}`);
    const $ = cheerio.load(html);
    const title = $('title').text().replace(/\s*-\s*PoE2DB.*$/, '').trim();
    const popup = $('.newItemPopup').first();
    return { slug, name: title || null, ...(popup.length ? parseHover($.html(popup)) : {}) };
  } catch {
    return null;
  }
}

function parseHover(html) {
  const $ = cheerio.load(html);
  const desc = $('.secDescrText').first();
  const descText = desc.length ? textOf($, desc) : null;
  const popup = $('.newItemPopup').first();
  const tooltipHtml = sanitizeTooltip(popup.length ? $.html(popup) : html);
  const tooltipText = htmlToText(tooltipHtml);
  return { description: descText && stripMarkup(descText), tooltipHtml: stripMarkup(tooltipHtml), tooltipText: stripMarkup(tooltipText) };
}

export async function buildGems() {
  const pobGems = evalLuaFile(path.join(POB_DATA, 'Gems.lua'));
  const skills = loadPobSkills();
  const { bySlug: fr, categories } = await loadPoe2dbGems();
  const frByKey = {};
  for (const e of Object.values(fr)) frByKey[slugKey(e.slug.replace(/_/g, ' '))] = e;
  const catByKey = {};
  for (const [slug, cat] of Object.entries(categories)) catByKey[slugKey(slug.replace(/_/g, ' '))] = cat;

  const out = [];
  let matched = 0;
  const entries = Object.entries(pobGems);
  for (const [gameId, g] of entries) {
    const sk = skills[g.grantedEffectId] || {};
    const f = frByKey[slugKey(g.name)] || frByKey[slugKey(g.baseTypeName)] || null;
    const isSupport = sk.support || /Support/.test(gameId);
    let kind = isSupport ? 'support' : 'skill';
    if (f?.kinds.has('lineage')) kind = 'lineage';
    else if (f?.kinds.has('spirit') && !isSupport) kind = 'spirit';
    else if (f?.kinds.has('meta') && !isSupport) kind = 'meta';
    const color = g.reqStr >= g.reqDex && g.reqStr >= g.reqInt && g.reqStr > 0 ? 'str'
      : g.reqDex >= g.reqInt && g.reqDex > 0 ? 'dex'
      : g.reqInt > 0 ? 'int' : 'none';
    const gem = {
      id: gameId,
      skillId: g.grantedEffectId,
      name: f?.name || g.name,
      nameEn: g.name,
      kind,
      gemType: g.gemType,
      tags: f?.tags || [],
      tagsEn: g.tagString ? g.tagString.split(/,\s*/) : [],
      color,
      req: { str: g.reqStr || 0, dex: g.reqDex || 0, int: g.reqInt || 0 },
      tier: g.Tier ?? null,
      maxLevel: g.naturalMaxLevel ?? 20,
      weaponRequirements: g.weaponRequirements || null,
      icon: sk.icon || null,
      iconUrl: f?.iconUrl || null,
      descriptionEn: sk.description || null,
      skillTypes: sk.skillTypes || [],
      // règles de compatibilité des soutiens (notation polonaise inverse de PoB : AND / OR / NOT)
      ...(isSupport ? { requireSkillTypes: sk.requireSkillTypes || [], excludeSkillTypes: sk.excludeSkillTypes || [], gemFamily: sk.gemFamily || [] } : {}),
      castTime: sk.castTime ?? null,
      slug: f?.slug || null,
      hoverUrl: f?.hover || null,
    };
    // Classe associée : catégorie officielle (taille des gemmes), sinon arme requise, sinon commune
    let category = catByKey[slugKey(g.name)] || catByKey[slugKey(g.baseTypeName)] || null;
    if (!category && !isSupport && g.weaponRequirements && WEAPON_CATEGORY[g.weaponRequirements.split(/,\s*/)[0]] && g.weaponRequirements.split(/,\s*/).every((w) => WEAPON_CATEGORY[w] === WEAPON_CATEGORY[g.weaponRequirements.split(/,\s*/)[0]])) {
      category = WEAPON_CATEGORY[g.weaponRequirements.split(/,\s*/)[0]];
    }
    gem.category = isSupport ? (kind === 'lineage' ? 'Lignage' : 'Soutien') : category || 'Autre';
    gem.classes = category && GEM_CATEGORY_CLASS[category] ? [GEM_CATEGORY_CLASS[category]] : ['common'];
    gem.officialCategory = !!(catByKey[slugKey(g.name)] || catByKey[slugKey(g.baseTypeName)]);
    if (f) matched++;
    out.push(gem);
  }

  // Infobulles FR (une requête par gemme, mises en cache)
  let done = 0;
  const withHover = out.filter((g) => g.hoverUrl);
  for (const g of withHover) {
    try {
      const html = await fetchText(g.hoverUrl, { referer: `${POE2DB}/fr/Skill_Gems` });
      Object.assign(g, parseHover(html));
    } catch (e) {
      console.warn(`  ! infobulle ${g.nameEn} : ${e.message}`);
    }
    done++;
    if (done % 100 === 0) console.log(`  infobulles gemmes : ${done}/${withHover.length}`);
    delete g.hoverUrl;
  }
  for (const g of out) delete g.hoverUrl;
  // Gemmes absentes des listes poe2db : on tente leur page individuelle (nom FR officiel + infobulle)
  for (const g of out.filter((x) => !x.tooltipHtml && !/\{0\}/.test(x.nameEn))) {
    const p = await fetchGemPage(g.nameEn);
    if (!p) continue;
    if (p.name && !/^PoE2DB/i.test(p.name)) g.name = p.name;
    if (p.tooltipHtml) Object.assign(g, { description: p.description, tooltipHtml: p.tooltipHtml, tooltipText: p.tooltipText });
    g.slug = p.slug;
  }
  // poe2db affiche « Objets enchâssables et empilables Delve » à la place de l'arme requise : on corrige
  for (const g of out) {
    const w = weaponReqFr(g.weaponRequirements);
    g.weaponRequirementsFr = w;
    for (const k of ['tooltipHtml', 'tooltipText']) {
      if (g[k]?.includes('Objets enchâssables et empilables Delve')) g[k] = g[k].replace(/Objets enchâssables et empilables Delve/g, w || 'Arme requise');
    }
  }
  // Infobulles anglaises officielles (bouton FR / EN de l'interface) : mêmes pages poe2db en /us/
  const { bySlug: en } = await loadPoe2dbGems('us');
  let doneEn = 0;
  for (const g of out) {
    const e = g.slug && en[g.slug];
    try {
      const p = e?.hover ? parseHover(await fetchText(e.hover, { referer: `${POE2DB}/us/Skill_Gems` })) : g.slug ? await fetchGemPage(g.nameEn, 'us', g.slug) : null;
      if (p?.tooltipHtml) {
        g.tooltipHtmlEn = p.tooltipHtml;
        if (p.description && !g.descriptionEn) g.descriptionEn = p.description;
        if (e?.tags?.length) g.tagsEn = e.tags;
      }
    } catch (err) {
      console.warn(`  ! infobulle EN ${g.nameEn} : ${err.message}`);
    }
    doneEn++;
    if (doneEn % 100 === 0) console.log(`  infobulles gemmes (anglais) : ${doneEn}/${out.length}`);
  }
  for (const g of out) {
    if (g.tooltipHtmlEn?.includes('Delve Socketable')) g.tooltipHtmlEn = g.tooltipHtmlEn.replace(/Delve Socketable[^<]*/g, g.weaponRequirements || 'Weapon');
  }
  for (const g of out) if (/\{0\}/.test(g.name)) g.name = g.name.replace(/^Companion:/, 'Compagnon :').replace(/^Spectre:/, 'Spectre :');
  console.log(`  ${out.length} gemmes (${matched} avec traduction FR)`);
  out.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  return out;
}
