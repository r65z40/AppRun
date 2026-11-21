-- TITRE : mise en route en une fois (généré par npm run setup-sql, ne pas modifier à la main).
-- Supabase > SQL Editor > New query > coller tout ce fichier > Run.

-- ===== supabase/migrations/0001_init.sql
-- TITRE : schéma initial (Supabase / Postgres)
-- Lecture publique des infos publiées ; écriture réservée à l'équipe (back office) et au moteur.

create extension if not exists pgcrypto;

-- Rubriques ------------------------------------------------------------
create table public.rubrics (
  id text primary key,
  name text not null,
  position int not null default 0,
  active boolean not null default true
);
insert into public.rubrics (id, name, position) values
  ('france', 'France', 1), ('monde', 'Monde', 2), ('eco', 'Éco', 3),
  ('tech', 'Tech', 4), ('sport', 'Sport', 5), ('culture', 'Culture', 6);

-- Profils (un par compte Supabase Auth) ------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  pseudo text unique check (char_length(pseudo) between 2 and 24),
  role text not null default 'reader' check (role in ('reader', 'editor', 'admin')),
  premium boolean not null default false,
  prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('editor', 'admin'));
$$;

-- Sources (flux RSS des médias) -------------------------------------------
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null unique,
  rubric_hint text references public.rubrics (id),
  active boolean not null default true,
  last_fetch_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

-- Ce que le moteur a récupéré (titre + chapô, jamais l'article complet) ---------
create table public.raw_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources (id) on delete cascade,
  guid text not null,
  title text not null,
  description text not null default '',
  link text not null,
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  unique (source_id, guid)
);
create index raw_items_published on public.raw_items (published_at desc);

