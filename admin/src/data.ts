import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { demoApi } from './demo';

export type Fact = { text: string; source: string; url: string };
export type Status = 'draft' | 'published' | 'rejected';
export type Article = {
  id: string;
  edition_date: string;
  rubric_id: string;
  status: Status;
  rank: number;
  importance: number;
  essential: boolean;
  title: string;
  key_sentence: string;
  facts: Fact[];
  summary: string[];
  photo_tag: string | null;
  photo_url: string | null;
  photo_credit?: string | null;
  review_notes: string[];
  model: string | null;
  published_at: string | null;
  created_at: string;
};
export type Edition = { date: string; status: 'building' | 'ready' | 'published'; published_at: string | null; stats: Record<string, unknown> };
export type Source = { id: string; name: string; url: string; rubric_hint: string | null; active: boolean; last_fetch_at: string | null; last_error: string | null };
export type Role = 'reader' | 'moderator' | 'editor' | 'admin';
export type Profile = { id: string; pseudo: string | null; role: Role; premium: boolean; banned?: boolean; created_at: string };
export type Comment = { id: string; article_id: string; user_id: string; text: string; status: 'visible' | 'hidden'; created_at: string; article_title?: string; pseudo?: string | null };
export type Report = { id: string; comment_id: string; reason: string | null; resolved: boolean; created_at: string; comment?: Comment };
export type Flash = { id: string; status: 'published' | 'hidden'; rubric_id: string | null; importance: number; title: string; sentence: string; sources: { source: string; url: string }[]; manual: boolean; model: string | null; published_at: string; created_at: string };
export type EngineRun = {
  id: string; kind: 'edition' | 'flash'; status: 'running' | 'ok' | 'error'; started_at: string; finished_at: string | null;
  summary: string | null; stats: Record<string, unknown>; log: string[];
  details: {
    stories?: { label: string; rubric: string; importance: number; essential: boolean; items: { source: string; title: string }[] }[];
    left?: { source: string; title: string }[];
    cards?: { rubric: string; title: string; issues: string[]; error?: string; photo?: string }[];
    flashes?: { title: string; sources: string[]; rejected?: string }[];
    /** Commentaires signalés tranchés par l'IA pendant ce passage. */
    moderation?: { text: string; decision: 'hide' | 'keep'; reason: string }[];
    /** Réglages utilisés pendant ce passage. */
    config?: Record<string, string | number | boolean>;
    /** Sujets proposés par l'IA mais écartés par les réglages. */
    dropped?: { label: string; why: string }[];
  };
};
export type Setting = { key: string; value: string; is_set: boolean; updated_at: string };
export type Me = { id: string; email: string; role: Role };
export type Reader = { id: string; pseudo: string | null; email: string; role: Role; premium: boolean; banned: boolean; created_at: string; last_seen: string | null; comments: number; hidden: number; reports: number };
export type AuditEntry = { at: string; who: string; action: string; target: string | null; detail: string | null };
export type TopArticle = { title: string; rubric_id: string; likes: number; comments: number };
export type Dashboard = {
  active_today: number; active_7: number; active_30: number; accounts: number; accounts_7: number; premium: number;
  comments_7: number; likes_7: number; reports_open: number; banned: number; ai_today: number; ai_7: number; ai_30: number;
  last_runs: { kind: 'edition' | 'flash'; status: EngineRun['status']; started_at: string; finished_at: string | null; summary: string | null }[];
};

export const RUBRICS: Record<string, string> = {
  france: 'France', monde: 'Monde', eco: 'Économie', tech: 'High-tech', science: 'Sciences', sante: 'Santé',
  ecologie: 'Écologie', sport: 'Sport', culture: 'Culture', people: 'People',
};
/** Message affiché à l'ouverture de l'app, pour un public choisi. */
export type Audience = 'all' | 'free' | 'premium' | 'guests' | 'members';
export const AUDIENCES: Record<Audience, string> = { all: 'Tout le monde', free: 'Lecteurs gratuits', premium: 'Abonnés Premium', guests: 'Sans compte', members: 'Avec un compte' };
export type AppMessage = { id: string; title: string; body: string; audience: Audience; active: boolean; ends_at: string | null; created_at: string };
export const PHOTO_TAGS = ['train', 'neige', 'eau', 'fjord', 'facade', 'velo', 'batiment', 'sommet', 'route', 'livre', 'lampe'];

