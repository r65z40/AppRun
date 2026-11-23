-- Régie publicitaire : campagnes pilotées depuis le back office (page Publicité).
-- Sponsor exclusif, dates, ciblage par rubrique, rotation pondérée, plafond d'affichages, statistiques et revenus estimés.
-- Rejouable sans risque (create … if not exists / or replace).

-- 1. Campagnes -----------------------------------------------------------------------------------
create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),              -- nom interne
  advertiser text not null check (char_length(advertiser) between 1 and 40),  -- « SPONSORISÉ · … »
  title text not null check (char_length(title) between 1 and 60),
  body text not null default '' check (char_length(body) <= 160),
  cta text not null default 'Découvrir' check (char_length(cta) between 1 and 24),
  url text not null check (url ~ '^https://'),
  image_url text,
  active boolean not null default true,      -- en pause quand faux
  exclusive boolean not null default false,  -- sponsor exclusif : seul à passer pendant ses dates
  starts_on date not null default current_date,
  ends_on date,
  rubrics text[] not null default '{}',      -- vide = tout le monde ; sinon lecteurs qui suivent une de ces rubriques
  weight int not null default 1 check (weight between 1 and 10),
  max_views int check (max_views > 0),       -- campagne arrêtée une fois ce nombre d'affichages atteint
  pricing text not null default 'cpm' check (pricing in ('cpm', 'flat')),
  price numeric(10, 2) not null default 0 check (price >= 0), -- € pour 1 000 affichages, ou forfait total
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);
alter table public.ad_campaigns enable row level security;
drop policy if exists ads_admin on public.ad_campaigns;
create policy ads_admin on public.ad_campaigns for all using (public.is_admin()) with check (public.is_admin());
revoke all on public.ad_campaigns from anon;
grant select, insert, update, delete on public.ad_campaigns to authenticated;

-- 2. Affichages et clics, une ligne par campagne et par jour ----------------------------------------
create table if not exists public.ad_stats (
  campaign_id uuid not null references public.ad_campaigns (id) on delete cascade,
  day date not null,
  views int not null default 0,
  clicks int not null default 0,
  primary key (campaign_id, day)
);
alter table public.ad_stats enable row level security;
drop policy if exists ad_stats_admin on public.ad_stats;
create policy ad_stats_admin on public.ad_stats for select using (public.is_admin());
revoke all on public.ad_stats from anon;
grant select on public.ad_stats to authenticated;

-- 3. Ce que l'app affiche : campagnes en cours, sans les prix. S'il y a un sponsor exclusif, lui seul.
-- (Refaite par 0025 avec d'autres colonnes : on la supprime d'abord pour que ce fichier puisse repasser.)
drop function if exists public.live_ads();
create or replace function public.live_ads()
returns table (id uuid, advertiser text, title text, body text, cta text, url text, image_url text, rubrics text[], weight int)
language sql stable security definer set search_path = public as $$
  with live as (
    select c.* from public.ad_campaigns c
     where c.active
       and c.starts_on <= (now() at time zone 'Europe/Paris')::date
       and (c.ends_on is null or c.ends_on >= (now() at time zone 'Europe/Paris')::date)
       and (c.max_views is null or coalesce((select sum(s.views) from public.ad_stats s where s.campaign_id = c.id), 0) < c.max_views)
  )
  select l.id, l.advertiser, l.title, l.body, l.cta, l.url, l.image_url, l.rubrics, l.weight from live l
   where l.exclusive or not exists (select 1 from live x where x.exclusive);
$$;
grant execute on function public.live_ads() to anon, authenticated;

-- 4. L'app compte un affichage ou un clic (anonyme : aucune donnée sur le lecteur).
-- (plpgsql : vérifiée à l'exécution, ce fichier repasse même après 0025 qui change la clé de ad_stats.)
create or replace function public.ad_hit(cid uuid, click boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.ad_stats (campaign_id, day, views, clicks)
  select c.id, (now() at time zone 'Europe/Paris')::date, case when click then 0 else 1 end, case when click then 1 else 0 end
    from public.ad_campaigns c where c.id = cid
  on conflict (campaign_id, day) do update
    set views = public.ad_stats.views + excluded.views, clicks = public.ad_stats.clicks + excluded.clicks;
end $$;
grant execute on function public.ad_hit(uuid, boolean) to anon, authenticated;
