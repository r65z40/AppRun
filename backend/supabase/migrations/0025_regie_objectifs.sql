-- Régie publicitaire, suite : emplacements (Mon édition, Dernière minute, rubriques), objectifs d'affichages avec
-- rythme régulier jusqu'à la date de fin, priorité, et comptage fiable (sans doublon, rattrapage hors ligne, anti-abus).
-- La fréquence des pubs (une toutes les X infos) se règle dans le back office, page Publicité (réglage APP_RULES).
-- Rejouable sans risque.

-- 1. Campagnes : emplacements, priorité, rythme --------------------------------------------------------
-- max_views devient l'« objectif d'affichages » : la campagne s'arrête quand il est atteint.
alter table public.ad_campaigns add column if not exists placements text[] not null default '{edition,flash,rubrics}';
alter table public.ad_campaigns add column if not exists priority smallint not null default 2;  -- 1 haute, 2 normale, 3 remplissage
alter table public.ad_campaigns add column if not exists pacing text not null default 'even';   -- even = régulier jusqu'à la fin, fast = au plus vite
do $$ begin
  alter table public.ad_campaigns add constraint ad_campaigns_placements check (cardinality(placements) > 0 and placements <@ array['edition', 'flash', 'rubrics']);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.ad_campaigns add constraint ad_campaigns_priority check (priority between 1 and 3);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.ad_campaigns add constraint ad_campaigns_pacing check (pacing in ('even', 'fast'));
exception when duplicate_object then null; end $$;

-- 2. Statistiques par jour ET par emplacement ---------------------------------------------------------
alter table public.ad_stats add column if not exists placement text not null default 'edition';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ad_stats_pkey' and array_length(conkey, 1) = 3) then
    alter table public.ad_stats drop constraint if exists ad_stats_pkey;
    alter table public.ad_stats add constraint ad_stats_pkey primary key (campaign_id, day, placement);
  end if;
end $$;

-- 3. Chaque affichage, un par ligne, gardé 35 jours : empêche les doublons et les abus -----------------------
-- Aucun identifiant de lecteur : seulement des empreintes (appareil, adresse réseau) qui ne servent qu'aux limites.
create table if not exists public.ad_impressions (
  id uuid primary key,                         -- tiré au hasard par l'app : un renvoi ne compte jamais deux fois
  campaign_id uuid not null references public.ad_campaigns (id) on delete cascade,
  placement text not null check (placement in ('edition', 'flash', 'rubrics')),
  device_hash text not null,
  ip_hash text,
  day date not null,
  at timestamptz not null,
  clicked_at timestamptz
);
create index if not exists ad_impressions_campaign on public.ad_impressions (campaign_id, at);
create index if not exists ad_impressions_device on public.ad_impressions (device_hash, day);
create index if not exists ad_impressions_ip on public.ad_impressions (ip_hash, day);
create index if not exists ad_impressions_at on public.ad_impressions (at);
alter table public.ad_impressions enable row level security;
revoke all on public.ad_impressions from anon, authenticated;

-- 4. Rythme : chaque campagne à objectif est accélérée ou freinée pour finir pile à sa date de fin ------------
-- Part de la journée déjà écoulée, en affichages : d'après l'heure des affichages des 7 derniers jours
-- (les lecteurs lisent surtout le matin), ou de 6 h à 23 h faute d'historique.
create or replace function public.ad_day_fraction() returns numeric
language sql stable security definer set search_path = public as $$
  with now_p as (select (now() at time zone 'Europe/Paris') t),
  hist as (
    select count(*) filter (where (i.at at time zone 'Europe/Paris')::time <= (select t::time from now_p))::numeric n_before, count(*)::numeric n_all
      from public.ad_impressions i
     where i.at >= now() - interval '7 days' and i.day < (select t::date from now_p)
  )
  select case when n_all >= 200 then greatest(0.02, n_before / n_all)
              else least(1, greatest(0.02, (extract(epoch from (select t::time from now_p)) / 3600 - 6) / 17)) end
    from hist;
$$;

-- Une ligne par campagne non terminée : livré, objectif du jour, retard ou avance, coefficient appliqué.
create or replace function public.ad_pacing()
returns table (id uuid, delivered bigint, today bigint, need_today numeric, expected_now numeric, days_left int, factor numeric)
language sql stable security definer set search_path = public as $$
  with d as (select (now() at time zone 'Europe/Paris')::date today, public.ad_day_fraction() frac),
  c as (
    select c.*,
           coalesce((select sum(s.views) from public.ad_stats s where s.campaign_id = c.id and s.day < d.today), 0)::bigint before_today,
           coalesce((select sum(s.views) from public.ad_stats s where s.campaign_id = c.id and s.day = d.today), 0)::bigint done_today,
           case when c.ends_on is null then null else (c.ends_on - greatest(d.today, c.starts_on) + 1) end left_days,
           d.frac
      from public.ad_campaigns c, d
     where c.ends_on is null or c.ends_on >= d.today
  ),
  n as (
    select c.*, case when c.max_views is not null and c.left_days is not null
                     then greatest(0, c.max_views - c.before_today)::numeric / greatest(c.left_days, 1) end need
      from c
  )
  select n.id, n.before_today + n.done_today, n.done_today, round(n.need, 1), round(n.need * n.frac, 1), n.left_days,
         case
           when n.need is null or n.pacing = 'fast' then 1
           when n.done_today >= ceil(n.need * 1.05) then 0                             -- part du jour faite : elle attend demain
           else round(least(5, greatest(0.2, (n.need * n.frac + 1) / (n.done_today + 1))), 2)  -- en retard : jusqu'à ×5 ; en avance : jusqu'à ×0,2
         end
    from n;