export interface Api {
  demo: boolean;
  me(): Promise<Me | null>;
  signIn(email: string, password: string): Promise<string | null>;
  /** Installation : vrai tant qu'aucun administrateur n'existe. */
  needsAdmin(): Promise<boolean>;
  /** Crée un compte. Renvoie un message d'erreur, 'confirm' si l'adresse doit être confirmée, ou null. */
  signUp(email: string, password: string): Promise<string | null>;
  settings(): Promise<Setting[]>;
  setSetting(key: string, value: string): Promise<void>;
  signOut(): Promise<void>;
  editions(): Promise<Edition[]>;
  articles(date: string): Promise<Article[]>;
  saveArticle(id: string, patch: Partial<Article>): Promise<void>;
  saveArticles(patches: { id: string; patch: Partial<Article> }[]): Promise<void>;
  setEdition(date: string, status: Edition['status']): Promise<void>;
  sources(): Promise<Source[]>;
  saveSource(s: Partial<Source> & { id?: string }): Promise<void>;
  reports(): Promise<Report[]>;
  resolveReport(r: Report, hide: boolean): Promise<void>;
  comments(): Promise<Comment[]>;
  setComment(id: string, status: Comment['status']): Promise<void>;
  setBanned(userId: string, ban: boolean): Promise<void>;
  banned(): Promise<Profile[]>;
  dashboard(): Promise<Dashboard>;
  topArticles(): Promise<TopArticle[]>;
  readers(search: string): Promise<Reader[]>;
  deleteUser(id: string): Promise<void>;
  audit(): Promise<AuditEntry[]>;
  /** Envoie une image et renvoie son adresse publique. */
  uploadPhoto(file: File): Promise<string>;
  team(): Promise<Profile[]>;
  setRole(id: string, role: Role): Promise<void>;
  findProfile(pseudo: string): Promise<Profile | null>;
  createArticle(a: Partial<Article> & { edition_date: string; rubric_id: string }): Promise<void>;
  /** Démo : simule le moteur pas à pas. Vraie base : null (le moteur tourne sur GitHub). */
  runEngine?(onStep: (s: string) => void): Promise<void>;
  runs(): Promise<EngineRun[]>;
  flashes(): Promise<Flash[]>;
  saveFlash(f: Partial<Flash> & { id?: string }): Promise<void>;
  messages(): Promise<AppMessage[]>;
  saveMessage(m: Partial<AppMessage> & { id?: string }): Promise<void>;
  deleteMessage(id: string): Promise<void>;
}

// Page GitHub où lancer le moteur à la main (bouton « Run workflow »).
const REPO = (import.meta.env.VITE_GITHUB_REPO as string | undefined) || 'r65z40/AppRun';
export const ENGINE_URL = `https://github.com/${REPO}/actions/workflows/edition.yml`;
export const FLASH_URL = `https://github.com/${REPO}/actions/workflows/flash.yml`;

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function ok<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

