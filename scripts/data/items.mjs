// Construit data/items.json : objets de base + uniques (FR via poe2db, EN via PoB).
import fs from 'node:fs';
import path from 'node:path';
import { POB_DATA } from '../lib/paths.mjs';
import { evalLuaFile } from '../lib/lua.mjs';
import { fetchText } from '../lib/http.mjs';
import { cheerio, textOf, slugKey } from '../lib/html.mjs';

const POE2DB = 'https://poe2db.tw';

// page poe2db -> [classe d'objet, libellé FR, emplacements possibles]
export const ITEM_CLASSES = {
  Helmets: ['Helmet', 'Casque', ['Helmet']],
  Body_Armours: ['Body Armour', 'Armure de torse', ['Body Armour']],
  Gloves: ['Gloves', 'Gants', ['Gloves']],
  Boots: ['Boots', 'Bottes', ['Boots']],
  Belts: ['Belt', 'Ceinture', ['Belt']],
  Amulets: ['Amulet', 'Amulette', ['Amulet']],
  Rings: ['Ring', 'Anneau', ['Ring 1', 'Ring 2']],
  Shields: ['Shield', 'Bouclier', ['Weapon 2']],
  Bucklers: ['Buckler', 'Targe', ['Weapon 2']],
  Foci: ['Focus', 'Focaliseur', ['Weapon 2']],
  Quivers: ['Quiver', 'Carquois', ['Weapon 2']],
  Bows: ['Bow', 'Arc', ['Weapon 1']],
  Crossbows: ['Crossbow', 'Arbalète', ['Weapon 1']],
  Claws: ['Claw', 'Griffe', ['Weapon 1', 'Weapon 2']],
  Daggers: ['Dagger', 'Dague', ['Weapon 1', 'Weapon 2']],
  Flails: ['Flail', 'Fléau', ['Weapon 1', 'Weapon 2']],
  One_Hand_Axes: ['One Hand Axe', 'Hache à une main', ['Weapon 1', 'Weapon 2']],
  One_Hand_Maces: ['One Hand Mace', 'Masse à une main', ['Weapon 1', 'Weapon 2']],
  One_Hand_Swords: ['One Hand Sword', 'Épée à une main', ['Weapon 1', 'Weapon 2']],
  Spears: ['Spear', 'Lance', ['Weapon 1', 'Weapon 2']],
  Wands: ['Wand', 'Baguette', ['Weapon 1', 'Weapon 2']],
  Sceptres: ['Sceptre', 'Sceptre', ['Weapon 1', 'Weapon 2']],
  Quarterstaves: ['Quarterstaff', 'Bâton de combat', ['Weapon 1']],
  Staves: ['Staff', 'Bâton', ['Weapon 1']],
  Talismans: ['Talisman', 'Talisman', ['Weapon 1']],
  Traps: ['Trap', 'Piège', ['Weapon 1']],
  Two_Hand_Axes: ['Two Hand Axe', 'Hache à deux mains', ['Weapon 1']],
  Two_Hand_Maces: ['Two Hand Mace', 'Masse à deux mains', ['Weapon 1']],
  Two_Hand_Swords: ['Two Hand Sword', 'Épée à deux mains', ['Weapon 1']],
  Life_Flasks: ['Life Flask', 'Flacon de Vie', ['Flask 1']],
  Mana_Flasks: ['Mana Flask', 'Flacon de Mana', ['Flask 2']],
  Charms: ['Charm', 'Charme', ['Charm 1', 'Charm 2', 'Charm 3']],
  Jewels: ['Jewel', 'Joyau', ['Jewel']],
};

function loadPobBases() {
  const dir = path.join(POB_DATA, 'Bases');
  const bases = {};
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.lua')) continue;
    const res = evalLuaFile(path.join(dir, f), {
      callWith: 'local t = {}; __ret(t); return t',
    });
    Object.assign(bases, res || {});
  }
  return bases;
}

function loadPobUniques() {
  const dir = path.join(POB_DATA, 'Uniques');
  const uniques = {};
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.lua')) continue;
    let res;
    try {
      res = evalLuaFile(path.join(dir, f));
    } catch {
      continue;
    }
    for (const raw of Array.isArray(res) ? res : Object.values(res || {})) {
      if (typeof raw !== 'string') continue;
      const lines = raw.trim().split(/\r?\n/);
      const name = lines[0]?.trim();
      if (!name) continue;
      uniques[slugKey(name)] ||= { nameEn: name, baseEn: lines[1]?.trim(), textEn: raw.trim() };
    }
  }
  return uniques;
}

// Les implicites « cachés » de certaines bases (ex. Bâton de combat fulminant) arrivent en texte brut :
// on les réécrit en français lisible.
function cleanImplicit(line, lang = 'fr') {
  const out = [];
  const min = line.match(/added minimum (\w+) damage \[(\d+)\]/);
  const max = line.match(/added maximum (\w+) damage \[(\d+)\]/);
  const en = lang !== 'fr';
  const TYPE = en ? { lightning: 'Lightning', fire: 'Fire', cold: 'Cold', physical: 'Physical', chaos: 'Chaos' } : { lightning: 'Foudre', fire: 'Feu', cold: 'Froid', physical: 'Physiques', chaos: 'Chaos' };
  if (min && max) out.push(en ? `Adds ${min[2]} to ${max[2]} ${TYPE[max[1]] || max[1]} Damage (base)` : `Ajoute ${min[2]} à ${max[2]} Dégâts de ${TYPE[max[1]] || max[1]} (base)`);
  const conv = [...line.matchAll(/% base damage is (\w+) \[(\d+)\]/g)];
  if (conv.length) out.push(`${en ? 'Base damage' : 'Dégâts de base'} : ${conv.map((m) => `${m[2]} % ${TYPE[m[1]] || m[1]}`).join(', ')}`);
  if (!out.length && /hidden|\[\d+\]/.test(line)) return [];
  return out.length ? out : [line];
}