$$;
revoke execute on function public.ad_pacing() from public, anon, authenticated;  -- lue via live_ads et ad_report

-- Pour le back office : rythme de chaque campagne (administrateurs seulement).
create or replace function public.ad_report()
returns table (id uuid, delivered bigint, today bigint, need_today numeric, expected_now numeric, days_left int, factor numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  return query select * from public.ad_pacing();
end $$;
grant execute on function public.ad_report() to authenticated;

-- 5. Ce que l'app affiche : poids final = poids × priorité × rythme -------------------------------------
drop function if exists public.live_ads();
create or replace function public.live_ads()
returns table (id uuid, advertiser text, title text, body text, cta text, url text, image_url text, rubrics text[], weight numeric, placements text[])
language sql stable security definer set search_path = public as $$
  with live as (
    select c.*, p.factor from public.ad_campaigns c join public.ad_pacing() p on p.id = c.id
     where c.active
       and c.starts_on <= (now() at time zone 'Europe/Paris')::date
       and (c.max_views is null or p.delivered < c.max_views)
       and (p.factor > 0 or c.exclusive)  -- un sponsor exclusif garde toujours la place
  )
  select l.id, l.advertiser, l.title, l.body, l.cta, l.url, l.image_url, l.rubrics,
         -- arrondi grossier : l'app ne remélange pas son fil pour un petit écart
         round((l.weight * case l.priority when 1 then 5 when 3 then 0.2 else 1 end * l.factor)::numeric, 1),
         l.placements
    from live l
   where l.exclusive or not exists (select 1 from live x where x.exclusive);
$$;
grant execute on function public.live_ads() to anon, authenticated;

-- 6. Comptage : l'app envoie ses affichages et clics par paquets ---------------------------------------
-- ev = [{ "i": identifiant tiré au hasard, "c": campagne, "p": emplacement, "k": "view" | "click", "t": heure (ms) }]
-- Règles : un identifiant ne compte qu'une fois ; un clic seulement sur un affichage compté ; heure ramenée aux
-- 72 dernières heures et dans les dates de la campagne ; au plus 30 affichages par campagne et 300 en tout par
-- appareil et par jour, et 3 000 par adresse réseau et par jour (au-delà, ignorés).
create or replace function public.ad_hits(d text, ev jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare
  e jsonb; cid uuid; iid uuid; place text; at_ts timestamptz; dday date; dh text; ih text; n int := 0; ok boolean;
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
    if e->>'k' = 'click' then
      update public.ad_impressions set clicked_at = now() where id = iid and device_hash = dh and clicked_at is null
        returning campaign_id, day, placement into cid, dday, place;
      if found then
        insert into public.ad_stats (campaign_id, day, placement, clicks) values (cid, dday, place, 1)
        on conflict (campaign_id, day, placement) do update set clicks = public.ad_stats.clicks + 1;
        n := n + 1;
      end if;
      continue;
    end if;
    at_ts := least(now(), greatest(now() - interval '72 hours', coalesce(to_timestamp((e->>'t')::double precision / 1000), now())));
    dday := (at_ts at time zone 'Europe/Paris')::date;
    select true into ok from public.ad_campaigns c
     where c.id = cid and c.starts_on <= dday and (c.ends_on is null or c.ends_on >= dday);
    if ok is null then continue; end if;
    if (select count(*) from public.ad_impressions where device_hash = dh and day = dday and campaign_id = cid) >= 30
       or (select count(*) from public.ad_impressions where device_hash = dh and day = dday) >= 300
       or (ih is not null and (select count(*) from public.ad_impressions where ip_hash = ih and day = dday) >= 3000) then
      continue;
    end if;
    insert into public.ad_impressions (id, campaign_id, placement, device_hash, ip_hash, day, at)
    values (iid, cid, place, dh, ih, dday, at_ts) on conflict (id) do nothing;
    if found then
      insert into public.ad_stats (campaign_id, day, placement, views) values (cid, dday, place, 1)
      on conflict (campaign_id, day, placement) do update set views = public.ad_stats.views + 1;
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
grant execute on function public.ad_hits(text, jsonb) to anon, authenticated;

-- Anciennes versions de l'app (avant cette mise à jour) : comptées dans Mon édition, sans protection.
create or replace function public.ad_hit(cid uuid, click boolean default false) returns void
language sql security definer set search_path = public as $$
  insert into public.ad_stats (campaign_id, day, placement, views, clicks)
  select c.id, (now() at time zone 'Europe/Paris')::date, 'edition', case when click then 0 else 1 end, case when click then 1 else 0 end
    from public.ad_campaigns c where c.id = cid
  on conflict (campaign_id, day, placement) do update
    set views = public.ad_stats.views + excluded.views, clicks = public.ad_stats.clicks + excluded.clicks;
$$;
grant execute on function public.ad_hit(uuid, boolean) to anon, authenticated;

-- Ménage : le détail des affichages part après 35 jours (les totaux par jour restent). Appelé par la Dernière minute.
create or replace function public.ad_purge() returns void
language sql security definer set search_path = public as $$
  delete from public.ad_impressions where at < now() - interval '35 days';
$$;
revoke execute on function public.ad_purge() from public, anon, authenticated;