function supabaseApi(sb: SupabaseClient): Api {
  const withNames = async (cs: Comment[]): Promise<Comment[]> => {
    const ids = [...new Set(cs.map((c) => c.user_id))];
    const arts = [...new Set(cs.map((c) => c.article_id))];
    const [ps, as] = await Promise.all([
      ids.length ? sb.from('profiles').select('id,pseudo').in('id', ids).then(ok<{ id: string; pseudo: string | null }[]>) : [],
      arts.length ? sb.from('articles').select('id,title').in('id', arts).then(ok<{ id: string; title: string }[]>) : [],
    ]);
    return cs.map((c) => ({ ...c, pseudo: ps.find((p) => p.id === c.user_id)?.pseudo, article_title: as.find((a) => a.id === c.article_id)?.title }));
  };
  return {
    demo: false,
    async me() {
      const { data } = await sb.auth.getUser();
      if (!data.user) return null;
      const p = await sb.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
      return { id: data.user.id, email: data.user.email ?? '', role: (p.data?.role as Role) ?? 'reader' };
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      return error ? 'Adresse ou mot de passe incorrect.' : null;
    },
    async needsAdmin() {
      const { data, error } = await sb.rpc('needs_admin');
      return !error && data === true;
    },
    async signUp(email, password) {
      const { data, error } = await sb.auth.signUp({ email, password });
      if (error) return error.message.includes('Password') ? 'Mot de passe trop court (6 caractères minimum).' : error.message;
      return data.session ? null : 'confirm';
    },
    settings: async () => ok(await sb.rpc('admin_settings')) as Setting[],
    async setSetting(key, value) {
      ok(await sb.rpc('set_setting', { k: key, v: value }));
    },
    async signOut() {
      await sb.auth.signOut();
    },
    editions: async () => sb.from('editions').select('*').order('date', { ascending: false }).limit(60).then(ok<Edition[]>),
    articles: async (date) => sb.from('articles').select('*').eq('edition_date', date).order('rank').then(ok<Article[]>),
    async saveArticle(id, patch) {
      ok(await sb.from('articles').update(patch).eq('id', id));
    },
    async saveArticles(patches) {
      for (const p of patches) ok(await sb.from('articles').update(p.patch).eq('id', p.id));
    },
    async setEdition(date, status) {
      ok(await sb.from('editions').update({ status, published_at: status === 'published' ? new Date().toISOString() : null }).eq('date', date));
    },
    sources: async () => sb.from('sources').select('*').order('name').then(ok<Source[]>),
    async saveSource(s) {
      if (s.id) ok(await sb.from('sources').update(s).eq('id', s.id));
      else ok(await sb.from('sources').insert(s));
    },
    async reports() {
      const rs = ok(await sb.from('reports').select('*').eq('resolved', false).order('created_at', { ascending: false })) as Report[];
      const cids = [...new Set(rs.map((r) => r.comment_id))];
      const cs = cids.length ? await withNames(ok(await sb.from('comments').select('*').in('id', cids)) as Comment[]) : [];
      return rs.map((r) => ({ ...r, comment: cs.find((c) => c.id === r.comment_id) }));
    },
    async resolveReport(r, hide) {
      if (hide) ok(await sb.from('comments').update({ status: 'hidden' }).eq('id', r.comment_id));
      ok(await sb.from('reports').update({ resolved: true }).eq('comment_id', r.comment_id));
    },
    comments: async () => withNames(ok(await sb.from('comments').select('*').order('created_at', { ascending: false }).limit(100)) as Comment[]),
    async setComment(id, status) {
      ok(await sb.from('comments').update({ status }).eq('id', id));
    },
    async setBanned(userId, ban) {
      ok(await sb.rpc('set_banned', { uid: userId, ban }));
    },
    banned: async () => sb.from('profiles').select('*').eq('banned', true).order('created_at', { ascending: false }).then(ok<Profile[]>),
    dashboard: async () => ok(await sb.rpc('dashboard')) as Dashboard,
    topArticles: async () => ok(await sb.rpc('top_articles')) as TopArticle[],
    readers: async (search) => ok(await sb.rpc('admin_users', { search })) as Reader[],
    async deleteUser(id) {
      ok(await sb.rpc('delete_user', { uid: id }));
    },
    audit: async () => ok(await sb.rpc('admin_audit', { lim: 300 })) as AuditEntry[],
    async uploadPhoto(file) {
      const path = `${crypto.randomUUID()}.${file.name.split('.').pop()?.toLowerCase() || 'jpg'}`;
      ok(await sb.storage.from('photos').upload(path, file, { contentType: file.type }));
      return sb.storage.from('photos').getPublicUrl(path).data.publicUrl;
    },
    team: async () => sb.from('profiles').select('*').in('role', ['moderator', 'editor', 'admin']).order('created_at').then(ok<Profile[]>),
    async setRole(id, role) {
      ok(await sb.from('profiles').update({ role }).eq('id', id));
    },
    async findProfile(pseudo) {
      return (ok(await sb.from('profiles').select('*').ilike('pseudo', pseudo).limit(1)) as Profile[])[0] ?? null;
    },
    async createArticle(a) {
      const { data } = await sb.auth.getUser();
      ok(await sb.from('editions').upsert({ date: a.edition_date }, { onConflict: 'date', ignoreDuplicates: true }));
      const last = ok(await sb.from('articles').select('rank').eq('edition_date', a.edition_date).eq('rubric_id', a.rubric_id).order('rank', { ascending: false }).limit(1)) as { rank: number }[];
      ok(await sb.from('articles').insert({ ...a, rank: (last[0]?.rank ?? -1) + 1, edited_by: data.user?.id }));
    },
    runs: async () => sb.from('engine_runs').select('*').order('started_at', { ascending: false }).limit(40).then(ok<EngineRun[]>),
    // Les dernières 48 heures, la plus récente en haut.
    flashes: async () => sb.from('flashes').select('*').gt('published_at', new Date(Date.now() - 48 * 3600e3).toISOString()).order('published_at', { ascending: false }).then(ok<Flash[]>),
    async saveFlash(f) {
      const { data } = await sb.auth.getUser();
      if (f.id) ok(await sb.from('flashes').update({ ...f, edited_by: data.user?.id }).eq('id', f.id));
      else ok(await sb.from('flashes').insert({ ...f, manual: true, edited_by: data.user?.id }));
    },
    messages: async () => sb.from('app_messages').select('*').order('created_at', { ascending: false }).limit(50).then(ok<AppMessage[]>),
    async saveMessage(m) {
      const { data } = await sb.auth.getUser();
      if (m.id) ok(await sb.from('app_messages').update(m).eq('id', m.id));
      else ok(await sb.from('app_messages').insert({ ...m, created_by: data.user?.id }));
    },
    async deleteMessage(id) {
      ok(await sb.from('app_messages').delete().eq('id', id));
    },
  };
}

export const api: Api = URL && KEY ? supabaseApi(createClient(URL, KEY)) : demoApi();
