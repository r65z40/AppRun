-- Des infos publiées chaque jour : pause du moteur bien visible (et à durée limitée),
-- minimum d'infos en Dernière minute, au moins une carte par mise à jour de la journée.

-- Nouveaux réglages (back office > IA).
insert into public.setting_keys (key) values ('FLASH_MIN_PER_DAY'), ('FLASH_RELAX_IMPORTANCE'), ('LIVE_MIN_CARDS') on conflict do nothing;

-- Une pause « jusqu'à ce qu'on relance » posée avant cette version reprend toute seule 24 h après avoir été posée :
-- le moteur ne doit plus jamais rester arrêté des jours sans que personne ne s'en rende compte.
update public.app_settings
   set value = to_char((updated_at + interval '24 hours') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
 where key = 'ENGINE_PAUSED' and value = '1';

-- État du moteur pour le bandeau du back office (toute l'équipe le voit, pas seulement les administrateurs).
create or replace function public.engine_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  day_start timestamptz := date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris';
  p record;
  paused boolean := false;
  until timestamptz;
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
                                   from public.sources where active and fail_count > 0), '[]'::jsonb)
  );
end $$;
revoke all on function public.engine_status() from public, anon;
grant execute on function public.engine_status() to authenticated;
