// Régie publicitaire : campagnes en cours (back office > Publicité), choix de la pub, comptage des affichages et clics.
// Sans base branchée : une pub de démonstration.
import type { AdCreative } from './types';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const headers = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  ...(KEY!.startsWith('sb_') ? { apikey: KEY! } : { apikey: KEY!, Authorization: `Bearer ${KEY}` }),
});

const DEMO: AdCreative = {
  id: 'demo', advertiser: 'Maison Lumen', title: 'Lire le soir, sans fatiguer vos yeux',
  body: 'Une lampe de lecture rechargeable à lumière chaude, pensée pour les liseuses et les livres papier.',
  cta: "Découvrir l'offre", url: '', image_url: null, rubrics: [], weight: 1,
};

/** Campagnes en cours. Base branchée : vide tant que rien n'est chargé ou si aucune campagne ne tourne. */
export let ADS: AdCreative[] = URL && KEY ? [] : [DEMO];
// Ordre de passage tiré une fois par chargement : chaque campagne y figure autant de fois que son poids.
// Le même emplacement garde donc la même pub quand le fil se reconstruit.
let order: AdCreative[] = ADS;
const shuffle = (list: AdCreative[]) => {
  const a = list.flatMap((x) => Array<AdCreative>(x.weight).fill(x));
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Recharge les campagnes. Renvoie vrai si la liste a changé. */
export async function loadAds(): Promise<boolean> {
  if (!URL || !KEY) return false;
  try {
    const r = await fetch(`${URL}/rest/v1/rpc/live_ads`, { method: 'POST', headers: headers(), body: '{}' });
    if (!r.ok) return false;
    const next = (await r.json()) as AdCreative[];
    if (JSON.stringify(next) === JSON.stringify(ADS)) return false;
    ADS = next;
    order = shuffle(next);
    return true;
  } catch {
    return false;
  }
}

/**
 * Pubs pour n emplacements. Ciblage par rubrique seulement si le lecteur l'a accepté ;
 * sinon, uniquement les campagnes sans ciblage.
 */
export function pickAds(n: number, active: string[], personalized: boolean): AdCreative[] {
  const pool = order.filter((a) => !a.rubrics.length || (personalized && a.rubrics.some((r) => active.includes(r))));
  return pool.length ? Array.from({ length: n }, (_, i) => pool[i % pool.length]) : [];
}

const counted = new Set<string>();
/** Un affichage par emplacement et par ouverture de l'app ; chaque clic compte. */
export function adHit(slot: string, ad: AdCreative, click = false) {
  if (!URL || !KEY || ad.id === 'demo') return;
  if (!click) {
    if (counted.has(slot)) return;
    counted.add(slot);
  }
  fetch(`${URL}/rest/v1/rpc/ad_hit`, { method: 'POST', headers: headers(), body: JSON.stringify({ cid: ad.id, click }) }).catch(() => {});
}
