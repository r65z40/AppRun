/**
 * API TITRE pour un hébergement chez soi (remplace Supabase).
 * Chaque requête s'exécute dans une transaction avec le rôle « anon » ou « authenticated »
 * et l'identifiant du compte : la sécurité ligne par ligne de la base décide de ce qui est permis.
 */
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

const env = (k: string, d?: string) => {
  const v = process.env[k] ?? d;
  if (v == null) throw new Error(`Variable ${k} manquante`);
  return v;
};
const DATABASE_URL = env('DATABASE_URL'); // rôle titre_api
const SECRET = new TextEncoder().encode(env('JWT_SECRET'));
if (SECRET.length < 32) throw new Error('JWT_SECRET doit faire au moins 32 caractères');
const PORT = Number(env('PORT', '8080'));
const ORIGINS = env('CORS_ORIGINS', '*').split(',').map((s) => s.trim());

export const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 10 });

type Who = { sub: string | null };
type Q = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;

/** Exécute fn dans une transaction, avec les droits du visiteur. */
async function as<T>(who: Who, fn: (q: Q) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query(who.sub ? 'set local role authenticated' : 'set local role anon');
    await c.query("select set_config('request.jwt.claim.sub', $1, true)", [who.sub ?? '']);
    const out = await fn(async (sql, params = []) => (await c.query(sql, params)).rows);
    await c.query('commit');
    return out;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

async function who(req: FastifyRequest): Promise<Who> {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return { sub: null };
  try {
    const { payload } = await jwtVerify(h.slice(7), SECRET);
    return { sub: typeof payload.sub === 'string' ? payload.sub : null };
  } catch {
    return { sub: null };
  }
}
const token = (sub: string) => new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(sub).setIssuedAt().setExpirationTime('60d').sign(SECRET);

class HttpError extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}
const need = (w: Who) => {
  if (!w.sub) throw new HttpError(401, 'Connexion nécessaire');
  return w;
};
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const id = (s: string) => {
  if (!isUuid(s)) throw new HttpError(400, 'Identifiant invalide');
  return s;
};
/** Ne garde que les champs autorisés d'un corps de requête. */
const pick = (body: unknown, keys: string[]) => {
  const o = (body ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in o) out[k] = o[k];
  return out;
};
const JSON_COLS = new Set(['facts', 'summary', 'stats', 'prefs']);
/** UPDATE table SET … WHERE key = value, avec des colonnes choisies dans une liste fixe. */
async function update(q: Q, table: string, key: string, value: unknown, patch: Record<string, unknown>) {
  const cols = Object.keys(patch);
  if (!cols.length) return 0;
  const sets = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');
  const vals = cols.map((c) => (JSON_COLS.has(c) ? JSON.stringify(patch[c]) : patch[c]));
  const rows = await q(`update ${table} set ${sets} where ${key} = $1 returning 1`, [value, ...vals]);
  return rows.length;
}

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' }, bodyLimit: 256 * 1024 });
await app.register(cors, { origin: ORIGINS.includes('*') ? true : ORIGINS });

app.setErrorHandler((e: Error & { status?: number; code?: string; statusCode?: number }, _req, reply: FastifyReply) => {
  if (e instanceof HttpError) return reply.code(e.status).send({ error: e.message });
  if (e.code === '42501') return reply.code(403).send({ error: 'Action non autorisée' }); // RLS / droits
  if (e.code === '23505') return reply.code(409).send({ error: 'Existe déjà' });
  if (e.code === '23514' || e.code === '22P02' || e.code === '23503') return reply.code(400).send({ error: 'Données invalides' });
  if (e.message === 'Modification réservée aux administrateurs') return reply.code(403).send({ error: e.message });
  if (e.statusCode && e.statusCode < 500) return reply.code(e.statusCode).send({ error: e.message });
  app.log.error(e);
  return reply.code(500).send({ error: 'Erreur serveur' });
});

app.get('/health', async () => ({ ok: true }));

