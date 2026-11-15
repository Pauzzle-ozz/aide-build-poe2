// Dernière passe sur les données : tout ce qui est encore en anglais est traduit.
//  1) modèles officiels (site d'échange FR + paires de l'arbre)  -> traduction officielle
//  2) dictionnaire manuel scripts/data/traductions-manuelles.json -> traduction non officielle (marquée)
//  3) lignes techniques internes (ex. « stone skin duration ms 0 ») retirées de l'affichage
// Produit aussi scripts/data/a-traduire.json : ce qui reste à traduire à la main.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, ROOT } from '../lib/paths.mjs';
import { translateLine } from '../../src/core/items-text.mjs';

const MANUAL_FILE = path.join(ROOT, 'scripts', 'data', 'traductions-manuelles.json');
const TODO_FILE = path.join(ROOT, 'scripts', 'data', 'a-traduire.json');

const EN = /\b(the|you|your|with|increased|reduced|damage|skills?|gain|gains|have|has|when|while|enemies|enemy|chance|per|from|are|is|can|grants?|maximum|recently|of|to|and|on|for|more|less|take|taken|deal|deals)\b/i;
const FR = /\b(de|des|du|le|la|les|vous|votre|vos|avec|à|et|un|une|sur|pour|en|est|sont|lorsque|tant|aux|au)\b|[dl]'/i;
const ACCENTS = /[éèêëàâùûçôîïœ]/i;
const EN_WORDS = /\b(the|you|your|with|increased|reduced|damage|skills?|gain|gains|have|has|when|while|enemies|enemy|chance|per|from|are|is|can|grants?|recently|of|to|and|on|more|less|take|taken|deal|deals|an|as|if|by|at|each)\b/gi;
/** Ligne en anglais : au moins deux mots-outils anglais, aucun mot ni accent français */
export const looksEnglish = (s) => !FR.test(s) && !ACCENTS.test(s) && (s.match(EN_WORDS) || []).length >= 2;
/** Ligne technique interne (identifiant de stat brut, sans majuscule ni français) */
export const isInternal = (s) =>
  /^DNT/.test(s) ||
  (!/[A-ZÀ-Ý]/.test(s) && /[a-z]/.test(s) && !FR.test(s) && !ACCENTS.test(s) &&
    (/_/.test(s) || (/\d/.test(s) && /^[a-z0-9 %+\-[\].,]+$/.test(s))));

// Propriétés d'objets restées en anglais chez poe2db
const PROPS = [
  [/^Base Movement Speed:\s*(.*)$/, (v) => `Vitesse de déplacement de base : ${v}`],
  [/^Throw Time:\s*(.*)$/, (v) => `Temps de lancer : ${v.replace(/Sec$/, 's')}`],
  [/^Detonation Type:\s*Manual$/, () => 'Type de détonation : manuelle'],
  [/^Detonation Type:\s*Automatic$/, () => 'Type de détonation : automatique'],
  [/^Detonation Type:\s*(.*)$/, (v) => `Type de détonation : ${v}`],
];
const TOOLTIP_WORDS = [
  [/\bUnarmed\b/g, 'Mains nues'],
  [/Reservation:/g, 'Réservation :'],
];

