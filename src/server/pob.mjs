// Import / export au format Path of Building PoE2 (codes de partage, liens pobb.in / poe.ninja).
import zlib from 'node:zlib';
import { XMLParser } from 'fast-xml-parser';
import { createBuild, normalizeBuild, SLOT_IDS, newId } from '../core/build-model.mjs';
import { parseItemText, itemToPobText, translateLines } from '../core/items-text.mjs';
import { norm } from './data.mjs';

export function decodePobCode(code) {
  const clean = String(code).trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const buf = Buffer.from(clean, 'base64');
  try {
    return zlib.inflateSync(buf).toString('utf8');
  } catch {
    return zlib.inflateRawSync(buf).toString('utf8');
  }
}

export function encodePobCode(xml) {
  return zlib.deflateSync(Buffer.from(xml, 'utf8'), { level: 9 }).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
}

/** Récupère un code PoB depuis un lien de partage (pobb.in, poe.ninja, pastebin) */
export async function resolvePobInput(input) {
  const s = String(input).trim();
  let url = null;
  let m;
  if ((m = s.match(/^https?:\/\/pobb\.in\/(?:u\/[^/]+\/)?([\w-]+)/i))) url = `https://pobb.in/${m[1]}/raw`;
  else if ((m = s.match(/^https?:\/\/poe\.ninja\/(?:poe2\/)?pob\/(?:raw\/)?([\w-]+)/i))) url = `https://poe.ninja/poe2/pob/raw/${m[1]}`;
  else if ((m = s.match(/^https?:\/\/pastebin\.com\/(?:raw\/)?(\w+)/i))) url = `https://pastebin.com/raw/${m[1]}`;
  else if (/^https?:\/\//i.test(s)) throw new Error('Lien non reconnu (pobb.in, poe.ninja ou pastebin attendus).');
  if (!url) return s;
  const res = await fetch(url, { headers: { 'User-Agent': 'aide-build-poe2/0.1' } });
  if (!res.ok) throw new Error(`Impossible de récupérer ${url} (HTTP ${res.status})`);
  return (await res.text()).trim();
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: '#text',
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: false,
  isArray: (name) => ['Spec', 'SkillSet', 'Skill', 'Gem', 'Item', 'ItemSet', 'Slot', 'AttributeOverride'].includes(name),
});

function asText(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  return v['#text'] ?? '';
}

export function pobXmlToBuild(xml, data, { name } = {}) {
  const doc = parser.parse(xml);
  const root = doc.PathOfBuilding2 || doc.PathOfBuilding;
  if (!root) throw new Error('Code PoB invalide (élément racine absent).');
  const { graph } = data;
  const b = createBuild({ name: name || 'Build importé' });
  const warnings = [];

  const B = root.Build || {};
  b.level = Number(B.level) || 1;

  // --- Arbre
  const treeEl = root.Tree || {};
  const specs = treeEl.Spec || [];
  const spec = specs[(Number(treeEl.activeSpec) || 1) - 1] || specs[0] || {};
  let cls = graph.classes.find((c) => c.integerId === Number(spec.classInternalId)) || graph.classes.find((c) => c.id === B.className);
  if (!cls) {
    warnings.push(`Classe inconnue (${B.className}), Guerrier utilisée par défaut.`);
    cls = graph.classes.find((c) => c.id === 'Warrior') || graph.classes[0];
  }
  b.class = cls.id;
  const asc = cls.ascendancies.find((a) => a.internalId === spec.ascendancyInternalId) || cls.ascendancies.find((a) => a.id === B.ascendClassName);
  b.ascendancy = asc ? asc.id : null;
  if (spec.title) b.name = name || spec.title;
  const ids = String(spec.nodes || '').split(',').map(Number).filter(Boolean);
  b.tree.nodes = ids.filter((id) => graph.isAllocatable(graph.node(id), b));
  const ov = spec.Overrides?.AttributeOverride?.[0];
  if (ov) {
    for (const [k, attr] of [['strNodes', 'Strength'], ['dexNodes', 'Dexterity'], ['intNodes', 'Intelligence']]) {
      for (const id of String(ov[k] || '').split(',').map(Number).filter(Boolean)) b.tree.attributes[id] = attr;
    }
  }
  for (const k of ['WeaponSet1', 'WeaponSet2']) {
    if (spec[k]?.nodes) b.tree[k.charAt(0).toLowerCase() + k.slice(1)] = String(spec[k].nodes).split(',').map(Number).filter(Boolean);
  }
  const { dropped } = graph.sanitize(b);
  if (dropped.length) warnings.push(`${dropped.length} nœud(s) de l'arbre non reconnus ou déconnectés ont été ignorés (version d'arbre différente ?).`);
  if (spec.treeVersion && spec.treeVersion !== graph.tree.version) warnings.push(`Arbre exporté en version ${spec.treeVersion}, outil en version ${graph.tree.version}.`);

  // --- Gemmes
  const skillsEl = root.Skills || {};
  const sets = skillsEl.SkillSet || [];
  const set = sets.find((s) => String(s.id) === String(skillsEl.activeSkillSet)) || sets[0];
  const skillList = set ? set.Skill || [] : skillsEl.Skill || [];
  for (const s of skillList) {
    const gems = [];
    for (const g of s.Gem || []) {
      const gd = data.gemsById.get(g.gemId) || data.gemsBySkillId.get(g.skillId) || data.gemsByName.get(norm(g.nameSpec));
      if (!gd) {
        warnings.push(`Gemme inconnue ignorée : ${g.nameSpec || g.gemId}`);
        continue;
      }
      gems.push({ gemId: gd.id, level: Number(g.level) || 20, quality: Number(g.quality) || 0, enabled: g.enabled !== 'false' });
    }
    if (!gems.length) continue;
    b.skills.push({ id: newId(), label: s.label || (s.source ? `Conféré par un objet` : ''), enabled: s.enabled !== 'false', gems });
  }

  // --- Objets
  const itemsEl = root.Items || {};
  const itemById = {};
  for (const it of itemsEl.Item || []) itemById[it.id] = it;
  const itemSets = itemsEl.ItemSet || [];
  const iset = itemSets.find((s) => String(s.id) === String(itemsEl.activeItemSet)) || itemSets[0];
  for (const slot of iset?.Slot || []) {
    if (!SLOT_IDS.includes(slot.name) || !Number(slot.itemId)) continue;
    const raw = itemById[slot.itemId];
    if (!raw) continue;
    b.items[slot.name] = itemFromText(asText(raw), data, { variant: raw.variant });
  }
  b.notes = asText(root.Notes).trim();
  return { build: normalizeBuild(b), warnings };
}

