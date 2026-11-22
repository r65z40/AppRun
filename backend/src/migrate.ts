// Installe et met à jour la base toute seule : applique les migrations pas encore passées.
// Plus besoin de coller du SQL dans Supabase.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, q } from './db.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase');

export async function migrate(log: (...a: unknown[]) => void = console.log): Promise<string[]> {
  await q(`create table if not exists public._titre_migrations (name text primary key, applied_at timestamptz not null default now())`);
  await q(`alter table public._titre_migrations enable row level security`);
  let done = new Set((await q<{ name: string }>('select name from public._titre_migrations')).map((r) => r.name));

  // Base installée à la main avant ce système : on reconnaît ce qui est déjà là.
  if (!done.size) {
    const has = async (t: string) => (await q<{ ok: boolean }>('select to_regclass($1) is not null as ok', [t]))[0].ok;
    const already: string[] = [];
    if (await has('public.rubrics')) already.push('0001_init.sql', '0002_roles.sql', 'seed.sql');
    if (await has('public.flashes')) already.push('0003_flashes.sql');
    if (await has('public.engine_runs')) already.push('0004_journal_photos.sql');
    if (await has('public.app_settings')) already.push('0005_settings.sql');
    // setup.sql récent (0010 change la forme de article_comments : 0006 et 0009 ne peuvent plus repasser après).
    if (await has('public.app_messages')) already.push('0006_community.sql', '0007_unsplash.sql', '0008_reglages_ia.sql', '0009_moderation_gestion.sql', '0010_lecteurs.sql');
    for (const n of already) await q('insert into public._titre_migrations (name) values ($1) on conflict do nothing', [n]);
    done = new Set(already);
  }

  const files = [...readdirSync(join(DIR, 'migrations')).filter((f) => f.endsWith('.sql')).sort(), 'seed.sql'];
  const applied: string[] = [];
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = readFileSync(f === 'seed.sql' ? join(DIR, f) : join(DIR, 'migrations', f), 'utf8');
    const c = await pool.connect();
    try {
      await c.query('begin');
      await c.query(sql);
      await c.query('insert into public._titre_migrations (name) values ($1)', [f]);
      await c.query('commit');
      applied.push(f);
      log(`Base : ${f} appliqué`);
    } catch (e) {
      await c.query('rollback');
      throw new Error(`Installation de la base (${f}) : ${e instanceof Error ? e.message : e}`);
    } finally {
      c.release();
    }
  }
  return applied;
}