/* ---------- Comptes ---------- */
const tries = new Map<string, { n: number; at: number }>();
function slowDown(key: string) {
  const t = tries.get(key);
  const now = Date.now();
  if (t && now - t.at < 15 * 60e3 && t.n >= 10) throw new HttpError(429, 'Trop de tentatives, réessayez dans 15 minutes');
  tries.set(key, t && now - t.at < 15 * 60e3 ? { n: t.n + 1, at: t.at } : { n: 1, at: now });
}

app.post('/auth/signup', async (req) => {
  const { email, password, pseudo } = pick(req.body, ['email', 'password', 'pseudo']) as Record<string, string>;
  if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Adresse e-mail invalide');
  if (typeof password !== 'string' || password.length < 8) throw new HttpError(400, 'Mot de passe : 8 caractères minimum');
  if (pseudo != null && (typeof pseudo !== 'string' || pseudo.length < 2 || pseudo.length > 24)) throw new HttpError(400, 'Pseudo : 2 à 24 caractères');
  slowDown('signup:' + req.ip);
  const hash = await bcrypt.hash(password, 11);
  const c = await pool.connect();
  let sub: string;
  try {
    const r = await c.query('insert into auth.users (email, password_hash) values (lower($1), $2) returning id', [email, hash]);
    sub = r.rows[0].id;
  } catch (e: any) {
    if (e.code === '23505') throw new HttpError(409, 'Un compte existe déjà avec cette adresse');
    throw e;
  } finally {
    c.release();
  }
  if (pseudo) await as({ sub }, (q) => q('update profiles set pseudo = $1 where id = $2', [pseudo, sub]));
  return { token: await token(sub) };
});

app.post('/auth/login', async (req) => {
  const { email, password } = pick(req.body, ['email', 'password']) as Record<string, string>;
  if (typeof email !== 'string' || typeof password !== 'string') throw new HttpError(400, 'Adresse et mot de passe requis');
  slowDown('login:' + email.toLowerCase());
  const r = await pool.query('select id, password_hash from auth.users where email = lower($1)', [email]);
  const u = r.rows[0];
  if (!u?.password_hash || !(await bcrypt.compare(password, u.password_hash))) throw new HttpError(401, 'Adresse ou mot de passe incorrect');
  tries.delete('login:' + email.toLowerCase());
  return { token: await token(u.id) };
});

app.get('/me', async (req) => {
  const w = need(await who(req));
  const [p] = await as(w, (q) => q('select id, pseudo, role, premium, prefs from profiles where id = $1', [w.sub]));
  const [u] = (await pool.query('select email from auth.users where id = $1', [w.sub])).rows;
  return { ...p, email: u?.email ?? null };
});

app.patch('/me', async (req) => {
  const w = need(await who(req));
  await as(w, (q) => update(q, 'profiles', 'id', w.sub, pick(req.body, ['pseudo', 'prefs'])));
  return { ok: true };
});

/* ---------- Lecture publique ---------- */
app.get('/edition', async (req) => {
  const w = await who(req);
  return as(w, async (q) => {
    const [ed] = await q<{ date: string }>("select to_char(date, 'YYYY-MM-DD') as date from editions where status = 'published' order by date desc limit 1");
    if (!ed) return { date: null, rubrics: [], articles: [] };
    const [rubrics, articles] = await Promise.all([
      q('select id, name from rubrics where active order by position'),
      q(`select a.id, a.rubric_id, a.rank, a.essential, a.title, a.key_sentence, a.facts, a.summary, a.photo_tag, a.photo_url,
                a.published_at, a.created_at, coalesce(s.likes, 0) as likes, coalesce(s.dislikes, 0) as dislikes, coalesce(s.comments, 0) as comments
           from articles a left join article_stats s on s.article_id = a.id
          where a.edition_date = $1 and a.status = 'published' order by a.rubric_id, a.rank`, [ed.date]),
    ]);
    const mine = w.sub ? await q('select article_id, value from reactions where user_id = $1', [w.sub]) : [];
    return { date: ed.date, rubrics, articles, reactions: mine };
  });
});

