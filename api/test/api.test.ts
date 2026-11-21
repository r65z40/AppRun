// Test de bout en bout de l'API sur une base Postgres neuve : node --test (via tsx).
import { execSync } from 'node:child_process';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';

const ADMIN_DB = process.env.TEST_ADMIN_DB ?? 'postgresql://postgres@/postgres?host=/var/tmp&port=54329';
const DB = ADMIN_DB.replace(/\/postgres(\?|$)/, '/titre_api_test$1');
const API_DB = DB.replace('postgres@', 'titre_api:test-password@');
const B = '../backend';
const sh = (c: string) => execSync(c, { stdio: 'pipe', encoding: 'utf8' });
sh(`psql "${ADMIN_DB}" -qc "drop database if exists titre_api_test" -c "create database titre_api_test"`);
sh(`psql "${DB}" -v ON_ERROR_STOP=1 -q -f ${B}/selfhost/0000_auth.sql -f ${B}/supabase/migrations/0001_init.sql -f ${B}/supabase/migrations/0002_roles.sql -f ${B}/supabase/migrations/0003_public_views.sql -f ${B}/supabase/seed.sql`);
sh(`psql "${DB}" -v ON_ERROR_STOP=1 -q -v api_password="'test-password'" -f ${B}/selfhost/api-role.sql`);
sh(`cd ${B} && DATABASE_URL="${DB}" MOCK_AI=1 npx tsx src/run.ts --fixtures test/feeds`);

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = API_DB;
process.env.JWT_SECRET = 'x'.repeat(40);
const { app, pool } = await import('../src/server.ts');
after(async () => { await app.close(); await pool.end(); });

const call = async (method: string, url: string, token?: string, body?: unknown) => {
  const r = await app.inject({ method: method as any, url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload: body as any });
  return { status: r.statusCode, body: r.body ? JSON.parse(r.body) : null };
};

let reader = '', admin = '';
test('inscription et connexion', async () => {
  let r = await call('POST', '/auth/signup', undefined, { email: 'lea@exemple.fr', password: 'motdepasse1', pseudo: 'lea' });
  assert.equal(r.status, 200); reader = r.body.token;
  r = await call('POST', '/auth/signup', undefined, { email: 'lea@exemple.fr', password: 'autre-mdp-1' });
  assert.equal(r.status, 409);
  r = await call('POST', '/auth/login', undefined, { email: 'LEA@exemple.fr', password: 'faux-mdp' });
  assert.equal(r.status, 401);
  r = await call('POST', '/auth/signup', undefined, { email: 'fen@exemple.fr', password: 'motdepasse2', pseudo: 'fen' });
  admin = r.body.token;
  sh(`psql "${DB}" -qc "update profiles set role = 'admin' where pseudo = 'fen'"`);
  r = await call('GET', '/me', admin);
  assert.equal(r.body.role, 'admin');
});

test('rien n\'est public avant validation', async () => {
  const r = await call('GET', '/edition');
  assert.equal(r.body.date, null);
});

test('un lecteur n\'a pas accès au back office', async () => {
  assert.equal((await call('GET', '/admin/editions', reader)).status, 403);
  assert.equal((await call('GET', '/admin/editions')).status, 401);
  const me = await call('GET', '/me', reader);
  assert.equal((await call('PATCH', `/admin/profiles/${me.body.id}`, reader, { role: 'admin' })).status, 403);
});

let aid = '';
test('la rédaction publie l\'édition', async () => {
  const eds = await call('GET', '/admin/editions', admin);
  assert.equal(eds.status, 200);
  const date = eds.body[0].date;
  const arts = await call('GET', `/admin/editions/${date}/articles`, admin);
  assert.ok(arts.body.length > 3);
  const clean = arts.body.filter((a: any) => !a.review_notes.length);
  const r = await call('PATCH', '/admin/articles', admin, { patches: clean.map((a: any) => ({ id: a.id, patch: { status: 'published', published_at: new Date().toISOString(), owner: 'pirate' } })) });
  assert.equal(r.status, 200);
  assert.equal((await call('PATCH', `/admin/editions/${date}`, admin, { status: 'published' })).status, 200);
  const pub = await call('GET', '/edition');
  assert.equal(pub.body.date, date);
  assert.equal(pub.body.articles.length, clean.length);
  aid = pub.body.articles[0].id;
});

let cid = '';
test('réagir, commenter, voter, signaler', async () => {
  assert.equal((await call('PUT', `/articles/${aid}/reaction`, reader, { value: 1 })).status, 200);
  assert.equal((await call('PUT', `/articles/${aid}/reaction`)).status, 401);
  const c = await call('POST', `/articles/${aid}/comments`, reader, { text: 'Très clair, merci' });
  assert.equal(c.status, 200); cid = c.body.id;
  assert.equal((await call('POST', `/articles/${aid}/comments`, reader, { text: 'x'.repeat(71) })).status, 400);
  assert.equal((await call('PUT', `/comments/${cid}/vote`, admin, { value: 1 })).status, 200);
  const list = await call('GET', `/articles/${aid}/comments`);
  assert.equal(list.body[0].pseudo, 'lea');
  assert.equal(list.body[0].likes, 1);
  const ed = await call('GET', '/edition', reader);
  const a = ed.body.articles.find((x: any) => x.id === aid);
  assert.equal(a.likes, 1); assert.equal(a.comments, 1);
  assert.equal(ed.body.reactions[0].value, 1);
  assert.equal((await call('POST', `/comments/${cid}/report`, admin, { reason: 'test' })).status, 200);
});

test('modération', async () => {
  const rs = await call('GET', '/admin/reports', admin);
  assert.equal(rs.body.length, 1);
  assert.equal(rs.body[0].comment.text, 'Très clair, merci');
  assert.equal((await call('POST', `/admin/reports/${cid}/resolve`, admin, { hide: true })).status, 200);
  assert.equal((await call('GET', `/articles/${aid}/comments`)).body.length, 0);
});

test('équipe : ajouter quelqu\'un à la rédaction', async () => {
  const p = await call('GET', '/admin/profiles?pseudo=LEA', admin);
  assert.equal(p.body.pseudo, 'lea');
  assert.equal((await call('PATCH', `/admin/profiles/${p.body.id}`, admin, { role: 'editor' })).status, 200);
  assert.equal((await call('GET', '/admin/team', admin)).body.length, 2);
  // Une rédactrice ne peut pas se promouvoir admin
  assert.equal((await call('PATCH', `/admin/profiles/${p.body.id}`, reader, { role: 'admin' })).status, 403);
});
