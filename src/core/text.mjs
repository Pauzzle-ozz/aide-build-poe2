// Normalisation et recherche de texte (partagées entre le serveur local et la version en ligne).

export function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Score de correspondance simple (tous les mots de la requête doivent apparaître) */
export function matchScore(query, ...fields) {
  const q = norm(query);
  if (!q) return 1;
  const words = q.split(' ');
  let score = 0;
  const hay = fields.map(norm);
  for (const w of words) {
    let best = 0;
    for (const [i, h] of hay.entries()) {
      if (!h) continue;
      if (h === q) best = Math.max(best, 100 - i);
      else if (h.startsWith(w)) best = Math.max(best, 20 - i);
      else if (h.includes(w)) best = Math.max(best, 10 - i);
    }
    if (!best) return 0;
    score += best;
  }
  return score;
}
