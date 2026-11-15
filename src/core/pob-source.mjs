// Liens de partage Path of Building reconnus (pobb.in, poe.ninja, pastebin).
// Partagé par le serveur local, le navigateur et la fonction Cloudflare qui récupère ces liens.

/** Adresse du code brut pour un lien de partage, null si l'entrée est déjà un code */
export function pobSourceUrl(input) {
  const s = String(input).trim();
  let m;
  if ((m = s.match(/^https?:\/\/pobb\.in\/(?:u\/[^/]+\/)?([\w-]+)/i))) return `https://pobb.in/${m[1]}/raw`;
  if ((m = s.match(/^https?:\/\/poe\.ninja\/(?:poe2\/)?pob\/(?:raw\/)?([\w-]+)/i))) return `https://poe.ninja/poe2/pob/raw/${m[1]}`;
  if ((m = s.match(/^https?:\/\/pastebin\.com\/(?:raw\/)?(\w+)/i))) return `https://pastebin.com/raw/${m[1]}`;
  if (/^https?:\/\//i.test(s)) throw new Error('Lien non reconnu (pobb.in, poe.ninja ou pastebin attendus).');
  return null;
}
