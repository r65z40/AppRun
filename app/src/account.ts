// Comptes lecteurs et communauté, branchés sur Supabase (Auth + API REST).
// Sans base configurée, l'app reste en mode démo et ce module ne fait rien.
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { Comment } from './types';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const accountsOn = !!(URL && KEY);

type Session = { access: string; refresh: string; exp: number; uid: string; email: string };
export type Me = { uid: string; email: string; pseudo: string | null; premium: boolean; prefs: Record<string, unknown> };

/* ---------- Stockage de la session ---------- */
const SKEY = 'titre.session';
const store = {
  async get(k = SKEY): Promise<string | null> {
    try {
      if (Platform.OS === 'web') return globalThis.localStorage?.getItem(k) ?? null;
      return await SecureStore.getItemAsync(k);
    } catch { return null; }
  },
  async set(v: string | null, k = SKEY) {
    try {
      if (Platform.OS === 'web') { v ? globalThis.localStorage?.setItem(k, v) : globalThis.localStorage?.removeItem(k); return; }
      v ? await SecureStore.setItemAsync(k, v) : await SecureStore.deleteItemAsync(k);
    } catch {}
  },
};

/** Petit stockage local (ce qui doit survivre à la fermeture de l'app, rien de secret). */
export const getLocal = (k: string) => store.get(k);
export const setLocal = (k: string, v: string | null) => store.set(v, k);

/* ---------- État partagé ---------- */
let session: Session | null = null;
let me: Me | null = null;
const subs = new Set<(m: Me | null) => void>();
const emit = () => subs.forEach((f) => f(me));
export function useMe() {
  const [m, setM] = useState<Me | null>(me);
  useEffect(() => { subs.add(setM); setM(me); return () => { subs.delete(setM); }; }, []);
  return m;
}
export const currentMe = () => me;

/* ---------- Messages d'erreur en français ---------- */
export class UserError extends Error {}
function french(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('invalid login')) return 'Adresse ou mot de passe incorrect.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Un compte existe déjà avec cette adresse. Connectez-vous.';
  if (m.includes('not confirmed')) return 'Confirmez d’abord votre adresse avec le lien reçu par e-mail.';
  if (m.includes('password') && (m.includes('least') || m.includes('short') || m.includes('weak'))) return 'Mot de passe trop court : 8 caractères au moins.';
  if (m.includes('email') && (m.includes('invalid') || m.includes('valid'))) return 'Cette adresse e-mail ne semble pas valide.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Trop d’essais. Réessayez dans quelques minutes.';
  if (m.includes('profiles_pseudo_lower') || m.includes('duplicate')) return 'Ce pseudo est déjà pris.';
  if (m.includes('profiles_pseudo_format')) return 'Pseudo : 2 à 24 lettres, chiffres, points ou tirets.';
  if (m.includes('jwt') || m.includes('401')) return 'Votre session a expiré. Reconnectez-vous.';
  if (m.includes('network') || m.includes('failed to fetch')) return 'Pas de connexion. Réessayez.';
  return raw;
}

