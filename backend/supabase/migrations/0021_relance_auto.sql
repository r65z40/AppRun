-- Relance automatique du moteur depuis Supabase : GitHub saute la plupart de ses passages programmés
-- (aucun entre le 22/11 20 h 25 et le 23/11 après-midi). pg_cron, dans la base, appelle GitHub toutes les
-- 10 minutes pour lancer les workflows, avec un jeton saisi dans IA > Clés (GITHUB_DISPATCH_KEY).
-- Sans jeton, rien ne part. Sans pg_cron ou pg_net (base locale de test), la migration passe quand même.
insert into public.setting_keys (key) values ('GITHUB_DISPATCH_KEY'), ('GITHUB_REPO') on conflict do nothing;

-- Journal des relances (dernière réponse de GitHub visible dans le back office).
create table if not exists public.dispatch_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  workflow text not null,
  request_id bigint
);
alter table public.dispatch_log enable row level security;
drop policy if exists dispatch_log_staff on public.dispatch_log;
create policy dispatch_log_staff on public.dispatch_log for select using (public.is_staff());

do $$
begin
  create extension if not exists pg_net with schema extensions;
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron ou pg_net indisponible : relance automatique non installée (%)', sqlerrm;
end $$;

-- Lance un workflow GitHub (workflow_dispatch). Ne fait rien sans jeton ou sans pg_net.
create or replace function public.dispatch_workflow(wf text, inputs jsonb default '{}')
returns void language plpgsql security definer set search_path = public, extensions as $$
declare tok text; repo text; rid bigint;
begin
  select value into tok from public.app_settings where key = 'GITHUB_DISPATCH_KEY';
  select value into repo from public.app_settings where key = 'GITHUB_REPO';
  if coalesce(tok, '') = '' or to_regnamespace('net') is null then return; end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3)' into rid using
    format('https://api.github.com/repos/%s/actions/workflows/%s/dispatches', coalesce(nullif(repo, ''), 'r65z40/AppRun'), wf),
    jsonb_build_object('ref', 'main', 'inputs', inputs),
    jsonb_build_object('Authorization', 'Bearer ' || tok, 'Accept', 'application/vnd.github+json',
                       'User-Agent', 'titre-moteur', 'X-GitHub-Api-Version', '2022-11-28');
  insert into public.dispatch_log (workflow, request_id) values (wf || coalesce(' ' || nullif(inputs->>'mode', ''), ''), rid);
  delete from public.dispatch_log where at < now() - interval '7 days';
end $$;
revoke all on function public.dispatch_workflow(text, jsonb) from public, anon, authenticated;

-- Horaires (UTC ; Paris = UTC+1 en hiver) : les mêmes que les workflows GitHub.
do $$
begin
  if to_regnamespace('cron') is null then return; end if;
  perform cron.schedule('titre-flash', '*/10 5-22 * * *', $j$select public.dispatch_workflow('flash.yml')$j$);
  perform cron.schedule('titre-edition', '30 4,5,6 * * *', $j$select public.dispatch_workflow('edition.yml', '{"mode": "once"}')$j$);
  perform cron.schedule('titre-mise-a-jour', '45 8-21 * * *', $j$select public.dispatch_workflow('edition.yml', '{"mode": "update"}')$j$);
  perform cron.schedule('titre-sources', '45 3 * * *', $j$select public.dispatch_workflow('sources.yml')$j$);
exception when others then
  raise notice 'pg_cron : horaires non installés (%)', sqlerrm;
end $$;

-- Dernières relances, pour le back office.
create or replace function public.dispatch_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when public.is_staff() then jsonb_build_object(
    'cron', to_regnamespace('cron') is not null,
    'token', exists (select 1 from public.app_settings where key = 'GITHUB_DISPATCH_KEY' and value <> ''),
    'last', (select max(at) from public.dispatch_log)) end;
$$;
revoke all on function public.dispatch_status() from public, anon;
grant execute on function public.dispatch_status() to authenticated;