/** Construit un objet de notre modèle à partir d'un texte (PoB ou jeu) */
export function itemFromText(text, data, opts = {}) {
  const p = parseItemText(text, opts);
  const item = { rarity: p.rarity, nameEn: p.name, baseEn: p.base, implicits: p.implicits, explicits: p.explicits, quality: p.quality, corrupted: p.corrupted };
  const u = p.rarity === 'UNIQUE' ? data.uniquesByName.get(norm(p.name)) : null;
  const base = data.basesByName.get(norm(p.base)) || (u && data.basesByName.get(norm(u.base)));
  item.name = u ? u.name : p.rarity === 'RARE' ? p.name : base?.name || p.name;
  item.base = base?.name || u?.base || p.base;
  if (u) {
    item.uniqueId = u.id;
    item.iconUrl = u.iconUrl;
  } else if (base) {
    item.baseId = base.id;
    item.iconUrl = base.iconUrl;
  }
  item.implicitsFr = translateLines(p.implicits, data.translations);
  item.explicitsFr = translateLines(p.explicits, data.translations);
  return item;
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function buildToPobXml(build, data) {
  const { graph } = data;
  const cls = graph.classById[build.class];
  const asc = build.ascendancy ? graph.ascById[build.ascendancy] : null;
  const ascIndex = asc ? cls.ascendancies.findIndex((a) => a.id === asc.id) + 1 : 0;
  const nodes = [...graph.startNodes(build), ...build.tree.nodes];
  const attrs = { Strength: [], Dexterity: [], Intelligence: [] };
  for (const [id, a] of Object.entries(build.tree.attributes || {})) if (attrs[a] && build.tree.nodes.includes(Number(id))) attrs[a].push(id);

  const out = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>');
  out.push('<PathOfBuilding2>');
  out.push(`  <Build level="${build.level}" targetVersion="0_1" className="${esc(cls?.id)}" ascendClassName="${esc(asc?.id || 'None')}" mainSocketGroup="1" viewMode="TREE" characterLevelAutoMode="false"/>`);
  out.push(`  <Tree activeSpec="1">`);
  out.push(`    <Spec title="${esc(build.name)}" treeVersion="${graph.tree.version}" classId="${graph.classes.indexOf(cls)}" ascendClassId="${ascIndex}" classInternalId="${cls?.integerId ?? 0}" ascendancyInternalId="${esc(asc?.internalId || '')}" secondaryAscendClassId="0" nodes="${nodes.join(',')}" masteryEffects="">`);
  if (build.tree.weaponSet1?.length) out.push(`      <WeaponSet1 nodes="${build.tree.weaponSet1.join(',')}"/>`);
  if (build.tree.weaponSet2?.length) out.push(`      <WeaponSet2 nodes="${build.tree.weaponSet2.join(',')}"/>`);
  out.push('      <Sockets/>');
  out.push(`      <Overrides><AttributeOverride strNodes="${attrs.Strength.join(',')}" dexNodes="${attrs.Dexterity.join(',')}" intNodes="${attrs.Intelligence.join(',')}"/></Overrides>`);
  out.push('    </Spec>');
  out.push('  </Tree>');
  out.push('  <Skills activeSkillSet="1" defaultGemLevel="normalMaximum" defaultGemQuality="0">');
  out.push('    <SkillSet id="1">');
  for (const s of build.skills) {
    out.push(`      <Skill enabled="${s.enabled !== false}" includeInFullDPS="false" label="${esc(s.label || '')}" mainActiveSkill="1" mainActiveSkillCalcs="1">`);
    for (const g of s.gems) {
      const gd = data.gemsById.get(g.gemId);
      if (!gd) continue;
      out.push(`        <Gem nameSpec="${esc(gd.nameEn)}" skillId="${esc(gd.skillId)}" gemId="${esc(gd.id)}" level="${g.level ?? 20}" quality="${g.quality ?? 0}" enabled="${g.enabled !== false}" count="1"/>`);
    }
    out.push('      </Skill>');
  }
  out.push('    </SkillSet>');
  out.push('  </Skills>');
  out.push('  <Items activeItemSet="1">');
  const slots = [];
  let n = 1;
  for (const slot of SLOT_IDS) {
    const it = build.items[slot];
    if (!it) continue;
    out.push(`    <Item id="${n}">${esc(itemToPobText(it))}</Item>`);
    slots.push(`      <Slot name="${esc(slot)}" itemId="${n}"/>`);
    n++;
  }
  out.push('    <ItemSet id="1" useSecondWeaponSet="false">');
  out.push(...slots);
  out.push('    </ItemSet>');
  out.push('  </Items>');
  out.push(`  <Notes>${esc(build.notes || '')}</Notes>`);
  out.push('</PathOfBuilding2>');
  return out.join('\n');
}
