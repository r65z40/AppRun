// Suivre un sujet (« Ukraine », « Budget »…) : alerte quand il bouge, petite frise de son histoire.
// Les sujets sont les mots-clés réglés dans le back office (Lecteurs > Sujets suivis). Sans base (démo),
// le suivi reste sur le téléphone et la frise se compose avec les infos de démonstration.
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as acc from './account';
import { FLASHES, RUBRICS } from './content';
import type { Article } from './types';

export type Followed = { topic: string; alerts: boolean; new: number; last_at: string | null };
export type Topics = { enabled: boolean; alerts: boolean; max: number; suggested: string[]; available: string[]; following: Followed[] };
export type TimelineItem = { kind: 'a' | 'f'; id: string; title: string; sentence: string; rubric: string | null; importance: number; at: string; fresh: boolean };
export type Timeline = { topic: string; following: boolean; alerts: boolean; items: TimelineItem[] };

type Listener = (t: Topics) => void;
let state: Topics | null = null;
const listeners = new Set<Listener>();
const emit = (t: Topics) => { state = t; listeners.forEach((f) => f(t)); };
export const onTopics = (f: Listener) => { listeners.add(f); if (state) f(state); return () => { listeners.delete(f); }; };
export const currentTopics = () => state;

/* ---------- Démo : sur le téléphone ---------- */
const DEMO_KEY = 'titre.topics';
// Démo : quelques sujets et les mots qui les repèrent dans les infos fictives.
const DEMO_WORDS: Record<string, string[]> = {
  Budget: ['budget'], Ukraine: ['ukraine', 'kiev'], Climat: ['climat', 'glacier', 'neige', 'tempete'], Énergie: ['gaz', 'electricite', 'energie'],
  Transports: ['train', 'ferries', 'velo'], Emploi: ['chomage', 'emploi'], Football: ['football', 'coupe de france'], IA: ['intelligence artificielle'],
};
const DEMO_LIST = Object.keys(DEMO_WORDS);
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const demoHas = (topic: string, text: string) => (DEMO_WORDS[topic] ?? [norm(topic)]).some((w) => norm(text).includes(w));
async function demoRead(): Promise<Followed[]> {
  try { return JSON.parse((await acc.getLocal(DEMO_KEY)) ?? '[]'); } catch { return []; }
}
async function demoState(): Promise<Topics> {
  const f = await demoRead();
  return { enabled: true, alerts: false, max: 20, suggested: DEMO_LIST.slice(0, 6), available: DEMO_LIST, following: f };
}
function demoTimeline(topic: string, f?: Followed): Timeline {
  const arts = RUBRICS.flatMap((r) => r.items).filter((a) => demoHas(topic, `${a.title} ${a.key}`));
  const items: TimelineItem[] = [
    ...FLASHES.filter((x) => demoHas(topic, `${x.title} ${x.sentence}`)).map((x) => ({ kind: 'f' as const, id: x.id, title: x.title, sentence: x.sentence, rubric: null, importance: 9, at: x.at, fresh: false })),
    ...arts.map((a, k) => ({ kind: 'a' as const, id: a.id, title: a.title, sentence: a.key.replace(/<\/?b>/g, ''), rubric: null, importance: a.importance ?? 5, at: new Date(Date.now() - (k + 1) * 86400e3 * 2).toISOString(), fresh: false })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return { topic, following: !!f, alerts: f?.alerts ?? true, items };
}

/* ---------- Base ---------- */
/** Sujets proposés et suivis (et réglages du back office). Ne lève jamais d'erreur. */
export async function loadTopics(): Promise<Topics | null> {
  try {
    const t = acc.accountsOn ? await acc.rpc<Topics>('my_topics', { d: await acc.deviceId() }) : await demoState();
    emit(t);
    return t;
  } catch {
    return state;
  }
}

/** Suit (ou ne suit plus) un sujet ; alerts = recevoir une alerte quand il bouge. Lève une erreur lisible. */
export async function follow(topic: string, on: boolean, alerts = true): Promise<Topics> {
  if (!acc.accountsOn) {
    const list = (await demoRead()).filter((x) => x.topic !== topic);
    if (on) list.push({ topic, alerts, new: 0, last_at: null });
    await acc.setLocal(DEMO_KEY, JSON.stringify(list));
    const t = await demoState();
    emit(t);
    return t;
  }
  const t = await acc.rpc<Topics>('follow_topic', { d: await acc.deviceId(), topic, follow: on, alerts });
  emit(t);
  if (on && alerts && t.alerts) enablePush().catch(() => {});
  return t;
}

export async function loadTimeline(topic: string): Promise<Timeline> {
  if (!acc.accountsOn) return demoTimeline(topic, (await demoRead()).find((x) => x.topic === topic));
  const t = await acc.rpc<Timeline>('topic_timeline', { d: await acc.deviceId(), topic });
  if (state) emit({ ...state, following: state.following.map((f) => (f.topic === topic ? { ...f, new: 0 } : f)) });
  return t;
}

/* ---------- Sujets de chaque info (boutons « Suivre ») ---------- */
const topicsOf: Record<string, string[]> = {};
/** Sujets connus d'une info (après prefetchTopicsOf), ou ceux trouvés dans son titre en démo. */
export function articleTopics(a: Article): string[] {
  if (topicsOf[a.id]) return topicsOf[a.id];
  if (!acc.accountsOn) return DEMO_LIST.filter((t) => demoHas(t, `${a.title} ${a.key}`)).slice(0, 3);
  return [];
}
/** Va chercher les sujets des infos de l'édition, en une fois. */
export async function prefetchTopicsOf(ids: string[]) {
  const live = ids.filter((id) => acc.isLive(id) && !topicsOf[id]);
  if (!live.length) return;
  try {
    for (let i = 0; i < live.length; i += 200) {
      Object.assign(topicsOf, await acc.rpc<Record<string, string[]>>('topics_of', { ids: live.slice(i, i + 200) }));
    }
  } catch {}
}

/* ---------- Alertes : autorisation et adresse de notification du téléphone ---------- */
/** Demande l'autorisation (une fois) et donne l'adresse du téléphone à la base. Renvoie vrai si les alertes peuvent arriver. */
export async function enablePush(ask = true): Promise<boolean> {
  if (Platform.OS === 'web' || !acc.accountsOn) return false;
  try {
    let { granted } = await Notifications.getPermissionsAsync();
    if (!granted && ask) granted = (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return false;
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('topics', { name: 'Sujets suivis', importance: Notifications.AndroidImportance.DEFAULT });
    // Identifiant du projet Expo (donné par « eas init ») : sans lui, pas d'adresse de notification.
    const projectId = (Constants.easConfig as { projectId?: string } | null)?.projectId ?? (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    if (!projectId) return false;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    await acc.rpc('register_push', { d: await acc.deviceId(), token: data, platform: Platform.OS });
    return true;
  } catch {
    return false;
  }
}

/** Appui sur une alerte : ouvre la frise du sujet. Renvoie de quoi arrêter l'écoute. */
export function onAlertTap(open: (topic: string) => void): () => void {
  if (Platform.OS === 'web') return () => {};
  const go = (r: Notifications.NotificationResponse | null) => {
    const t = r?.notification.request.content.data?.topic;
    if (typeof t === 'string' && t) open(t);
  };
  Notifications.getLastNotificationResponseAsync().then(go).catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener(go);
  return () => sub.remove();
}
