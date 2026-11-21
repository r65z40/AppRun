// Photo d'illustration libre de droits à partir des mots-clés choisis par Claude.
// Unsplash (UNSPLASH_ACCESS_KEY) en priorité, Pexels (PEXELS_API_KEY) si une ancienne clé existe.
// Sans clé, rien ne change : l'app garde les photos d'ambiance embarquées.
const unsplash = () => process.env.UNSPLASH_ACCESS_KEY;
const pexels = () => process.env.PEXELS_API_KEY;
export const pexelsOn = () => !!(unsplash() || pexels());

export type PickedPhoto = { url: string; credit: string };
const used = new Set<string>(); // pas deux fois la même photo dans un passage

type UPhoto = { id: string; urls: { regular: string }; user: { name: string }; links: { download_location: string } };
async function fromUnsplash(KEY: string, query: string): Promise<PickedPhoto | null> {
  const u = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=portrait&per_page=10&content_filter=high`;
  const r = await fetch(u, { headers: { Authorization: `Client-ID ${KEY}`, 'Accept-Version': 'v1' }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`Unsplash HTTP ${r.status}`);
  const { results } = (await r.json()) as { results: UPhoto[] };
  const p = results.find((x) => !used.has('u' + x.id)) ?? results[0];
  if (!p) return null;
  used.add('u' + p.id);
  // Règle d'Unsplash : signaler chaque photo utilisée.
  fetch(p.links.download_location, { headers: { Authorization: `Client-ID ${KEY}` }, signal: AbortSignal.timeout(10000) }).catch(() => {});
  return { url: p.urls.regular, credit: `${p.user.name} · Unsplash` };
}

type PPhoto = { id: number; photographer: string; src: { portrait: string } };
async function fromPexels(KEY: string, query: string): Promise<PickedPhoto | null> {
  const u = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=10`;
  const r = await fetch(u, { headers: { Authorization: KEY }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`Pexels HTTP ${r.status}`);
  const { photos } = (await r.json()) as { photos: PPhoto[] };
  const p = photos.find((x) => !used.has('p' + x.id)) ?? photos[0];
  if (!p) return null;
  used.add('p' + p.id);
  return { url: p.src.portrait, credit: `${p.photographer} · Pexels` };
}

export async function findPhoto(query: string): Promise<PickedPhoto | null> {
  if (!query.trim()) return null;
  const u = unsplash(), p = pexels();
  if (u) {
    const got = await fromUnsplash(u, query).catch((e) => { if (!p) throw e; return null; });
    if (got || !p) return got;
  }
  return p ? fromPexels(p, query) : null;
}
