-- Journal du moteur : chaque passage (édition du matin, Dernière minute) laisse une trace lisible dans le back office.
create table if not exists public.engine_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('edition', 'flash')),
  status text not null default 'running' check (status in ('running', 'ok', 'error')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  summary text,
  stats jsonb not null default '{}'::jsonb,
  log jsonb not null default '[]'::jsonb,      -- lignes du journal, dans l'ordre
  details jsonb not null default '{}'::jsonb   -- sujets retenus, cartes écrites, infos écartées…
);
create index if not exists engine_runs_started on public.engine_runs (started_at desc);
alter table public.engine_runs enable row level security;
drop policy if exists engine_runs_staff on public.engine_runs;
create policy engine_runs_staff on public.engine_runs for select using (public.is_staff());
grant select on public.engine_runs to authenticated;

-- Photo d'illustration trouvée par le moteur (Pexels) : crédit affiché dans l'app.
alter table public.articles add column if not exists photo_credit text;