function parseCard($, col, lang = 'fr') {
  const lines = (sel) => $(col).find(sel).map((_, el) => textOf($, el)).get().filter(Boolean).flatMap((l) => cleanImplicit(l, lang));
  return {
    properties: lines('.property'),
    requirements: lines('.requirements').map((r) => r.replace(/^(Prérequis|Requires)\s*:?\s*/i, '')),
    implicits: lines('.implicitMod'),
    explicits: lines('.explicitMod'),
  };
}

export async function buildItems() {
  const pobBases = loadPobBases();
  const pobBaseByKey = {};
  for (const [name, b] of Object.entries(pobBases)) pobBaseByKey[slugKey(name)] = { name, ...b };
  const pobUniques = loadPobUniques();

  const bases = [];
  const uniques = [];
  const seenBase = new Set();
  const seenUnique = new Set();
  for (const [page, [itemClass, classFr, slots]] of Object.entries(ITEM_CLASSES)) {
    let html;
    try {
      html = await fetchText(`${POE2DB}/fr/${page}`);
    } catch (e) {
      console.warn(`  ! poe2db ${page} indisponible : ${e.message}`);
      continue;
    }
    const $ = cheerio.load(html);
    $('div.col').each((_, col) => {
      const uniqA = $(col).find('a.UniqueItem[href^="/fr/"]').first();
      if (uniqA.length) {
        const slug = uniqA.attr('href').replace('/fr/', '');
        if (seenUnique.has(slug)) return;
        seenUnique.add(slug);
        const en = pobUniques[slugKey(slug.replace(/_/g, ' '))] || null;
        uniques.push({
          id: slug,
          name: textOf($, uniqA.find('.uniqueName')),
          base: textOf($, uniqA.find('.uniqueTypeLine')),
          nameEn: en?.nameEn || slug.replace(/_/g, ' '),
          baseEn: en?.baseEn || null,
          itemClass,
          classFr,
          slots,
          iconUrl: $(col).find('img').first().attr('src') || null,
          ...parseCard($, col),
          textEn: en?.textEn || null,
        });
        return;
      }
      const baseA = $(col).find('a[data-hover*="BaseItemTypes_hover"]').last();
      if (baseA.length) {
        const slug = (baseA.attr('href') || '').replace(/^\/fr\//, '');
        if (!slug || seenBase.has(slug)) return;
        seenBase.add(slug);
        const en = pobBaseByKey[slugKey(slug.replace(/_/g, ' '))] || null;
        const card = parseCard($, col);
        bases.push({
          id: slug,
          name: textOf($, baseA),
          nameEn: en?.name || slug.replace(/_/g, ' '),
          itemClass,
          classFr,
          slots,
          iconUrl: $(col).find('img').first().attr('src') || null,
          properties: card.properties,
          requirements: card.requirements,
          implicits: card.implicits,
          pob: en
            ? {
                type: en.type,
                subType: en.subType || null,
                armour: en.armour || null,
                weapon: en.weapon || null,
                req: en.req || null,
                implicit: en.implicit || null,
                tags: Object.keys(en.tags || {}),
              }
            : null,
        });
      }
    });
  }
  // Textes anglais officiels (bouton FR / EN de l'interface) : mêmes pages poe2db en /us/
  const uById = new Map(uniques.map((u) => [u.id, u]));
  const bById = new Map(bases.map((b) => [b.id, b]));
  let nEn = 0;
  for (const page of Object.keys(ITEM_CLASSES)) {
    let html;
    try {
      html = await fetchText(`${POE2DB}/us/${page}`);
    } catch (e) {
      console.warn(`  ! poe2db us/${page} indisponible : ${e.message}`);
      continue;
    }
    const $ = cheerio.load(html);
    $('div.col').each((_, col) => {
      const uniqA = $(col).find('a.UniqueItem[href^="/us/"]').first();
      if (uniqA.length) {
        const u = uById.get(uniqA.attr('href').replace('/us/', ''));
        if (!u || u.explicitsEn) return;
        const c = parseCard($, col, 'en');
        Object.assign(u, {
          nameEn: textOf($, uniqA.find('.uniqueName')) || u.nameEn,
          baseEn: textOf($, uniqA.find('.uniqueTypeLine')) || u.baseEn,
          propertiesEn: c.properties,
          requirementsEn: c.requirements,
          implicitsEn: c.implicits,
          explicitsEn: c.explicits,
        });
        nEn++;
        return;
      }
      const baseA = $(col).find('a[data-hover*="BaseItemTypes_hover"]').last();
      if (baseA.length) {
        const b = bById.get((baseA.attr('href') || '').replace(/^\/us\//, ''));
        if (!b || b.propertiesEn) return;
        const c = parseCard($, col, 'en');
        Object.assign(b, { nameEn: textOf($, baseA) || b.nameEn, propertiesEn: c.properties, requirementsEn: c.requirements, implicitsEn: c.implicits });
        nEn++;
      }
    });
  }
  console.log(`  ${bases.length} objets de base, ${uniques.length} uniques (${nEn} avec texte anglais officiel)`);
  bases.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  uniques.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  return { classes: ITEM_CLASSES, bases, uniques };
}
