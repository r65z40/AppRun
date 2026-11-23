// Régie publicitaire : campagnes en cours (back office > Publicité), choix de la pub pour chaque emplacement,
// comptage fiable des affichages et clics. Sans base branchée : une pub de démonstration.
import { AppState } from 'react-native';
import * as acc from './account';
import type { Ad, AdCreative, Placement } from './types';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const DEMO: AdCreative = {
  id: 'demo', advertiser: 'Maison Lumen', title: 'Lire le soir, sans fatiguer vos yeux',
  body: 'Une lampe de lecture rechargeable à lumière chaude, pensée pour les liseuses et les livres papier.',
  cta: "Découvrir l'offre", url: '', image_url: null, rubrics: [], weight: 1, placements: ['edition', 'flash', 'rubrics'],
};

/**
 * Campagnes en cours. Le poids vient de la base : poids choisi × priorité × rythme (une campagne en retard sur
 * son objectif pèse plus, une campagne en avance moins, une campagne qui a fait sa part du jour disparaît).
 */
export let ADS: AdCreative[] = URL && KEY ? [] : [DEMO];

// Pub déjà attribuée à chaque emplacement : la carte ne change pas sous les yeux du lecteur quand le fil se
// reconstruit. Les nouveaux emplacements suivent les poids les plus récents.
const slots = new Map<string, AdCreative>();
const key = (list: AdCreative[]) => JSON.stringify(list.map(({ weight: _w, ...x }) => x));

/** Recharge les campagnes. Renvoie vrai si la liste a changé (un simple changement de poids ne reconstruit pas le fil). */
export async function loadAds(): Promise<boolean> {
  if (!URL || !KEY) return false;
  try {
    const next = await acc.rpc<AdCreative[]>('live_ads', {});
    if (!Array.isArray(next)) return false;
    const changed = key(next) !== key(ADS);
    ADS = next.map((a) => ({ ...a, weight: Number(a.weight) || 0, placements: a.placements ?? ['edition'] }));
    if (changed) for (const [k, a] of slots) if (!ADS.some((x) => x.id === a.id)) slots.delete(k);
    return changed;
  } catch {
    return false;
  }
}

/**
 * Pubs pour n emplacements d'une colonne. Ciblage par rubrique seulement si le lecteur l'a accepté ;
 * sinon, uniquement les campagnes sans ciblage. Tirage au sort selon les poids, jamais deux fois de suite la même.
 */
export function pickAds(n: number, place: Placement, column: string, active: string[], personalized: boolean): AdCreative[] {
  const pool = ADS.filter((a) => a.weight > 0 && a.placements.includes(place) && (!a.rubrics.length || (personalized && a.rubrics.some((r) => active.includes(r)))));
  if (!pool.length) return [];
  const out: AdCreative[] = [];
  for (let i = 0; i < n; i++) {
    const k = `${column}:${i}`;
    const kept = slots.get(k);
    if (kept && pool.some((a) => a.id === kept.id)) { out.push(kept); continue; }
    const prev = out[i - 1];
    const choices = pool.length > 1 && prev ? pool.filter((a) => a.id !== prev.id) : pool;
    let r = Math.random() * choices.reduce((s, a) => s + a.weight, 0);
    const ad = choices.find((a) => (r -= a.weight) <= 0) ?? choices[choices.length - 1];
    slots.set(k, ad);
    out.push(ad);
  }
  return out;
}

/* ---------- Comptage ---------- */
// Chaque affichage reçoit un identifiant tiré au hasard : renvoyé deux fois (réseau capricieux), il ne compte qu'une fois.
// Envoi par paquets ; hors ligne, la file attend sur le téléphone et part au retour du réseau (jusqu'à 72 h après).
type Ev = { i: string; c: string; p: Placement; k: 'view' | 'click'; t: number };
const QKEY = 'titre.adq';
let queue: Ev[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let restored = false;
const shown = new Map<string, string>(); // emplacement → identifiant de son affichage (une fois par ouverture de l'app)

const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
  const r = (Math.random() * 16) | 0;
  return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
});
const save = () => acc.setLocal(QKEY, queue.length ? JSON.stringify(queue.slice(-15)) : null);

async function restore() {
  if (restored) return;
  restored = true;
  try {
    const old = JSON.parse((await acc.getLocal(QKEY)) ?? '[]') as Ev[];
    if (Array.isArray(old)) queue.unshift(...old.filter((e) => e && e.i && Date.now() - e.t < 72 * 3600e3));
  } catch {}
}

async function flush() {
  if (timer) { clearTimeout(timer); timer = null; }
  await restore();
  if (!queue.length) return;
  const ev = queue.splice(0, 50);
  try {
    await acc.rpc('ad_hits', { d: await acc.deviceId(), ev });
  } catch {
    queue.unshift(...ev.slice(-(200 - queue.length))); // hors ligne : on réessaie au prochain envoi
  }
  save();
  if (queue.length && !timer) timer = setTimeout(flush, 30000);
}
AppState.addEventListener('change', (s) => { if (s === 'active') flush(); else save(); });
if (URL && KEY) setTimeout(flush, 3000); // ce qui attendait depuis la dernière fois

function push(e: Ev) {
  queue.push(e);
  save();
  if (queue.length >= 10) flush();
  else if (!timer) timer = setTimeout(flush, 8000);
}

/**
 * Affichage : la pub est restée une seconde à l'écran, app au premier plan. Un seul par emplacement et par
 * ouverture de l'app. Clic : seulement sur un affichage compté (on le compte d'abord s'il ne l'était pas).
 */
export function adHit(card: Ad, click = false) {
  if (!URL || !KEY || card.c.id === 'demo') return;
  if (!click && AppState.currentState !== 'active') return;
  let id = shown.get(card.id);
  if (!id) {
    id = uuid();
    shown.set(card.id, id);
    push({ i: id, c: card.c.id, p: card.place, k: 'view', t: Date.now() });
  }
  if (click) push({ i: id, c: card.c.id, p: card.place, k: 'click', t: Date.now() });
}
