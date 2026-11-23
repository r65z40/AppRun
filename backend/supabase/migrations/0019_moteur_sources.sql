-- Cœur des infos plus rapide et plus fiable : lecture des flux conditionnelle (rien n'est retéléchargé
-- si le média n'a rien publié), suivi de chaque source, mise à l'écart automatique d'une source morte,
-- ménage des vieilles dépêches, définitions des rubriques données à l'IA modifiables dans le back office.

-- 1. Suivi des sources ------------------------------------------------------------------------------
alter table public.sources add column if not exists etag text;
alter table public.sources add column if not exists last_modified text;
alter table public.sources add column if not exists last_count int;              -- titres dans le flux au dernier passage
alter table public.sources add column if not exists last_item_at timestamptz;   -- date de la dépêche la plus récente
alter table public.sources add column if not exists fail_count int not null default 0; -- échecs d'affilée
alter table public.sources add column if not exists disabled_reason text;       -- mise à l'écart automatique

-- Requête du moteur « dépêches des N dernières heures » : index sur la date utilisée.
create index if not exists raw_items_when on public.raw_items ((coalesce(published_at, fetched_at)) desc);

-- Statistiques par source pour le back office : titres reçus en 24 h, cartes écrites en 7 jours.
create or replace function public.source_stats()
returns table (source_id uuid, items_24h int, cards_7d int)
language sql stable security definer set search_path = public as $$
  select s.id,
         (select count(*)::int from public.raw_items r where r.source_id = s.id and r.fetched_at > now() - interval '24 hours'),
         (select count(distinct a.id)::int from public.articles a
            join public.raw_items r on r.id = any (a.raw_item_ids)
           where r.source_id = s.id and a.created_at > now() - interval '7 days' and a.status <> 'rejected')
    from public.sources s
   where public.is_staff();
$$;
revoke all on function public.source_stats() from public, anon;
grant execute on function public.source_stats() to authenticated;

-- Ménage : les dépêches de plus de N jours ne servent plus (les cartes gardent leurs liens).
create or replace function public.purge_raw_items(days int) returns int
language sql security definer set search_path = public as $$
  with d as (delete from public.raw_items where fetched_at < now() - make_interval(days => greatest(days, 2)) returning 1)
  select count(*)::int from d;
$$;
revoke all on function public.purge_raw_items(int) from public, anon, authenticated;

-- 2. Rubriques : ce que l'IA range dans chacune (modifiable dans IA > Rubriques) --------------------
alter table public.rubrics add column if not exists ai_hint text;
update public.rubrics r set ai_hint = v.hint from (values
  ('france', 'politique, société, justice, faits marquants en France'),
  ('monde', 'international, diplomatie, conflits, élections étrangères'),
  ('eco', 'emploi, entreprises, prix, budget, consommation'),
  ('tech', 'numérique, intelligence artificielle, smartphones, jeux vidéo, réseaux sociaux, cybersécurité'),
  ('science', 'recherche, espace, découvertes, archéologie'),
  ('sante', 'médecine, hôpital, maladies, alimentation, bien-être'),
  ('ecologie', 'climat, environnement, biodiversité, énergie, catastrophes naturelles'),
  ('sport', 'résultats, compétitions, transferts'),
  ('culture', 'cinéma, séries, musique, livres, expositions, patrimoine'),
  ('people', 'célébrités, télé, divertissement, familles royales')
) as v(id, hint) where r.id = v.id and r.ai_hint is null;

-- 3. Nouveaux réglages (page IA) --------------------------------------------------------------------
insert into public.setting_keys (key) values
  ('AI_CONCURRENCY'), ('MAX_ITEMS'), ('UPDATE_WINDOW_HOURS'), ('LIVE_MAX_CARDS'),
  ('FLASH_WINDOW_HOURS'), ('SOURCE_MAX_FAILS'), ('RAW_RETENTION_DAYS'), ('FETCH_TIMEOUT')
on conflict do nothing;