/* ---------- Appels réseau ---------- */
async function auth(path: string, body: unknown) {
  const r = await fetch(`${URL}/auth/v1/${path}`, { method: 'POST', headers: { apikey: KEY!, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new UserError(french(j.msg || j.error_description || j.message || j.error || `HTTP ${r.status}`));
  return j;
}

function take(j: { access_token: string; refresh_token: string; expires_in?: number; expires_at?: number; user: { id: string; email: string } }) {
  session = {
    access: j.access_token,
    refresh: j.refresh_token,
    exp: j.expires_at ? j.expires_at * 1000 : Date.now() + (j.expires_in ?? 3600) * 1000,
    uid: j.user.id,
    email: j.user.email,
  };
  store.set(JSON.stringify(session));
}

async function token(): Promise<string | null> {
  if (!session) return null;
  if (session.exp - Date.now() < 60_000) {
    try { take(await auth('token?grant_type=refresh_token', { refresh_token: session.refresh })); }
    catch { await signOut(); return null; }
  }
  return session.access;
}

/** Requête vers l'API de la base, au nom du lecteur connecté s'il y en a un. */
async function api<T = unknown>(path: string, init: { method?: string; body?: unknown; prefer?: string } = {}): Promise<T> {
  const t = await token();
  const headers: Record<string, string> = { apikey: KEY!, 'Content-Type': 'application/json' };
  if (t) headers.Authorization = `Bearer ${t}`;
  else if (!KEY!.startsWith('sb_')) headers.Authorization = `Bearer ${KEY}`;
  if (init.prefer) headers.Prefer = init.prefer;
  const r = await fetch(`${URL}/rest/v1/${path}`, { method: init.method ?? 'GET', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new UserError(french(j.message || j.details || `HTTP ${r.status}`));
  }
  const txt = await r.text();
  return (txt ? JSON.parse(txt) : null) as T;
}

async function loadMe() {
  if (!session) { me = null; return emit(); }
  const rows = await api<{ pseudo: string | null; premium: boolean; prefs: Record<string, unknown> | null }[]>(`profiles?select=pseudo,premium,prefs&id=eq.${session.uid}`).catch(() => []);
  me = { uid: session.uid, email: session.email, pseudo: rows[0]?.pseudo ?? null, premium: !!rows[0]?.premium, prefs: rows[0]?.prefs ?? {} };
  emit();
}

/* ---------- Compte ---------- */

/** Au lancement : reprend la session enregistrée, ou celle du lien de confirmation reçu par e-mail. */
export async function restore() {
  if (!accountsOn) return;
  if (Platform.OS === 'web' && typeof location !== 'undefined' && location.hash.includes('access_token=')) {
    const h = new URLSearchParams(location.hash.slice(1));
    const access = h.get('access_token')!;
    try {
      const u = await fetch(`${URL}/auth/v1/user`, { headers: { apikey: KEY!, Authorization: `Bearer ${access}` } }).then((r) => r.json());
      take({ access_token: access, refresh_token: h.get('refresh_token') ?? '', expires_in: Number(h.get('expires_in') ?? 3600), user: u });
    } catch {}
    history.replaceState(null, '', location.pathname + location.search);
  } else {
    const raw = await store.get();
    if (raw) try { session = JSON.parse(raw); } catch { session = null; }
  }
  if (!session || (await token())) await loadMe();
  ping();
}

/** Compte l'appareil comme lecteur actif du jour (identifiant tiré au hasard, rien de personnel). */
async function ping() {
  let d = await store.get('titre.device');
  if (!d) { d = Math.random().toString(36).slice(2) + Date.now().toString(36); await store.set(d, 'titre.device'); }
  api('rpc/ping', { method: 'POST', body: { d } }).catch(() => {});
}

/** Création de compte. Renvoie 'confirm' si Supabase demande de confirmer l'adresse par e-mail. */
export async function signUp(email: string, password: string): Promise<'ok' | 'confirm'> {
  if (password.length < 8) throw new UserError('Mot de passe trop court : 8 caractères au moins.');
  const back = Platform.OS === 'web' && typeof location !== 'undefined' ? `?redirect_to=${encodeURIComponent(location.origin + location.pathname)}` : '';
  const j = await auth(`signup${back}`, { email: email.trim(), password });
  if (!j.access_token) return 'confirm';
  take(j);
  await loadMe();
  return 'ok';
}

export async function signIn(email: string, password: string) {
  take(await auth('token?grant_type=password', { email: email.trim(), password }));
  await loadMe();
}

export async function signOut() {
  const t = session?.access;
  session = null;
  me = null;
  store.set(null);
  emit();
  if (t) fetch(`${URL}/auth/v1/logout`, { method: 'POST', headers: { apikey: KEY!, Authorization: `Bearer ${t}` } }).catch(() => {});
}

export async function resetPassword(email: string) {
  const back = Platform.OS === 'web' && typeof location !== 'undefined' ? `?redirect_to=${encodeURIComponent(location.origin + location.pathname)}` : '';
  await auth(`recover${back}`, { email: email.trim() });
}

export async function setPseudo(p: string) {
  const v = p.trim();
  if (!/^[A-Za-z0-9._-]{2,24}$/.test(v)) throw new UserError('Pseudo : 2 à 24 lettres, chiffres, points ou tirets, sans espace.');
  if (!(await api<boolean>('rpc/pseudo_free', { method: 'POST', body: { p: v } }))) throw new UserError('Ce pseudo est déjà pris.');
  await api(`profiles?id=eq.${session!.uid}`, { method: 'PATCH', body: { pseudo: v } });
  await loadMe();
}

/* ---------- Communauté ---------- */

/** Les infos de la vraie base ont un identifiant UUID ; celles de la démo, non. */
export const isLive = (id: string) => accountsOn && /^[0-9a-f-]{36}$/.test(id);

/** Réglages du lecteur (rubriques, nombre d'infos, heure, goûts) : ils le suivent sur tous ses appareils. */
export async function savePrefs(prefs: Record<string, unknown>) {
  if (!session) return;
  await api(`profiles?id=eq.${session.uid}`, { method: 'PATCH', body: { prefs } });
  if (me) me = { ...me, prefs };
}

/** Mes likes (1) et dislikes (-1), par info. */
export async function myReactions(): Promise<Record<string, 1 | -1>> {
  if (!session) return {};
  const rows = await api<{ article_id: string; value: 1 | -1 }[]>(`reactions?select=article_id,value&user_id=eq.${session.uid}`).catch(() => []);
  return Object.fromEntries(rows.map((r) => [r.article_id, r.value]));
}

export async function react(articleId: string, v: -1 | 0 | 1) {
  if (v) await api('reactions?on_conflict=user_id,article_id', { method: 'POST', body: { user_id: session!.uid, article_id: articleId, value: v }, prefer: 'resolution=merge-duplicates' });
  else await api(`reactions?user_id=eq.${session!.uid}&article_id=eq.${articleId}`, { method: 'DELETE' });
}

/** Mes réactions emoji, par info. */
export async function myEmojis(): Promise<Record<string, string>> {
  if (!session) return {};
  const rows = await api<{ article_id: string; emoji: string }[]>(`article_emojis?select=article_id,emoji&user_id=eq.${session.uid}`).catch(() => []);
  return Object.fromEntries(rows.map((r) => [r.article_id, r.emoji]));
}

export async function setEmoji(articleId: string, emoji: string | null) {
  if (emoji) await api('article_emojis?on_conflict=user_id,article_id', { method: 'POST', body: { user_id: session!.uid, article_id: articleId, emoji }, prefer: 'resolution=merge-duplicates' });
  else await api(`article_emojis?user_id=eq.${session!.uid}&article_id=eq.${articleId}`, { method: 'DELETE' });
}

const COLORS = ['#7B5CFF', '#3D7BFF', '#C86BFA', '#4fb0ff', '#9a7bff', '#FF8A7A', '#5ad1b5'];
const colorOf = (s: string) => COLORS[[...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % COLORS.length];
function ago(iso: string) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `il y a ${h} h` : `il y a ${Math.round(h / 24)} j`;
}

type Row = { id: string; text: string; pseudo: string; created_at: string; likes: number; dislikes: number; mine: number; own: boolean; premium?: boolean };
export async function loadComments(articleId: string): Promise<Comment[]> {
  const rows = await api<Row[]>('rpc/article_comments', { method: 'POST', body: { aid: articleId } });
  // L'app ajoute elle-même le vote du lecteur aux compteurs : on le retire des totaux reçus.
  return rows.map((r, i): Comment => ({
    id: r.id,
    who: r.pseudo,
    color: colorOf(r.pseudo),
    text: r.text,
    likes: r.likes - (r.mine === 1 ? 1 : 0),
    dislikes: r.dislikes - (r.mine === -1 ? 1 : 0),
    ago: ago(r.created_at),
    mine: (r.mine as -1 | 0 | 1) ?? 0,
    order: i,
    own: r.own,
    premium: !!r.premium,
  }));
}

export async function postComment(articleId: string, text: string) {
  await api('comments', { method: 'POST', body: { article_id: articleId, user_id: session!.uid, text: text.trim() } });
}

export async function voteComment(commentId: string, v: -1 | 0 | 1) {
  if (v) await api('comment_votes?on_conflict=user_id,comment_id', { method: 'POST', body: { user_id: session!.uid, comment_id: commentId, value: v }, prefer: 'resolution=merge-duplicates' });
  else await api(`comment_votes?user_id=eq.${session!.uid}&comment_id=eq.${commentId}`, { method: 'DELETE' });
}

export async function reportComment(commentId: string) {
  await api('reports?on_conflict=comment_id,user_id', { method: 'POST', body: { comment_id: commentId, user_id: session!.uid }, prefer: 'resolution=ignore-duplicates' });
}

/** Ne plus voir les commentaires de l'auteur de ce commentaire. */
export async function blockAuthor(commentId: string) {
  await api('rpc/block_author', { method: 'POST', body: { cid: commentId } });
}

export async function blockedCount(): Promise<number> {
  if (!session) return 0;
  return (await api<unknown[]>(`blocks?select=blocked_id&user_id=eq.${session.uid}`).catch(() => [])).length;
}

export async function unblockAll() {
  await api(`blocks?user_id=eq.${session!.uid}`, { method: 'DELETE' });
}

export async function deleteComment(commentId: string) {
  await api(`comments?id=eq.${commentId}`, { method: 'DELETE' });
}

