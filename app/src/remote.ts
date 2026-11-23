// Lecture de la vraie édition du jour dans Supabase (API REST publique, lecture seule).
// Sans configuration ou sans réseau, l'app garde le contenu de démonstration.
import { FLASHES, PHOTOS, RUBRICS, RUBRIC_LIST } from './content';
import { C } from './theme';
import type { Article, Flash, Rubric } from './types';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const remoteConfigured = !!(URL && KEY);

type Row = {
  id: string;
  rubric_id: string;
  rank: number;
  importance: number;
  essential: boolean;
  sensitive?: boolean;
  title: string;
  key_sentence: string;
  facts: { text: string; source: string; url: string }[];
  summary: string[];
  photo_tag: string | null;
  photo_url: string | null;
  photo_credit?: string | null;
  published_at: string | null;
  created_at: string;
};
type Stat = { article_id: string; likes: number; comments: number };

// Nouvelle clé « publishable » (sb_publishable_…) : seulement dans apikey. Ancienne clé « anon » (JWT) : aussi en Bearer.
const headers = (): Record<string, string> => (KEY!.startsWith('sb_') ? { apikey: KEY! } : { apikey: KEY!, Authorization: `Bearer ${KEY}` });

async function get<T>(path: string, signal: AbortSignal): Promise<T> {
  const r = await fetch(`${URL}/rest/v1/${path}`, { headers: headers(), signal });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

const hour = (iso: string) => {
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric', minute: '2-digit' }).formatToParts(d);
  const h = p.find((x) => x.type === 'hour')?.value ?? '';
  const m = p.find((x) => x.type === 'minute')?.value ?? '';
  return `${Number(h)} h ${m}`;
};

/** Charge la dernière édition publiée et remplace le contenu de démo. Renvoie la date ou null. */
export async function loadEdition(timeoutMs = 4000): Promise<string | null> {
  if (!remoteConfigured) return null;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const eds = await get<{ date: string }[]>('editions?select=date&status=eq.published&order=date.desc&limit=1', ctl.signal);
    if (!eds.length) return null;
    const date = eds[0].date;
    const [rows, rubs, stats] = await Promise.all([
      get<Row[]>(`articles?select=*&edition_date=eq.${date}&status=eq.published&order=rank.asc`, ctl.signal),
      get<{ id: string; name: string }[]>('rubrics?select=id,name&active=eq.true&order=position.asc', ctl.signal),
      get<Stat[]>('article_stats?select=article_id,likes,comments', ctl.signal).catch(() => [] as Stat[]),
    ]);
    if (!rows.length) return null;
    // Toujours les infos les plus importantes en tête, puis les plus récentes (l'édition se complète dans la journée).
    const at = (a: Row) => a.published_at ?? a.created_at;
    rows.sort((a, b) => b.importance - a.importance || at(b).localeCompare(at(a)));
    const emo = await get<{ article_id: string; emoji: string; n: number }[]>(`article_emoji_stats?select=article_id,emoji,n&article_id=in.(${rows.map((r) => r.id).join(',')})`, ctl.signal).catch(() => []);
    const emojis = new Map<string, Record<string, number>>();
    emo.forEach((e) => emojis.set(e.article_id, { ...emojis.get(e.article_id), [e.emoji]: e.n }));
    RUBRIC_LIST.splice(0, RUBRIC_LIST.length, ...rubs);
    const st = new Map(stats.map((s) => [s.article_id, s]));
    const next: Rubric[] = rubs.map((r) => ({
      id: r.id,
      name: r.name,
      items: rows.filter((a) => a.rubric_id === r.id).map((a): Article => {
        const media = [...new Set(a.facts.map((f) => f.source))];
        return {
          id: a.id,
          title: a.title,
          hour: hour(a.published_at ?? a.created_at),
          key: a.key_sentence,
          facts: a.facts.map((f) => ({ text: f.text, source: f.source, doc: f.url })),
          photo: a.photo_url ? { uri: a.photo_url } : (PHOTOS as Record<string, number>)[a.photo_tag ?? ''] ?? null,
          grad: null,
          likes: st.get(a.id)?.likes ?? 0,
          comments: st.get(a.id)?.comments ?? 0,
          summary: a.summary,
          essential: a.essential,
          sensitive: !!a.sensitive,
          importance: a.importance,
          emojis: emojis.get(a.id) ?? {},
          media: `D'après ${media.join(', ')}`,
          credit: a.photo_url ? a.photo_credit ?? undefined : undefined,
        };
      }),
    })).filter((r) => r.items.length);
    // Les infos sans photo prennent un dégradé de la palette.
    const grads = [[C.violet, C.blue, C.pink, C.night2], [C.blue, C.violet, C.sky, C.night3]];
    next.forEach((r, i) => r.items.forEach((a) => { if (!a.photo) a.grad = grads[i % 2]; }));
    RUBRICS.splice(0, RUBRICS.length, ...next);
    return date;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Réglages publics de l'équipe : commentaires ou réactions emoji. */
export async function loadConfig(): Promise<{ commentsMode: 'comments' | 'emoji' } | null> {
  if (!remoteConfigured) return null;
  try {
    const r = await fetch(`${URL}/rest/v1/rpc/app_config`, { method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' }, body: '{}' });
    if (!r.ok) return null;
    const j = await r.json();
    return { commentsMode: j?.comments_mode === 'emoji' ? 'emoji' : 'comments' };
  } catch {
    return null;
  }
}

export type AppMessage = { id: string; title: string; body: string; audience: 'all' | 'free' | 'premium' | 'guests' | 'members' };
/** Messages de l'équipe à afficher à l'ouverture (déjà filtrés : en ligne et pas expirés). */
export async function loadMessages(): Promise<AppMessage[]> {
  if (!remoteConfigured) return [];
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 4000);
  try {
    return await get<AppMessage[]>('app_messages?select=id,title,body,audience&order=created_at.desc&limit=10', ctl.signal);
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

type FlashRow = { id: string; title: string; sentence: string; sources: { source: string; url: string }[]; published_at: string };

/** Dernière minute : remplace les flashs de démo par les vrais. Renvoie true si la liste a changé. */
export async function loadFlashes(timeoutMs = 4000): Promise<boolean> {
  if (!remoteConfigured) return false;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const rows = await get<FlashRow[]>('flashes?select=id,title,sentence,sources,published_at&status=eq.published&order=published_at.desc&limit=30', ctl.signal);
    const next: Flash[] = rows.map((r) => ({ flash: true, id: `flash-${r.id}`, title: r.title, sentence: r.sentence, at: r.published_at, sources: r.sources ?? [] }));
    const same = next.length === FLASHES.length && next.every((f, i) => f.id === FLASHES[i].id && f.title === FLASHES[i].title && f.sentence === FLASHES[i].sentence);
    if (same) return false;
    FLASHES.splice(0, FLASHES.length, ...next);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

// Avec une vraie base, on n'affiche jamais les flashs de démonstration.
if (remoteConfigured) FLASHES.splice(0, FLASHES.length);
