// Back office branché sur l'API TITRE hébergée chez soi (VITE_API_URL), sans Supabase.
import type { Api, Me } from './data';

const KEY = 'titre-admin-token';
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = (t: string | null) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch {} };

export function httpApi(base: string): Api {
  let token = read();
  const call = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const r = await fetch(base.replace(/\/$/, '') + path, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = r.status === 204 ? null : await r.json().catch(() => null);
    if (!r.ok) throw new Error(data?.error ?? `Erreur ${r.status}`);
    return data as T;
  };
  return {
    demo: false,
    async me() {
      if (!token) return null;
      try {
        const m = await call<{ id: string; email: string; role: Me['role'] }>('GET', '/me');
        return { id: m.id, email: m.email, role: m.role };
      } catch {
        token = null; write(null);
        return null;
      }
    },
    async signIn(email, password) {
      try {
        token = (await call<{ token: string }>('POST', '/auth/login', { email, password })).token;
        write(token);
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : 'Connexion impossible';
      }
    },
    async signOut() { token = null; write(null); },
    editions: () => call('GET', '/admin/editions'),
    articles: (date) => call('GET', `/admin/editions/${date}/articles`),
    saveArticle: (id, patch) => call('PATCH', '/admin/articles', { patches: [{ id, patch }] }),
    saveArticles: (patches) => call('PATCH', '/admin/articles', { patches }),
    setEdition: (date, status) => call('PATCH', `/admin/editions/${date}`, { status }),
    sources: () => call('GET', '/admin/sources'),
    saveSource: (s) => (s.id ? call('PATCH', `/admin/sources/${s.id}`, s) : call('POST', '/admin/sources', s)),
    reports: () => call('GET', '/admin/reports'),
    resolveReport: (r, hide) => call('POST', `/admin/reports/${r.comment_id}/resolve`, { hide }),
    comments: () => call('GET', '/admin/comments'),
    setComment: (id, status) => call('PATCH', `/admin/comments/${id}`, { status }),
    team: () => call('GET', '/admin/team'),
    setRole: (id, role) => call('PATCH', `/admin/profiles/${id}`, { role }),
    findProfile: (pseudo) => call('GET', `/admin/profiles?pseudo=${encodeURIComponent(pseudo)}`),
  };
}
