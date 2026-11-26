-- Régie : on compte aussi les impressions, c'est-à-dire chaque pub apparue à l'écran, même une fraction de seconde.
-- Trois chiffres par campagne : impressions (pub apparue), affichages (restée 1 s, ce qui sert aux objectifs et au
-- prix pour 1 000) et clics. Le taux de visibilité = affichages / impressions. Mêmes protections qu'avant.
-- Rejouable sans risque.

-- 1. Une ligne par impression ; viewed_at est rempli quand elle devient un affichage (1 s à l'écran) ----------
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ad_impressions' and column_name = 'viewed_at') then
    alter table public.ad_impressions add column viewed_at timestamptz;
    update public.ad_impressions set viewed_at = at;           -- avant : chaque ligne était un affichage
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ad_stats' and column_name = 'impressions') then
    alter table public.ad_stats add column impressions int not null default 0;
    update public.ad_stats set impressions = views;            -- avant : chaque affichage était aussi une impression
  end if;
end $$;

-- 2. Comptage ---------------------------------------------------------------------------------------------
-- ev = [{ "i": identifiant tiré au hasard, "c": campagne, "p": emplacement, "k": "imp" | "view" | "click", "t": heure (ms) }]
-- imp : la pub vient d'apparaître. view : elle est restée 1 s (si l'impression n'est pas arrivée, comptée avec).
-- click : seulement sur un affichage déjà compté. Plafonds par appareil et par connexion inchangés (sur les impressions).
create or replace function public.ad_hits(d text, ev jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare
  e jsonb; cid uuid; iid uuid; place text; at_ts timestamptz; dday date; dh text; ih text; n int := 0; ok boolean; k text; r record;
  hdr json := nullif(current_setting('request.headers', true), '')::json;
begin
  if char_length(coalesce(d, '')) not between 8 and 64 or jsonb_typeof(ev) <> 'array' then return 0; end if;
  dh := md5('ad:' || d);
  ih := md5('ip:' || nullif(split_part(coalesce(hdr->>'x-forwarded-for', hdr->>'x-real-ip', ''), ',', 1), ''));
  for e in select value from jsonb_array_elements(ev) limit 50 loop
    begin
      iid := (e->>'i')::uuid; cid := (e->>'c')::uuid;
    exception when others then continue; end;
    place := coalesce(e->>'p', 'edition');
    if place not in ('edition', 'flash', 'rubrics') then continue; end if;
    k := coalesce(e->>'k', 'view');
    if k = 'click' then
      update public.ad_impressions set clicked_at = now() where id = iid and device_hash = dh and clicked_at is null and viewed_at is not null
        returning campaign_id, day, placement into cid, dday, place;
      if found then
        insert into public.ad_stats (campaign_id, day, placement, clicks) values (cid, dday, place, 1)
        on conflict (campaign_id, day, placement) do update set clicks = public.ad_stats.clicks + 1;
        n := n + 1;
      end if;
      continue;
    end if;
    if k not in ('imp', 'view') then continue; end if;
    at_ts := least(now(), greatest(now() - interval '72 hours', coalesce(to_timestamp((e->>'t')::double precision / 1000), now())));
    -- Affichage d'une impression déjà comptée : on la complète.
    if k = 'view' then
      update public.ad_impressions set viewed_at = at_ts where id = iid and device_hash = dh and viewed_at is null
        returning campaign_id, day, placement into r;   -- dans r : sans ligne trouvée, cid et place restent intacts
      if found then
        insert into public.ad_stats (campaign_id, day, placement, views) values (r.campaign_id, r.day, r.placement, 1)
        on conflict (campaign_id, day, placement) do update set views = public.ad_stats.views + 1;
        n := n + 1;
        continue;
      end if;
    end if;
    dday := (at_ts at time zone 'Europe/Paris')::date;
    ok := null;
    select true into ok from public.ad_campaigns c
     where c.id = cid and c.starts_on <= dday and (c.ends_on is null or c.ends_on >= dday);
    if ok is null then continue; end if;
    if (select count(*) from public.ad_impressions where device_hash = dh and day = dday and campaign_id = cid) >= 30
       or (select count(*) from public.ad_impressions where device_hash = dh and day = dday) >= 300
       or (ih is not null and (select count(*) from public.ad_impressions where ip_hash = ih and day = dday) >= 3000) then
      continue;
    end if;
    insert into public.ad_impressions (id, campaign_id, placement, device_hash, ip_hash, day, at, viewed_at)
    values (iid, cid, place, dh, ih, dday, at_ts, case when k = 'view' then at_ts end) on conflict (id) do nothing;
    if found then
      insert into public.ad_stats (campaign_id, day, placement, impressions, views) values (cid, dday, place, 1, case when k = 'view' then 1 else 0 end)
      on conflict (campaign_id, day, placement) do update
        set impressions = public.ad_stats.impressions + 1, views = public.ad_stats.views + excluded.views;
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
grant execute on function public.ad_hits(text, jsonb) to anon, authenticated;
