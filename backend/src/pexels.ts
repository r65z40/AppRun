// Photo d'illustration libre de droits (Pexels) à partir des mots-clés choisis par Claude.
// Sans PEXELS_API_KEY, rien ne change : l'app garde les photos d'ambiance embarquées.
const KEY = process.env.PEXELS_API_KEY;
export const pexelsOn = !!KEY;

type Photo = { id: number; url: string; photographer: string; src: { portrait: string; large: string } };
export type PickedPhoto = { url: string; credit: string };

const used = new Set<number>(); // pas deux fois la même photo dans un passage

export async function findPhoto(query: string): Promise<PickedPhoto | null> {
  if (!KEY || !query.trim()) return null;
  const u = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=10`;
  const r = await fetch(u, { headers: { Authorization: KEY }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`Pexels HTTP ${r.status}`);
  const { photos } = (await r.json()) as { photos: Photo[] };
  const p = photos.find((x) => !used.has(x.id)) ?? photos[0];
  if (!p) return null;
  used.add(p.id);
  return { url: p.src.portrait, credit: `${p.photographer} · Pexels` };
}
