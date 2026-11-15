// Stockage des builds + build actif + bac à sable + brouillons + notifications, indépendant du support :
// fichiers builds/*.json pour le serveur local (src/server/store.mjs), mémoire du navigateur
// pour la version en ligne (web/src/web/backend.js).
//
// Le support (« disk ») range des objets JSON sous un nom :
//   read(nom) -> objet | null   write(nom, objet)   remove(nom)   has(nom)   names() -> [noms]
// Un nom sans « _ » initial est un build enregistré ; « _etat », « _bac-a-sable » et
// « _brouillon-<id> » sont internes. Chaque read() renvoie un objet neuf.
import { createBuild, normalizeBuild, newId, diffBuilds } from './build-model.mjs';

// Le bac à sable est un espace libre : il n'apparaît pas dans la liste des builds
// (nom préfixé par « _ ») et ne modifie jamais un build enregistré.
export const SANDBOX_ID = 'bac-a-sable';
const STATE = '_etat';
const SANDBOX = '_bac-a-sable';

function checkId(id) {
  if (!/^[\w-]+$/.test(id)) throw new Error('Identifiant de build invalide');
  return id;
}

/** Émetteur d'évènements minimal (fonctionne dans Node et dans le navigateur) */
class Emitter {
  #handlers = new Map();
  on(event, fn) {
    if (!this.#handlers.has(event)) this.#handlers.set(event, new Set());
    this.#handlers.get(event).add(fn);
    return () => this.#handlers.get(event)?.delete(fn);
  }
  emit(event, arg) {
    for (const fn of this.#handlers.get(event) || []) fn(arg);
  }
}

export class BuildStore extends Emitter {
  constructor(data, disk) {
    super();
    this.data = data;
    this.disk = disk;
    this.state = { activeBuildId: null, lastBuildId: null };
    try {
      this.state = { ...this.state, ...(disk.read(STATE) || {}) };
    } catch {}
    if (!this.state.activeBuildId || !this.exists(this.state.activeBuildId)) {
      const first = this.list()[0];
      // pas de build : on démarre dans le bac à sable plutôt que d'en créer un
      this.state.activeBuildId = first ? first.id : SANDBOX_ID;
      this.ensureSandbox();
      this.saveState();
    }
  }

  /** Nom de stockage d'un build enregistré (ou du bac à sable) */
  key(id) {
    if (id === SANDBOX_ID) return SANDBOX;
    return checkId(id);
  }

  exists(id) {
    try {
      return this.disk.has(this.key(id));
    } catch {
      return false;
    }
  }

  isSandbox(id) {
    return id === SANDBOX_ID;
  }

  saveState() {
    this.disk.write(STATE, this.state);
  }

  list() {
    const out = [];
    for (const name of this.disk.names()) {
      if (name.startsWith('_')) continue;
      try {
        const b = this.disk.read(name);
        if (!b) continue;
        out.push({ id: b.id, name: b.name, class: b.class, ascendancy: b.ascendancy, level: b.level, updatedAt: b.updatedAt, pending: this.hasDraft(b.id) });
      } catch {}
    }
    return out.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  get(id) {
    if (id === SANDBOX_ID) this.ensureSandbox();
    const raw = this.disk.read(this.key(id));
    if (!raw) throw new Error(`Build introuvable : ${id}`);
    return normalizeBuild(raw);
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
    this.disk.write(this.key(build.id), build);
    this.emit('build', { build: this.working(build.id), source });
    return build;
  }

  // ------------------------------------------------------------ brouillons (« Valider »)
  // Toute modification d'un build enregistré va dans le brouillon « _brouillon-<id> ».
  // La version enregistrée ne change qu'au moment où l'on valide.
  draftKey(id) {
    return `_brouillon-${checkId(id)}`;
  }

  hasDraft(id) {
    return id !== SANDBOX_ID && this.disk.has(this.draftKey(id));
  }

  working(id) {
    const saved = this.get(id);
    if (!this.hasDraft(id)) return saved;
    const draft = normalizeBuild(this.disk.read(this.draftKey(id)));
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
      if (this.hasDraft(build.id)) this.disk.remove(this.draftKey(build.id));
    } else {
      draft.updatedAt = new Date().toISOString();
      this.disk.write(this.draftKey(build.id), draft);
    }
    const w = this.working(build.id);
    this.emit('build', { build: w, source });
    this.emit('list', this.list());
    return w;
  }

  validate(id) {
    if (!this.hasDraft(id)) return this.get(id);
    const draft = normalizeBuild(this.disk.read(this.draftKey(id)));
    this.disk.remove(this.draftKey(id));
    const b = this.save(draft);
    this.emit('list', this.list());
    return b;
  }

  discard(id) {
    if (this.hasDraft(id)) this.disk.remove(this.draftKey(id));
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
    if (!this.exists(id)) throw new Error(`Build introuvable : ${id}`);
    this.disk.remove(this.key(id));
    if (this.hasDraft(id)) this.disk.remove(this.draftKey(id));
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
    if (this.disk.has(SANDBOX)) return;
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
      this.disk.write(SANDBOX, out);
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

  // ------------------------------------------------------------ sauvegarde (fichier)
  /** Tous les builds enregistrés (versions validées), pour une sauvegarde dans un fichier */
  backup() {
    return this.list().map((b) => this.get(b.id));
  }

  /**
   * Restaure des builds depuis une sauvegarde. Un build déjà présent et identique est ignoré ;
   * s'il a changé depuis, la version de la sauvegarde est ajoutée comme copie (rien n'est écrasé).
   */
  restore(builds) {
    let added = 0;
    let skipped = 0;
    for (const raw of builds) {
      if (!raw || typeof raw !== 'object' || !raw.tree || !raw.class || (this.data && !this.data.graph.classById[raw.class])) {
        skipped++;
        continue;
      }
      const b = { ...raw };
      delete b.pending;
      delete b.pendingChanges;
      if (b.id === SANDBOX_ID || b.sandbox) {
        delete b.sandbox;
        delete b.copiedFrom;
        b.id = newId();
      }
      let valid = false;
      try {
        valid = !!b.id && !!checkId(b.id);
      } catch {}
      if (!valid) b.id = newId();
      if (this.exists(b.id)) {
        if (this.get(b.id).updatedAt === b.updatedAt) {
          skipped++;
          continue;
        }
        b.id = newId();
        b.name = `${b.name || 'Build'} (sauvegarde)`;
      }
      const nb = normalizeBuild(b);
      if (this.data) this.data.graph.sanitize(nb);
      delete nb.sandbox;
      delete nb.copiedFrom;
      this.disk.write(this.key(nb.id), nb);
      added++;
    }
    this.emit('list', this.list());
    return { added, skipped };
  }
}