-- Éditions (une par jour) --------------------------------------------------
create table public.editions (
  date date primary key,
  status text not null default 'building' check (status in ('building', 'ready', 'published')),
  published_at timestamptz,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Infos au format TITRE ------------------------------------------------------
create table public.articles (
  id uuid primary key default gen_random_uuid(),
  edition_date date not null references public.editions (date) on delete cascade,
  rubric_id text not null references public.rubrics (id),
  status text not null default 'draft' check (status in ('draft', 'published', 'rejected')),
  rank int not null default 0,              -- ordre dans la rubrique (0 = en tête)
  importance int not null default 5 check (importance between 1 and 10),
  essential boolean not null default false, -- sujet majeur proposé à tout le monde
  title text not null check (char_length(title) <= 90),
  key_sentence text not null,
  facts jsonb not null,                     -- [{text, source, url}] x3, gras en <b>
  summary jsonb not null,                   -- [contexte, ce qui change, et après]
  photo_tag text,
  photo_url text,
  raw_item_ids uuid[] not null default '{}',
  review_notes text[] not null default '{}', -- problèmes repérés par les contrôles automatiques
  model text,
  edited_by uuid references auth.users (id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index articles_edition on public.articles (edition_date, rubric_id, rank);

-- Réactions, commentaires, signalements ------------------------------------------------
create table public.reactions (
  user_id uuid not null references auth.users (id) on delete cascade,
  article_id uuid not null references public.articles (id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 70),
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now()
);
create index comments_article on public.comments (article_id, created_at desc);

create table public.comment_votes (
  user_id uuid not null references auth.users (id) on delete cascade,
  comment_id uuid not null references public.comments (id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  primary key (user_id, comment_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  reason text,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

-- Compteurs affichés dans l'app (agrège les réactions de tout le monde, infos publiées seulement) --
create view public.article_stats as
select a.id as article_id,
  coalesce(sum(case when r.value = 1 then 1 else 0 end), 0)::int as likes,
  coalesce(sum(case when r.value = -1 then 1 else 0 end), 0)::int as dislikes,
  (select count(*) from public.comments c where c.article_id = a.id and c.status = 'visible')::int as comments
from public.articles a left join public.reactions r on r.article_id = a.id
where a.status = 'published'
group by a.id;

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger articles_touch before update on public.articles
for each row execute function public.touch_updated_at();

-- Sécurité ligne par ligne -----------------------------------------------------
alter table public.rubrics enable row level security;
alter table public.profiles enable row level security;
alter table public.sources enable row level security;
alter table public.raw_items enable row level security;
alter table public.editions enable row level security;
alter table public.articles enable row level security;
alter table public.reactions enable row level security;
alter table public.comments enable row level security;
alter table public.comment_votes enable row level security;
alter table public.reports enable row level security;

create policy rubrics_read on public.rubrics for select using (true);
create policy rubrics_staff on public.rubrics for all using (public.is_staff()) with check (public.is_staff());

create policy profiles_self_read on public.profiles for select using (id = auth.uid() or public.is_staff());
create policy profiles_self_insert on public.profiles for insert with check (id = auth.uid() and role = 'reader');
create policy profiles_self_update on public.profiles for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()));
create policy profiles_staff on public.profiles for all using (public.is_staff()) with check (public.is_staff());

create policy sources_staff on public.sources for all using (public.is_staff()) with check (public.is_staff());
create policy raw_items_staff on public.raw_items for select using (public.is_staff());

create policy editions_read on public.editions for select using (status = 'published' or public.is_staff());
create policy editions_staff on public.editions for all using (public.is_staff()) with check (public.is_staff());

create policy articles_read on public.articles for select using (status = 'published' or public.is_staff());
create policy articles_staff on public.articles for all using (public.is_staff()) with check (public.is_staff());

create policy reactions_own on public.reactions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy comments_read on public.comments for select using (status = 'visible' or user_id = auth.uid() or public.is_staff());
create policy comments_insert on public.comments for insert with check (user_id = auth.uid() and status = 'visible');
create policy comments_delete_own on public.comments for delete using (user_id = auth.uid());
create policy comments_staff on public.comments for update using (public.is_staff()) with check (public.is_staff());

create policy votes_own on public.comment_votes for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy reports_insert on public.reports for insert with check (user_id = auth.uid());
create policy reports_staff on public.reports for all using (public.is_staff()) with check (public.is_staff());

grant usage on schema public to anon, authenticated;
grant select on public.rubrics, public.editions, public.articles, public.article_stats to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ===== supabase/migrations/0002_roles.sql
-- Seuls les admins changent les rôles ; la rédaction peut lire les profils (pseudos des commentaires).
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

drop policy if exists profiles_staff on public.profiles;
create policy profiles_staff_read on public.profiles for select using (public.is_staff());
create policy profiles_admin on public.profiles for all using (public.is_admin()) with check (public.is_admin());

-- Pour donner l'accès au back office au premier compte (à lancer une fois dans le SQL Editor) :
--   update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'vous@exemple.fr');
-- (le profil est créé automatiquement à l'inscription, voir ci-dessous)

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Garde-fou : un lecteur ne peut ni changer son rôle ni se passer Premium lui-même.
-- (Le serveur — clé service, auth.uid() vide — et les admins le peuvent.)
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and (new.role is distinct from old.role or new.premium is distinct from old.premium) then
    raise exception 'Modification réservée aux administrateurs';
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
for each row execute function public.guard_profile();

-- ===== supabase/migrations/0003_flashes.sql
-- Dernière minute : infos majeures de la journée, publiées au fil de l'eau.
create table public.flashes (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'published' check (status in ('published', 'hidden')),
  rubric_id text references public.rubrics (id),
  importance int not null default 8 check (importance between 1 and 10),
  title text not null check (char_length(title) <= 90),
  sentence text not null check (char_length(sentence) <= 220),
  sources jsonb not null default '[]'::jsonb,   -- [{source, url}]
  raw_item_ids uuid[] not null default '{}',
  manual boolean not null default false,        -- ajoutée à la main par la rédaction
  model text,
  edited_by uuid references auth.users (id),
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index flashes_published on public.flashes (published_at desc);
create trigger flashes_touch before update on public.flashes
for each row execute function public.touch_updated_at();

alter table public.flashes enable row level security;
-- Le public voit les infos publiées des dernières 24 heures.
create policy flashes_read on public.flashes for select
  using ((status = 'published' and published_at > now() - interval '24 hours') or public.is_staff());
create policy flashes_staff on public.flashes for all using (public.is_staff()) with check (public.is_staff());
grant select on public.flashes to anon;
grant select, insert, update, delete on public.flashes to authenticated;

-- ===== supabase/migrations/0004_journal_photos.sql
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

-- ===== supabase/migrations/0005_settings.sql
-- Réglages du moteur, modifiables dans le back office (page Réglages) au lieu des secrets GitHub.
-- Les clés ne sont jamais renvoyées en clair au navigateur : on n'affiche que leurs 4 derniers caractères.
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);
alter table public.app_settings enable row level security;
-- Aucune politique : ni le public ni les comptes ne lisent la table directement.
revoke all on public.app_settings from anon, authenticated;

-- Liste des réglages pour l'administrateur, valeurs secrètes masquées.
create or replace function public.admin_settings()
returns table (key text, value text, is_set boolean, updated_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  return query
    select s.key,
           case when s.key like '%_KEY' then '••••' || right(s.value, 4) else s.value end,
           true, s.updated_at
      from public.app_settings s;
end $$;

-- Enregistrer (ou effacer avec une valeur vide) un réglage.
create or replace function public.set_setting(k text, v text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  if k not in ('ANTHROPIC_API_KEY', 'PEXELS_API_KEY', 'TITRE_MODEL', 'AUTO_PUBLISH', 'FLASH_AUTO_PUBLISH', 'FLASH_ENABLED', 'PER_RUBRIC') then
    raise exception 'Réglage inconnu : %', k;
  end if;
  if coalesce(trim(v), '') = '' then
    delete from public.app_settings where key = k;
  else
    insert into public.app_settings (key, value, updated_at, updated_by) values (k, trim(v), now(), auth.uid())
    on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
  end if;
end $$;
revoke all on function public.admin_settings() from public, anon;
revoke all on function public.set_setting(text, text) from public, anon;
grant execute on function public.admin_settings() to authenticated;
grant execute on function public.set_setting(text, text) to authenticated;

-- Installation : le tout premier compte créé devient administrateur.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role)
  values (new.id, case when exists (select 1 from public.profiles where role = 'admin') then 'reader' else 'admin' end)
  on conflict (id) do nothing;
  return new;
end $$;

-- Le back office sait s'il reste un administrateur à créer (sans rien révéler d'autre).
create or replace function public.needs_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select not exists (select 1 from public.profiles where role = 'admin');
$$;
grant execute on function public.needs_admin() to anon, authenticated;

-- ===== supabase/migrations/0006_community.sql
-- Comptes lecteurs et communauté : commentaires publics avec pseudo, votes, signalements.

-- Pseudo : lettres, chiffres, point, tiret, tiret bas.
alter table public.profiles drop constraint if exists profiles_pseudo_format;
alter table public.profiles add constraint profiles_pseudo_format
  check (pseudo is null or pseudo ~ '^[A-Za-z0-9._-]{2,24}$');

-- Commentaires d'une info, avec le pseudo de l'auteur, les votes et le vote du lecteur connecté.
-- (Les profils restent privés : seule cette fonction expose le pseudo.)
create or replace function public.article_comments(aid uuid)
returns table (id uuid, text text, pseudo text, created_at timestamptz, likes int, dislikes int, mine smallint, own boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.text, coalesce(p.pseudo, 'lecteur'), c.created_at,
         coalesce(sum(case when v.value = 1 then 1 else 0 end), 0)::int,
         coalesce(sum(case when v.value = -1 then 1 else 0 end), 0)::int,
         coalesce(max(case when v.user_id = auth.uid() then v.value end), 0)::smallint,
         coalesce(c.user_id = auth.uid(), false)
    from public.comments c
    join public.articles a on a.id = c.article_id and a.status = 'published'
    left join public.profiles p on p.id = c.user_id
    left join public.comment_votes v on v.comment_id = c.id
   where c.article_id = aid and c.status = 'visible'
   group by c.id, p.pseudo
   order by c.created_at desc
   limit 200;
$$;
grant execute on function public.article_comments(uuid) to anon, authenticated;

-- Garde-fous à l'écriture d'un commentaire : un pseudo, une info publiée, pas plus de 5 par minute.
create or replace function public.guard_comment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_staff() then return new; end if;
  if not exists (select 1 from public.profiles where id = new.user_id and pseudo is not null) then
    raise exception 'Choisissez un pseudo avant de commenter';
  end if;
  if not exists (select 1 from public.articles where id = new.article_id and status = 'published') then
    raise exception 'Cette info n''est plus en ligne';
  end if;
  if (select count(*) from public.comments where user_id = new.user_id and created_at > now() - interval '1 minute') >= 5 then
    raise exception 'Doucement : attendez un instant avant de commenter à nouveau';
  end if;
  new.text := trim(new.text);
  return new;
end $$;
drop trigger if exists comments_guard on public.comments;
create trigger comments_guard before insert on public.comments
for each row execute function public.guard_comment();

-- Modération automatique : un commentaire signalé par 3 lecteurs différents est masqué
-- en attendant la décision de l'équipe (page Modération du back office).
create or replace function public.auto_hide_reported() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.reports where comment_id = new.comment_id and not resolved) >= 3 then
    update public.comments set status = 'hidden' where id = new.comment_id and status = 'visible';
  end if;
  return new;
end $$;
drop trigger if exists reports_auto_hide on public.reports;
create trigger reports_auto_hide after insert on public.reports
for each row execute function public.auto_hide_reported();

-- Le lecteur peut changer son propre vote.
drop policy if exists votes_own on public.comment_votes;
create policy votes_own on public.comment_votes for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Un pseudo libre ? (pour l'écran de création de compte)
create or replace function public.pseudo_free(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles where lower(pseudo) = lower(p) and id is distinct from auth.uid());
$$;
grant execute on function public.pseudo_free(text) to anon, authenticated;

create unique index if not exists profiles_pseudo_lower on public.profiles (lower(pseudo));

-- ===== supabase/migrations/0007_unsplash.sql
-- Pexels ne délivre plus de nouvelles clés : la clé Unsplash rejoint les réglages du back office.
create or replace function public.set_setting(k text, v text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  if k not in ('ANTHROPIC_API_KEY', 'UNSPLASH_ACCESS_KEY', 'PEXELS_API_KEY', 'TITRE_MODEL', 'AUTO_PUBLISH', 'FLASH_AUTO_PUBLISH', 'FLASH_ENABLED', 'PER_RUBRIC') then
    raise exception 'Réglage inconnu : %', k;
  end if;
  if coalesce(trim(v), '') = '' then
    delete from public.app_settings where key = k;
  else
    insert into public.app_settings (key, value, updated_at, updated_by) values (k, trim(v), now(), auth.uid())
    on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
  end if;
end $$;

-- ===== supabase/migrations/0008_reglages_ia.sql
-- Réglages complets de l'IA, de la sélection, de la publication et de la Dernière minute.
create or replace function public.set_setting(k text, v text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  if k not in (
    'ANTHROPIC_API_KEY', 'UNSPLASH_ACCESS_KEY', 'PEXELS_API_KEY',
    'ENGINE_PAUSED', 'TITRE_MODEL', 'TITRE_EFFORT', 'AI_GUIDELINES', 'AI_AVOID',
    'WINDOW_HOURS', 'PER_RUBRIC', 'MAX_CARDS', 'MAX_ESSENTIAL', 'MIN_IMPORTANCE', 'MIN_SOURCES',
    'AUTO_PUBLISH', 'AUTO_FIX', 'PUBLISH_FLAGGED', 'PUBLISH_MIN_IMPORTANCE',
    'FLASH_ENABLED', 'FLASH_AUTO_PUBLISH', 'FLASH_MIN_IMPORTANCE', 'FLASH_MIN_SOURCES', 'FLASH_MAX_PER_DAY'
  ) then
    raise exception 'Réglage inconnu : %', k;
  end if;
  if char_length(coalesce(v, '')) > 2000 then raise exception 'Valeur trop longue (2 000 caractères au plus)'; end if;
  if coalesce(trim(v), '') = '' then
    delete from public.app_settings where key = k;
  else
    insert into public.app_settings (key, value, updated_at, updated_by) values (k, trim(v), now(), auth.uid())
    on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
  end if;
end $$;

-- ===== supabase/seed.sql
-- Sources de départ : flux RSS publics (titre + chapô).
-- À vérifier une par une : les adresses changent et certaines peuvent exiger un accord.
insert into public.sources (name, url, rubric_hint) values
  ('franceinfo', 'https://www.francetvinfo.fr/titres.rss', null),
  ('Le Monde', 'https://www.lemonde.fr/rss/une.xml', null),
  ('Libération', 'https://www.liberation.fr/arc/outboundfeeds/rss-all/?outputType=xml', null),
  ('20 Minutes', 'https://www.20minutes.fr/feeds/rss-une.xml', null),
  ('France 24', 'https://www.france24.com/fr/rss', 'monde'),
  ('RFI', 'https://www.rfi.fr/fr/rss', 'monde'),
  ('Les Echos', 'https://syndication.lesechos.fr/rss/rss_une.xml', 'eco'),
  ('Numerama', 'https://www.numerama.com/feed/', 'tech'),
  ('L''Équipe', 'https://dwh.lequipe.fr/api/edito/rss?path=/', 'sport'),
  ('Ouest-France', 'https://www.ouest-france.fr/rss/une', 'france')
on conflict (url) do nothing;

-- ===== Dernière étape : devenir administrateur
-- 1. Créez votre compte : Authentication > Users > Add user (adresse + mot de passe).
-- 2. Remplacez l'adresse ci-dessous, sélectionnez ces deux lignes et cliquez sur Run.
-- update public.profiles set role = 'admin'
--  where id = (select id from auth.users where email = 'vous@exemple.fr');
