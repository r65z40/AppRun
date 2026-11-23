// Algorithme « Mon édition » (cahier des charges §16), sans IA : l'app note ce que fait le lecteur,
// la base en tire ses goûts et compose son édition (fonction my_edition, réglée dans le back office).
import { AppState } from 'react-native';
import * as acc from './account';

export type Signal = 'view' | 'summary' | 'summary_end' | 'source' | 'click' | 'share' | 'back' | 'less';
export type Pick = { article_id: string; slot: 'ess' | 'pv' | 'dec' | 'more'; reason: string };

let queue: { a: string; k: Signal; ms?: number }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!queue.length) return;
  const ev = queue.splice(0, 100);
  try { await acc.rpc('track', { d: await acc.deviceId(), ev }); }
  catch { if (queue.length < 300) queue.unshift(...ev); } // hors ligne : on réessaie au prochain envoi
}
AppState.addEventListener('change', (s) => s !== 'active' && flush());

/** Note un signal de lecture (infos de la vraie base seulement), envoyé par paquets toutes les 15 s. */
export function signal(articleId: string, k: Signal, ms?: number) {
  if (!acc.isLive(articleId)) return;
  queue.push({ a: articleId, k, ...(ms === undefined ? {} : { ms: Math.round(ms) }) });
  if (queue.length >= 20) flush();
  else if (!timer) timer = setTimeout(flush, 15000);
}

/** L'édition du lecteur, dans l'ordre : null sans base ou sans réseau (l'app compose alors elle-même). */
export async function loadMyEdition(active: string[], quota: number, perso: boolean): Promise<Pick[] | null> {
  if (!acc.accountsOn) return null;
  try {
    await flush(); // les derniers signaux comptent tout de suite
    const rows = await acc.rpc<Pick[]>('my_edition', { d: await acc.deviceId(), active, quota, perso });
    return rows?.length ? rows : null;
  } catch {
    return null;
  }
}

export async function resetTaste() {
  queue = [];
  await acc.rpc('reset_taste', { d: await acc.deviceId() });
}