const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export function francise() {
  const tree = readJson(path.join(DATA_DIR, 'tree.json'), null);
  const gems = readJson(path.join(DATA_DIR, 'gems.json'), []);
  const items = readJson(path.join(DATA_DIR, 'items.json'), null);
  const translations = readJson(path.join(DATA_DIR, 'translations.json'), {});
  const manual = readJson(MANUAL_FILE, { noms: {}, textes: {}, internes: {} });
  manual.noms ||= {};
  manual.textes ||= {};
  manual.internes ||= {};
  const todo = { noms: {}, textes: {}, internes: {} };
  const stats = { officiel: 0, manuel: 0, retire: 0, reste: 0 };

  /** Traduit une ligne ; renvoie { text, unofficial } ou null pour la masquer */
  // « Octroie l'Aptitude: Hollow Form » : le nom de l'aptitude reste en anglais chez poe2db
  const gemFrByEn = new Map(gems.map((g) => [g.nameEn.toLowerCase(), g.name]));
  const fixGrant = (s) =>
    s.replace(/^(Octroie l'Aptitude\s*:\s*)(Niveau \d+ )?(.+)$/, (m, p, lvl, n) => {
      const key = n.trim();
      const fr = gemFrByEn.get(key.toLowerCase()) || (manual.noms[key] && manual.noms[key] !== key ? manual.noms[key] : null);
      return fr ? `Octroie l'Aptitude : ${lvl || ''}${fr}` : m;
    });
  const notFrench = (s) => !FR.test(s) && !ACCENTS.test(s);
  const line = (s0, ctx) => {
    const s = fixGrant(s0);
    if (s in manual.internes) {
      stats.manuel++;
      return manual.internes[s] ? { text: manual.internes[s], unofficial: true } : null;
    }
    if (manual.textes[s]) {
      stats.manuel++;
      return { text: manual.textes[s], unofficial: true };
    }
    if (isInternal(s)) {
      todo.internes[s] = ctx;
      stats.retire++;
      return null;
    }
    if (!notFrench(s)) return { text: s };
    const off = translateLine(s, translations);
    // l'API FR renvoie parfois le texte anglais (pas encore traduit par GGG) : ce n'est pas une traduction
    if (off && off !== s && !looksEnglish(off)) {
      stats.officiel++;
      return { text: off };
    }
    if ((s.match(EN_WORDS) || []).length >= 1 && /[a-z]{3,}/.test(s)) {
      todo.textes[s] = ctx;
      stats.reste++;
    }
    return { text: s };
  };
  // Noms officiels : le site d'échange liste « Allocates <notable> » -> « Attribue <nom FR> »
  const CORRECTIONS = { 'Orange cérébral': 'Orage cérébral' }; // coquille de la traduction officielle
  const officialName = (s) => {
    const v = translations[`allocates ${s.toLowerCase()}`];
    if (!v || !/^Attribue /.test(v)) return null;
    const fr = v.replace(/^Attribue\s+/, '').trim();
    return CORRECTIONS[fr] || fr;
  };
  const name = (s, ctx) => {
    const off = officialName(s);
    if (off && off.toLowerCase() !== s.toLowerCase()) {
      stats.officiel++;
      return { text: off };
    }
    if (manual.noms[s] === s) return { text: s }; // nom propre identique en français
    if (manual.noms[s]) {
      stats.manuel++;
      return { text: manual.noms[s], unofficial: true };
    }
    todo.noms[s] = ctx;
    return { text: s };
  };
  const mapLines = (lines, ctx, target) => {
    const out = [];
    for (const s of lines || []) {
      // certaines lignes poe2db regroupent deux effets
      for (const part of String(s).split('\n')) {
        const r = line(part, ctx);
        if (!r) continue;
        if (r.unofficial) target.unofficial = true;
        out.push(r.text);
      }
    }
    return out;
  };

  // ---------- Arbre passif
  for (const n of Object.values(tree.nodes)) {
    if (n.type === 'image') continue;
    const ctx = `passif ${n.id}${n.ascendancy ? ` (${n.ascendancy})` : ''} « ${n.nameEn} »`;
    n.stats = mapLines(n.stats, ctx, n);
    if (n.name === n.nameEn && n.type !== 'normal' && n.type !== 'classStart' && /[a-z]/.test(n.name)) {
      const r = name(n.nameEn, ctx);
      if (r.unofficial) n.unofficial = true;
      n.name = r.text;
    }
    for (const o of n.options || []) o.stats = mapLines(o.stats, ctx, o);
    if (n.flavour && looksEnglish(n.flavour)) {
      if (manual.textes[n.flavour]) {
        n.flavour = manual.textes[n.flavour];
        n.unofficial = true;
      } else todo.textes[n.flavour] = `${ctx} (texte d'ambiance)`;
    }
  }

  // ---------- Gemmes : aptitudes conférées par une ascendance -> classe correspondante
  const ascClass = {};
  const ascName = {};
  for (const c of tree.classes) {
    for (const a of c.ascendancies) {
      ascClass[a.id] = c.id;
      ascName[a.id] = a.name;
    }
  }
  const grantedBy = {};
  for (const n of Object.values(tree.nodes)) {
    for (const s of n.statsEn || []) {
      const m = s.match(/^Grants Skill:\s*(.+)$/);
      if (m && n.ascendancy) grantedBy[m[1].trim().toLowerCase()] = n.ascendancy;
    }
  }
  const itemGranted = new Set();
  for (const u of items?.uniques || []) {
    for (const m of (u.textEn || '').matchAll(/Grants Skill: (?:Level \d+ )?([^\n{]+)/g)) itemGranted.add(m[1].trim().toLowerCase());
  }
  for (const g of gems) {
    const ctx = `gemme « ${g.nameEn} »`;
    if (g.category === 'Autre') {
      const asc = grantedBy[g.nameEn.toLowerCase()];
      if (asc && ascClass[asc]) {
        g.category = `Ascendance : ${ascName[asc]}`;
        g.classes = [ascClass[asc]];
        g.grantedBy = asc;
      } else if (itemGranted.has(g.nameEn.toLowerCase())) {
        g.category = 'Conférée par un objet';
      }
    }
    if (g.name === g.nameEn && !g.tooltipHtml && !/\{0\}/.test(g.name)) {
      const r = name(g.nameEn, ctx);
      if (r.unofficial) g.unofficial = true;
      g.name = r.text;
    }
    if (!g.description && g.descriptionEn) {
      if (manual.textes[g.descriptionEn]) {
        g.description = manual.textes[g.descriptionEn];
        g.unofficial = true;
      } else todo.textes[g.descriptionEn] = `${ctx} (description)`;
    }
    for (const [re, fr] of TOOLTIP_WORDS) {
      if (g.tooltipHtml) g.tooltipHtml = g.tooltipHtml.replace(re, fr);
      if (g.tooltipText) g.tooltipText = g.tooltipText.replace(re, fr);
    }
    // lignes de l'infobulle : techniques -> retirées ; anglaises -> traduites
    if (g.tooltipText) {
      const kept = [];
      for (const l of g.tooltipText.split('\n')) {
        if (l === g.nameEn) {
          kept.push(l);
          continue;
        }
        let fr = l;
        let drop = false;
        if (isInternal(l)) {
          if (manual.internes[l]) fr = manual.internes[l];
          else {
            drop = true;
            if (!(l in manual.internes)) todo.internes[l] = `${ctx} (infobulle)`;
          }
        } else if (manual.textes[l]) {
          fr = manual.textes[l];
          g.unofficial = true;
        } else if (notFrench(l)) {
          const off = translateLine(l, translations);
          fr = off && off !== l && !looksEnglish(off) ? off : l;
          if (fr === l && looksEnglish(l)) todo.textes[l] = `${ctx} (infobulle)`;
        }
        if (g.tooltipHtml && (drop || fr !== l)) {
          const re = new RegExp(`<div class="[^"]*">${escRe(escHtml(l))}</div>`, 'g');
          if (!drop) g.tooltipHtml = g.tooltipHtml.split(`>${escHtml(l)}<`).join(`>${escHtml(fr)}<`);
          g.tooltipHtml = g.tooltipHtml.replace(re, drop ? '' : (m) => m.replace(escHtml(l), escHtml(fr)));
        }
        if (!drop) kept.push(fr);
      }
      g.tooltipText = kept.join('\n');
    }
  }

  // ---------- Objets
  if (items) {
    for (const u of items.uniques) {
      const ctx = `unique « ${u.nameEn} »`;
      u.implicits = mapLines(u.implicits, ctx, u);
      u.explicits = mapLines(u.explicits, ctx, u);
      if (u.name === u.nameEn) {
        const r = name(u.nameEn, ctx);
        if (r.unofficial) u.unofficialName = true;
        u.name = r.text;
      }
    }
    for (const b of items.bases) {
      b.properties = b.properties.map((p) => {
        for (const [re, fn] of PROPS) {
          const m = p.match(re);
          if (m) return fn(m[1]);
        }
        return p;
      });
      b.implicits = mapLines(b.implicits, `base « ${b.nameEn} »`, b);
    }
  }

  fs.writeFileSync(path.join(DATA_DIR, 'tree.json'), JSON.stringify(tree));
  fs.writeFileSync(path.join(DATA_DIR, 'gems.json'), JSON.stringify(gems));
  if (items) fs.writeFileSync(path.join(DATA_DIR, 'items.json'), JSON.stringify(items));
  fs.writeFileSync(TODO_FILE, JSON.stringify(todo, null, 1));
  console.log(
    `  traductions : ${stats.officiel} officielles (site d'échange), ${stats.manuel} manuelles, ${stats.retire} lignes techniques masquées, ` +
      `${Object.keys(todo.noms).length} noms et ${Object.keys(todo.textes).length} textes encore en anglais (voir scripts/data/a-traduire.json)`,
  );
}
