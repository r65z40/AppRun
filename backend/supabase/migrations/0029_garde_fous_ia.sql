-- Garde-fous de l'IA : dépense (plafond par passage, anti-boucle, alerte à 80 %, historique)
-- et publication (ton neutre, rien d'inventé, limite par jour, tout dépublier d'un passage).

insert into public.setting_keys (key) values
  ('AI_BUDGET_RUN'), ('AI_BUDGET_ALERT'), ('AI_MAX_CALLS'),
  ('PUBLISH_MAX_PER_DAY'), ('GUARD_RULES'), ('GUARD_AI_CHECK'), ('GUARD_WORDS')
on conflict do nothing;

-- Chaque carte et info publiée par le moteur garde son passage : on peut tout retirer d'un coup.
alter table public.articles add column if not exists run_id uuid references public.engine_runs (id) on delete set null;
alter table public.flashes add column if not exists run_id uuid references public.engine_runs (id) on delete set null;
create index if not exists articles_run on public.articles (run_id) where run_id is not null;
create index if not exists flashes_run on public.flashes (run_id) where run_id is not null;

-- Dépense estimée de l'IA jour par jour (heure de Paris), pour l'historique de IA > Pilotage.
create or replace function public.ai_spend_history(days int default 30)
returns table (day date, edition numeric, flash numeric, runs bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Réservé à l''équipe'; end if;
  return query
    select (started_at at time zone 'Europe/Paris')::date,
           round(coalesce(sum(public.run_cost(stats)) filter (where kind = 'edition'), 0), 2),
           round(coalesce(sum(public.run_cost(stats)) filter (where kind = 'flash'), 0), 2),
           count(*)
      from public.engine_runs
     where started_at > now() - make_interval(days => least(greatest(days, 1), 366))
     group by 1 order by 1 desc;
end $$;
revoke all on function public.ai_spend_history(int) from public, anon;
grant execute on function public.ai_spend_history(int) to authenticated;

-- Arrêt d'urgence : retire de l'app tout ce qu'un passage a publié. Les cartes repassent « À relire », les infos sont masquées.
create or replace function public.unpublish_run(run uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a int; f int;
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  update public.articles set status = 'draft', published_at = null,
         review_notes = array_append(review_notes, 'dépubliée en urgence (tout le passage retiré)')
   where run_id = run and status = 'published';
  get diagnostics a = row_count;
  update public.flashes set status = 'hidden' where run_id = run and status = 'published';
  get diagnostics f = row_count;
  insert into public.audit_log (actor, action, target, detail)
  values (auth.uid(), 'Passage dépublié', run::text, a || ' carte(s), ' || f || ' info(s) Dernière minute');
  return jsonb_build_object('articles', a, 'flashes', f);
end $$;
revoke all on function public.unpublish_run(uuid) from public, anon;
grant execute on function public.unpublish_run(uuid) to authenticated;

-- Bandeau du back office : on ajoute la part des plafonds de dépense déjà utilisée (alerte à 80 % par défaut).
create or replace function public.engine_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  day_start timestamptz := date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris';
  month_start timestamptz := date_trunc('month', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris';
  p record;
  paused boolean := false;
  until timestamptz;
  cap_day numeric := coalesce((select nullif(value, '')::numeric from public.app_settings where key = 'AI_BUDGET_DAY' and value ~ '^[0-9.]+$'), 0);
  cap_month numeric := coalesce((select nullif(value, '')::numeric from public.app_settings where key = 'AI_BUDGET_MONTH' and value ~ '^[0-9.]+$'), 0);
begin
  if not public.is_moderator() then raise exception 'Réservé à l''équipe'; end if;
  select a.value, a.updated_at, u.email into p
    from public.app_settings a left join auth.users u on u.id = a.updated_by where a.key = 'ENGINE_PAUSED';
  if p.value = '1' then paused := true;
  elsif p.value is not null and p.value <> '0' then
    begin until := p.value::timestamptz; paused := until > now(); exception when others then paused := false; end;
  end if;
  return jsonb_build_object(
    'paused', paused,
    'paused_until', case when paused then until end,
    'paused_at', case when paused then p.updated_at end,
    'paused_by', case when paused then p.email end,
    'ai_off', coalesce((select value = '1' from public.app_settings where key = 'AI_OFF'), false),
    'articles_today', (select count(*) from public.articles where status = 'published' and published_at >= day_start),
    'flashes_today', (select count(*) from public.flashes where status = 'published' and published_at >= day_start),
    'last_published', greatest((select max(published_at) from public.articles where status = 'published'),
                               (select max(published_at) from public.flashes where status = 'published')),
    'failing_sources', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'error', last_error, 'fails', fail_count) order by name)
                                   from public.sources where active and fail_count > 0), '[]'::jsonb),
    -- Part des plafonds déjà dépensée, en % (null sans plafond).
    'budget_day_pct', case when cap_day > 0 then round(100 * (select coalesce(sum(public.run_cost(stats)), 0) from public.engine_runs where started_at >= day_start) / cap_day) end,
    'budget_month_pct', case when cap_month > 0 then round(100 * (select coalesce(sum(public.run_cost(stats)), 0) from public.engine_runs where started_at >= month_start) / cap_month) end,
    'budget_alert', coalesce((select value::int from public.app_settings where key = 'AI_BUDGET_ALERT' and value ~ '^[0-9]+$'), 80)
  );
end $$;
revoke all on function public.engine_status() from public, anon;
grant execute on function public.engine_status() to authenticated;