/* ---------- Réactions et commentaires ---------- */
app.put('/articles/:id/reaction', async (req) => {
  const w = need(await who(req));
  const aid = id((req.params as { id: string }).id);
  const v = Number((req.body as { value?: number })?.value);
  await as(w, (q) =>
    v === 0
      ? q('delete from reactions where user_id = $1 and article_id = $2', [w.sub, aid])
      : q('insert into reactions (user_id, article_id, value) values ($1, $2, $3) on conflict (user_id, article_id) do update set value = excluded.value', [w.sub, aid, v]),
  );
  return { ok: true };
});

app.get('/articles/:id/comments', async (req) => {
  const w = await who(req);
  const aid = id((req.params as { id: string }).id);
  return as(w, (q) =>
    q(`select c.id, c.text, c.created_at, p.pseudo, (c.user_id = auth.uid()) as mine,
              coalesce(sum(v.value) filter (where v.value = 1), 0)::int as likes,
              coalesce(-sum(v.value) filter (where v.value = -1), 0)::int as dislikes
         from comments c left join profiles_public p on p.id = c.user_id left join comment_votes_public v on v.comment_id = c.id
        where c.article_id = $1 and c.status = 'visible'
        group by c.id, p.pseudo order by c.created_at desc limit 200`, [aid]),
  );
});

app.post('/articles/:id/comments', async (req) => {
  const w = need(await who(req));
  const aid = id((req.params as { id: string }).id);
  const text = String((req.body as { text?: string })?.text ?? '').trim();
  if (!text || text.length > 70) throw new HttpError(400, 'Commentaire : 1 à 70 caractères');
  slowDown('comment:' + w.sub);
  const [c] = await as(w, (q) => q('insert into comments (article_id, user_id, text) values ($1, $2, $3) returning id, created_at', [aid, w.sub, text]));
  return c;
});

app.put('/comments/:id/vote', async (req) => {
  const w = need(await who(req));
  const cid = id((req.params as { id: string }).id);
  const v = Number((req.body as { value?: number })?.value);
  await as(w, (q) =>
    v === 0
      ? q('delete from comment_votes where user_id = $1 and comment_id = $2', [w.sub, cid])
      : q('insert into comment_votes (user_id, comment_id, value) values ($1, $2, $3) on conflict (user_id, comment_id) do update set value = excluded.value', [w.sub, cid, v]),
  );
  return { ok: true };
});

app.post('/comments/:id/report', async (req) => {
  const w = need(await who(req));
  const cid = id((req.params as { id: string }).id);
  const reason = String((req.body as { reason?: string })?.reason ?? '').slice(0, 200) || null;
  await as(w, (q) => q('insert into reports (comment_id, user_id, reason) values ($1, $2, $3) on conflict do nothing', [cid, w.sub, reason]));
  return { ok: true };
});

/* ---------- Back office (la base refuse tout à qui n'est pas de la rédaction) ---------- */
const staff = async (req: FastifyRequest) => {
  const w = need(await who(req));
  const [ok] = await as(w, (q) => q<{ s: boolean }>('select public.is_staff() as s'));
  if (!ok?.s) throw new HttpError(403, 'Réservé à la rédaction');
  return w;
};
const ARTICLE_FIELDS = ['status', 'rank', 'importance', 'essential', 'title', 'key_sentence', 'facts', 'summary', 'photo_tag', 'photo_url', 'review_notes', 'rubric_id', 'published_at'];

