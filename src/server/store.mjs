// Stockage des builds sur disque (builds/*.json) + build actif + bac à sable + notifications.
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { ROOT } from './data.mjs';
import { createBuild, normalizeBuild, newId, diffBuilds } from '../core/build-model.mjs';

export const BUILDS_DIR = path.join(ROOT, 'builds');
const STATE_FILE = path.join(BUILDS_DIR, '_etat.json');

// Le bac à sable est un espace libre : il n'apparaît pas dans la liste des builds
// (fichier préfixé par « _ ») et ne modifie jamais un build enregistré.
export const SANDBOX_ID = 'bac-a-sable';
const SANDBOX_FILE = path.join(BUILDS_DIR, '_bac-a-sable.json');

export class BuildStore extends EventEmitter {
  constructor(data) {
    super();
    this.data = data;
    fs.mkdirSync(BUILDS_DIR, { recursive: true });
    this.state = { activeBuildId: null, lastBuildId: null };
    try {
      this.state = { ...this.state, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) };
    } catch {}
    if (!this.state.activeBuildId || !this.exists(this.state.activeBuildId)) {
      const first = this.list()[0];
      // pas de build : on démarre dans le bac à sable plutôt que d'en créer un
      this.state.activeBuildId = first ? first.id : SANDBOX_ID;
      this.ensureSandbox();
      this.saveState();
    }
  }

  file(id) {
    if (id === SANDBOX_ID) return SANDBOX_FILE;
    if (!/^[\w-]+$/.test(id)) throw new Error('Identifiant de build invalide');
    return path.join(BUILDS_DIR, `${id}.json`);
  }

  exists(id) {
    try {
      return fs.existsSync(this.file(id));
    } catch {
      return false;
    }
  }

  isSandbox(id) {
    return id === SANDBOX_ID;
  }

  saveState() {
    fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2));
  }

  list() {
    const out = [];
    for (const f of fs.readdirSync(BUILDS_DIR)) {
      if (!f.endsWith('.json') || f.startsWith('_')) continue;
      try {
        const b = JSON.parse(fs.readFileSync(path.join(BUILDS_DIR, f), 'utf8'));
        out.push({ id: b.id, name: b.name, class: b.class, ascendancy: b.ascendancy, level: b.level, updatedAt: b.updatedAt, pending: this.hasDraft(b.id) });
      } catch {}
    }
    return out.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  get(id) {
    if (id === SANDBOX_ID) this.ensureSandbox();
    const f = this.file(id);
    if (!fs.existsSync(f)) throw new Error(`Build introuvable : ${id}`);
    return normalizeBuild(JSON.parse(fs.readFileSync(f, 'utf8')));
  }

  /** Build tel qu'on le travaille : le brouillon s'il existe, sinon la version enregistrée */
  resolve(idOrName) {
    return this.working(this.resolveId(idOrName));
  }

  resolveId(idOrName) {
    if (!idOrName) return this.state.activeBuildId;
    if (/^(bac[- ]?[àa][- ]?sable|sandbox)$/i.test(String(idOrName))) return SANDBOX_ID;
    if (this.exists(idOrName)) return idOrName;
    const n = String(idOrName).toLowerCase();
    const hit = this.list().find((b) => b.name.toLowerCase() === n) || this.list().find((b) => b.name.toLowerCase().includes(n));
    if (!hit) throw new Error(`Build introuvable : ${idOrName}`);
    return hit.id;
  }

  save(build, { source = 'ui' } = {}) {
    delete build.pending;
    delete build.pendingChanges;
    build.updatedAt = new Date().toISOString();
    if (build.id === SANDBOX_ID) build.sandbox = true;
    fs.writeFileSync(this.file(build.id), JSON.stringify(build, null, 2));
    this.emit('build', { build: this.working(build.id), source });
    return build;
  }

  // ------------------------------------------------------------ brouillons (« Valider »)
  // Toute modification d'un build enregistré va dans builds/_brouillon-<id>.json.
  // La version enregistrée ne change qu'au moment où l'on valide.
  draftFile(id) {
    if (!/^[\w-]+$/.test(id)) throw new Error('Identifiant de build invalide');
    return path.join(BUILDS_DIR, `_brouillon-${id}.json`);
  }

  hasDraft(id) {
    return id !== SANDBOX_ID && fs.existsSync(this.draftFile(id));
  }

  working(id) {
    const saved = this.get(id);
    if (!this.hasDraft(id)) return saved;
    const draft = normalizeBuild(JSON.parse(fs.readFileSync(this.draftFile(id), 'utf8')));
    return { ...draft, pending: true, pendingChanges: diffBuilds(saved, draft) };
  }

  /** Enregistre le résultat d'une modification : bac à sable direct, build enregistré -> brouillon */
  commit(build, { source = 'ui' } = {}) {
    if (build.id === SANDBOX_ID) return this.save(build, { source });
    const saved = this.get(build.id);
    const draft = { ...build };
    delete draft.pending;
    delete draft.pendingChanges;
    if (!diffBuilds(saved, draft).length) {
      // revenu à l'identique : plus rien à valider
      if (this.hasDraft(build.id)) fs.unlinkSync(this.draftFile(build.id));
    } else {
      draft.updatedAt = new Date().toISOString();
      fs.writeFileSync(this.draftFile(build.id), JSON.stringify(draft, null, 2));
    }
    const w = this.working(build.id);
    this.emit('build', { build: w, source });
    this.emit('list', this.list());
    return w;
  }

  validate(id) {
    if (!this.hasDraft(id)) return this.get(id);
    const draft = normalizeBuild(JSON.parse(fs.readFileSync(this.draftFile(id), 'utf8')));
    fs.unlinkSync(this.draftFile(id));
    const b = this.save(draft);
    this.emit('list', this.list());
    return b;
  }

  discard(id) {
    if (this.hasDraft(id)) fs.unlinkSync(this.draftFile(id));
    const b = this.get(id);
    this.emit('build', { build: b, source: 'ui' });
    this.emit('list', this.list());
    return b;
  }

  create(opts = {}, { source = 'ui' } = {}) {
    const b = createBuild(opts);
    if (this.data) this.data.graph.sanitize(b);
    this.save(b, { source });
    this.emit('list', this.list());
    return b;
  }

  add(build, { source = 'ui' } = {}) {
    const b = normalizeBuild(build);
    if (b.id !== SANDBOX_ID) {
      // une copie du bac à sable devient un build normal
      delete b.sandbox;
      delete b.copiedFrom;
    }
    this.save(b, { source });
    if (b.id !== SANDBOX_ID) this.emit('list', this.list());
    return b;
  }

  remove(id) {
    if (id === SANDBOX_ID) {
      this.resetSandbox();
      return;
    }
    fs.unlinkSync(this.file(id));
    if (this.hasDraft(id)) fs.unlinkSync(this.draftFile(id));
    if (this.state.lastBuildId === id) this.state.lastBuildId = null;
    if (this.state.activeBuildId === id) {
      const first = this.list()[0];
      this.state.activeBuildId = first ? first.id : SANDBOX_ID;
      this.saveState();
      this.emit('active', this.state.activeBuildId);
    }
    this.saveState();
    this.emit('list', this.list());
  }

  setActive(id) {
    this.get(id);
    if (id !== SANDBOX_ID) this.state.lastBuildId = id;
    else if (this.state.activeBuildId !== SANDBOX_ID) this.state.lastBuildId = this.state.activeBuildId;
    this.state.activeBuildId = id;
    this.saveState();
    this.emit('active', id);
  }

  // ------------------------------------------------------------ bac à sable
  ensureSandbox() {
    if (fs.existsSync(SANDBOX_FILE)) return;
    this.resetSandbox({ silent: true });
  }

  /** Vide le bac à sable (ou le remplit avec une copie d'un build, qui reste intact) */
  resetSandbox({ fromBuild = null, cls = null, silent = false } = {}) {
    let b;
    if (fromBuild) {
      const src = this.working(fromBuild);
      delete src.pending;
      delete src.pendingChanges;
      b = { ...structuredClone(src), name: `Bac à sable (copie de « ${src.name} »)`, copiedFrom: src.id };
    } else {
      let cur = null;
      try {
        cur = this.state.activeBuildId && this.state.activeBuildId !== SANDBOX_ID ? this.get(this.state.activeBuildId) : null;
      } catch {}
      b = createBuild({ name: 'Bac à sable', class: cls || cur?.class || 'Warrior', level: 100 });
    }
    b.id = SANDBOX_ID;
    b.sandbox = true;
    if (this.data) this.data.graph.sanitize(b);
    const out = normalizeBuild(b);
    out.sandbox = true;
    if (silent) {
      out.updatedAt = new Date().toISOString();
      fs.writeFileSync(SANDBOX_FILE, JSON.stringify(out, null, 2));
      return out;
    }
    return this.save(out);
  }

  /** Enregistre le contenu du bac à sable comme un nouveau build (le bac à sable reste tel quel) */
  saveSandboxAs(name) {
    const sb = this.get(SANDBOX_ID);
    const now = new Date().toISOString();
    const b = { ...structuredClone(sb), id: newId(), name: name || 'Build issu du bac à sable', createdAt: now };
    delete b.sandbox;
    delete b.copiedFrom;
    return this.add(b);
  }

  /** Quitte le bac à sable : retour au dernier build ouvert (ou au plus récent) */
  leaveSandbox() {
    const target = (this.state.lastBuildId && this.exists(this.state.lastBuildId) && this.state.lastBuildId) || this.list()[0]?.id;
    if (!target) throw new Error("Aucun build enregistré : enregistrez d'abord le bac à sable comme build.");
    this.setActive(target);
    return target;
  }
}
