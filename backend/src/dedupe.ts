export type Raw = { id: string; title: string; description: string; link: string; published_at: Date | null; source: string; hint?: string | null; dups?: string[] };

const key = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const url = (s: string) => s.replace(/[?#].*$/, '').replace(/\/$/, '');

/**
 * Une seule fois chaque article : même lien (sans paramètres de suivi) ou même titre chez le même média.
 * La plus récente est gardée ; les identifiants des doublons sont rangés dans dups pour ne pas les retraiter plus tard.
 * Deux médias différents sur le même titre restent séparés : c'est une confirmation utile à l'IA.
 */
export function dedupe(raws: Raw[]): Raw[] {
  const seen = new Map<string, Raw>();
  const out: Raw[] = [];
  for (const r of raws) {
    const k1 = 'l:' + url(r.link), k2 = `t:${r.source}:${key(r.title)}`;
    const first = seen.get(k1) ?? seen.get(k2);
    if (first) {
      (first.dups ??= []).push(r.id);
      if (!first.hint && r.hint) first.hint = r.hint; // le flux de rubrique est un meilleur indice que la Une
      continue;
    }
    const kept = { ...r };
    seen.set(k1, kept).set(k2, kept);
    out.push(kept);
  }
  return out;
}