app.get('/admin/editions', async (req) => as(await staff(req), (q) => q("select to_char(date, 'YYYY-MM-DD') as date, status, published_at, stats from editions order by date desc limit 60")));
app.get('/admin/editions/:date/articles', async (req) => {
  const date = (req.params as { date: string }).date;
  if (!isDate(date)) throw new HttpError(400, 'Date invalide');
  return as(await staff(req), (q) => q("select *, to_char(edition_date, 'YYYY-MM-DD') as edition_date from articles where edition_date = $1 order by rank", [date]));
});
app.patch('/admin/editions/:date', async (req) => {
  const date = (req.params as { date: string }).date;
  const status = (req.body as { status?: string })?.status;
  if (!isDate(date) || !['ready', 'published', 'building'].includes(String(status))) throw new HttpError(400, 'Données invalides');
  await as(await staff(req), (q) => q('update editions set status = $2, published_at = case when $2 = \'published\' then now() else null end where date = $1', [date, status]));
  return { ok: true };
});
app.patch('/admin/articles', async (req) => {
  const w = await staff(req);
  const list = (req.body as { patches?: { id: string; patch: Record<string, unknown> }[] })?.patches;
  if (!Array.isArray(list) || list.length > 200) throw new HttpError(400, 'Liste invalide');
  await as(w, async (q) => {
    for (const p of list) await update(q, 'articles', 'id', id(p.id), { ...pick(p.patch, ARTICLE_FIELDS), edited_by: w.sub });
  });
  return { ok: true };
});
app.get('/admin/sources', async (req) => as(await staff(req), (q) => q('select * from sources order by name')));
app.post('/admin/sources', async (req) => {
  const s = pick(req.body, ['name', 'url', 'rubric_hint', 'active']);
  if (typeof s.url !== 'string' || !/^https?:\/\//.test(s.url)) throw new HttpError(400, 'Adresse invalide');
  await as(await staff(req), (q) => q('insert into sources (name, url, rubric_hint, active) values ($1, $2, $3, coalesce($4, true))', [s.name, s.url, s.rubric_hint ?? null, s.active ?? null]));
  return { ok: true };
});
app.patch('/admin/sources/:id', async (req) => {
  await as(await staff(req), (q) => update(q, 'sources', 'id', id((req.params as { id: string }).id), pick(req.body, ['name', 'url', 'rubric_hint', 'active'])));
  return { ok: true };
});
const COMMENT_SELECT = `select c.*, p.pseudo, a.title as article_title from comments c
  left join profiles p on p.id = c.user_id left join articles a on a.id = c.article_id`;
app.get('/admin/comments', async (req) => as(await staff(req), (q) => q(`${COMMENT_SELECT} order by c.created_at desc limit 100`)));
app.patch('/admin/comments/:id', async (req) => {
  const status = (req.body as { status?: string })?.status;
  if (!['visible', 'hidden'].includes(String(status))) throw new HttpError(400, 'Statut invalide');
  await as(await staff(req), (q) => q('update comments set status = $2 where id = $1', [id((req.params as { id: string }).id), status]));
  return { ok: true };
});
app.get('/admin/reports', async (req) =>
  as(await staff(req), async (q) => {
    const rs = await q<{ comment_id: string }>('select * from reports where not resolved order by created_at desc');
    const cs = rs.length ? await q<{ id: string }>(`${COMMENT_SELECT} where c.id = any($1)`, [rs.map((r) => r.comment_id)]) : [];
    return rs.map((r) => ({ ...r, comment: cs.find((c) => c.id === r.comment_id) }));
  }),
);
app.post('/admin/reports/:commentId/resolve', async (req) => {
  const cid = id((req.params as { commentId: string }).commentId);
  const hide = !!(req.body as { hide?: boolean })?.hide;
  await as(await staff(req), async (q) => {
    if (hide) await q("update comments set status = 'hidden' where id = $1", [cid]);
    await q('update reports set resolved = true where comment_id = $1', [cid]);
  });
  return { ok: true };
});
app.get('/admin/team', async (req) => as(await staff(req), (q) => q("select id, pseudo, role, premium, created_at from profiles where role in ('editor', 'admin') order by created_at")));
app.get('/admin/profiles', async (req) => {
  const pseudo = String((req.query as { pseudo?: string }).pseudo ?? '');
  const [p] = await as(await staff(req), (q) => q('select id, pseudo, role, premium, created_at from profiles where lower(pseudo) = lower($1) limit 1', [pseudo]));
  return p ?? null;
});
app.patch('/admin/profiles/:id', async (req) => {
  const role = (req.body as { role?: string })?.role;
  if (!['reader', 'editor', 'admin'].includes(String(role))) throw new HttpError(400, 'Rôle invalide');
  const n = await as(await staff(req), (q) => update(q, 'profiles', 'id', id((req.params as { id: string }).id), { role }));
  if (!n) throw new HttpError(403, 'Réservé aux administrateurs');
  return { ok: true };
});

if (process.env.NODE_ENV !== 'test') {
  await app.listen({ port: PORT, host: '0.0.0.0' });
}
export { app };
