// Compatibilité gemmes d'aptitude / gemmes de soutien, selon les règles de Path of Building
// (expressions en notation polonaise inverse : types, AND, OR, NOT).

function matchExpr(expr, types) {
  const stack = [];
  for (const t of expr) {
    if (t === 'OR') {
      const o = stack.pop();
      stack[stack.length - 1] = stack[stack.length - 1] || o;
    } else if (t === 'AND') {
      const o = stack.pop();
      stack[stack.length - 1] = stack[stack.length - 1] && o;
    } else if (t === 'NOT') {
      stack[stack.length - 1] = !stack[stack.length - 1];
    } else {
      stack.push(types.has(t));
    }
  }
  return stack.some(Boolean);
}

/** Le soutien `support` peut-il modifier l'aptitude `active` ? */
export function canSupport(support, active) {
  if (!support || !active) return false;
  if (support.kind !== 'support' && support.kind !== 'lineage') return false;
  const types = new Set(active.skillTypes || []);
  if (support.excludeSkillTypes?.length && matchExpr(support.excludeSkillTypes, types)) return false;
  if (!support.requireSkillTypes?.length) return true;
  return matchExpr(support.requireSkillTypes, types);
}

/** Catégories d'une gemme de soutien (PoB : « Brutalité I/II/III » partagent la même catégorie) */
export function supportFamilies(gem) {
  return gem?.gemFamily?.length ? gem.gemFamily : [String(gem?.nameEn || '').replace(/\s+(I|II|III|IV|V)$/, '')];
}

/**
 * Analyse les groupes de gemmes d'un build : soutiens incompatibles et soutiens de même catégorie.
 * Règle du jeu : « Vous ne pouvez pas avoir plusieurs copies de la même Catégorie de Gemme de soutien
 * enchâssées en même temps » (ex. Armement élémentaire I et III) — au sein d'une même aptitude.
 * Depuis la 0.3.0, une même gemme de soutien peut être utilisée sur plusieurs aptitudes
 * (« We've removed the restriction of having one of each support gem per character »), et
 * Path of Building applique la règle de catégorie par aptitude (CalcSetup.addBestSupport).
 */
export function checkSkills(build, gemsById) {
  const warnings = [];
  build.skills.forEach((s, si) => {
    const seen = new Map(); // catégorie -> { skill, name }, propre à ce groupe
    const active = gemsById.get(s.gems[0]?.gemId);
    if (active && (active.kind === 'support' || active.kind === 'lineage')) {
      warnings.push({ skill: si, gem: 0, text: `« ${active.name} » est une gemme de soutien : la première gemme d'un groupe doit être une aptitude.` });
    }
    s.gems.slice(1).forEach((g, j) => {
      const sup = gemsById.get(g.gemId);
      if (!sup) return;
      if (sup.kind !== 'support' && sup.kind !== 'lineage') {
        warnings.push({ skill: si, gem: j + 1, text: `« ${sup.name} » n'est pas une gemme de soutien.` });
        return;
      }
      if (active && !canSupport(sup, active)) {
        warnings.push({ skill: si, gem: j + 1, text: `« ${sup.name} » ne peut pas modifier « ${active.name} ».`, incompatible: true });
      }
      for (const fam of supportFamilies(sup)) {
        const prev = seen.get(fam);
        if (prev) {
          warnings.push({
            skill: si,
            gem: j + 1,
            text: `« ${sup.name} » est de la même catégorie que « ${prev.name} » dans ce même groupe : le jeu n'autorise qu'une gemme par catégorie de soutien sur une aptitude.`,
            duplicate: true,
          });
        } else seen.set(fam, { skill: si, name: sup.name });
      }
    });
  });
  return warnings;
}
