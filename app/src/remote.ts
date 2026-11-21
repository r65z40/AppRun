// Lecture de la vraie édition du jour dans Supabase (API REST publique, lecture seule).
// Sans configuration ou sans réseau, l'app garde le contenu de démonstration.
import { PHOTOS, RUBRICS } from './content';
import type { Article, Rubric } from './types';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const remoteConfigured = !!(URL && KEY);

type Row = {
  id: string;
  rubric_id: string;
  rank: number;
  essential: boolean;
  title: string;
  key_sentence: string;
  facts: { text: string; source: string; url: string }[];
  summary: string[];
  photo_tag: string | null;
  photo_url: string | null;
  published_at: string | null;
  created_at: string;
};
type Stat = { article_id: string; likes: number; comments: number };

async function get<T>(path: string, signal: AbortSignal): Promise<T> {
  const r = await fetch(`${URL}/rest/v1/${path}`, { headers: { apikey: KEY!, Authorization: `Bearer ${KEY}` }, signal });
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
          media: `D'après ${media.join(', ')}`,
        };
      }),
    })).filter((r) => r.items.length);
    // Les infos sans photo prennent un dégradé de la palette.
    const grads = [['#7B5CFF', '#3D7BFF', '#C86BFA', '#1a1440'], ['#3D7BFF', '#7B5CFF', '#4fb0ff', '#120e2a']];
    next.forEach((r, i) => r.items.forEach((a) => { if (!a.photo) a.grad = grads[i % 2]; }));
    RUBRICS.splice(0, RUBRICS.length, ...next);
    return date;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
