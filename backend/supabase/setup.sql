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

-- ===== supabase/migrations/0009_moderation_gestion.sql
-- Modération renforcée (filtre d'insultes, blocage, bannissement, rôle Modération),
-- tableau de bord (lecteurs actifs, coût de l'IA) et photos envoyées depuis le back office.

-- 0. Journal des actions (équipe et IA), lisible par les administrateurs ------------------------------
create table if not exists public.audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor uuid references auth.users (id) on delete set null, -- vide = l'IA ou le moteur
  action text not null,
  target text,
  detail text
);
create index if not exists audit_log_at on public.audit_log (at desc);
alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;

-- 1. Rôle « Modération » : modère les commentaires sans toucher aux infos -----------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('reader', 'moderator', 'editor', 'admin'));

create or replace function public.is_moderator() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('moderator', 'editor', 'admin'));
$$;

drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments for select using (status = 'visible' or user_id = auth.uid() or public.is_moderator());
drop policy if exists comments_staff on public.comments;
create policy comments_staff on public.comments for update using (public.is_moderator()) with check (public.is_moderator());
drop policy if exists reports_staff on public.reports;
create policy reports_staff on public.reports for all using (public.is_moderator()) with check (public.is_moderator());
drop policy if exists profiles_staff_read on public.profiles;
create policy profiles_staff_read on public.profiles for select using (public.is_moderator());

-- 2. Filtre automatique des insultes ----------------------------------------------------------
-- Texte ramené à des lettres simples : minuscules, sans accents, chiffres « leet » (c0nn4rd),
-- ponctuation remplacée par des espaces, lettres répétées réduites (connnnard).
create or replace function public.norm_text(t text) returns text
language sql immutable as $$
  select regexp_replace(regexp_replace(
    translate(lower(coalesce(t, '')), 'àâäéèêëîïôöùûüç01345@$', 'aaaeeeeiioouuucoieasas'),
    '[^a-z]+', ' ', 'g'), '(.)\1+', '\1', 'g');
$$;

-- Liste de base + mots ajoutés par l'équipe (Réglages > Modération, séparés par des virgules).
create or replace function public.has_insult(t text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.norm_text(t) ~ ('\m(' || string_agg(trim(public.norm_text(w)), '|') || ')(e|s|es)?\M'), false)
    from unnest(array[
      'connard', 'connasse', 'salope', 'salaud', 'encule', 'enculer', 'batard', 'pute', 'fils de pute', 'fdp',
      'ntm', 'niquer', 'ta gueule', 'tg', 'pd', 'pede', 'tapette', 'gouine', 'negre', 'bougnoule',
      'youpin', 'abruti', 'cretin', 'enfoire', 'petasse', 'poufiasse', 'trouduc', 'sous merde'
    ] || string_to_array(coalesce((select value from public.app_settings where key = 'BANNED_WORDS'), ''), ',')) w
   where trim(public.norm_text(w)) <> '';
$$;
grant execute on function public.has_insult(text) to anon, authenticated;

-- 3. Bannissement depuis le back office --------------------------------------------------------
alter table public.profiles add column if not exists banned boolean not null default false;

-- Un lecteur ne peut ni changer son rôle, ni se passer Premium, ni lever son bannissement ;
-- son pseudo passe aussi par le filtre d'insultes.
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and (new.role is distinct from old.role or new.premium is distinct from old.premium) then
    raise exception 'Modification réservée aux administrateurs';
  end if;
  if auth.uid() is not null and not public.is_moderator() and new.banned is distinct from old.banned then
    raise exception 'Modification réservée à l''équipe';
  end if;
  if new.pseudo is distinct from old.pseudo and public.has_insult(new.pseudo) then
    raise exception 'Ce pseudo n''est pas autorisé';
  end if;
  return new;
end $$;

-- Bannir : plus de commentaires ni de signalements, et ses commentaires disparaissent de l'app.
create or replace function public.set_banned(uid uuid, ban boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_moderator() then raise exception 'Réservé à l''équipe'; end if;
  if ban and exists (select 1 from public.profiles where id = uid and role <> 'reader') then
    raise exception 'Retirez d''abord cette personne de l''équipe';
  end if;
  update public.profiles set banned = ban where id = uid;
  if ban then
    perform set_config('titre.reason', 'auteur banni', true);
    update public.comments set status = 'hidden' where user_id = uid and status = 'visible';
    update public.reports set resolved = true where comment_id in (select id from public.comments where user_id = uid);
  end if;
end $$;
revoke all on function public.set_banned(uuid, boolean) from public, anon;
grant execute on function public.set_banned(uuid, boolean) to authenticated;

drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert
  with check (user_id = auth.uid() and not exists (select 1 from public.profiles where id = auth.uid() and banned));

-- Garde-fous à l'écriture d'un commentaire : compte non banni, pseudo, info publiée, pas d'insulte, 5 par minute au plus.
create or replace function public.guard_comment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_staff() then return new; end if;
  if exists (select 1 from public.profiles where id = new.user_id and banned) then
    raise exception 'Votre compte ne peut plus commenter';
  end if;
  if not exists (select 1 from public.profiles where id = new.user_id and pseudo is not null) then
    raise exception 'Choisissez un pseudo avant de commenter';
  end if;
  if not exists (select 1 from public.articles where id = new.article_id and status = 'published') then
    raise exception 'Cette info n''est plus en ligne';
  end if;
  if public.has_insult(new.text) then
    raise exception 'Ce commentaire contient un mot interdit. Reformulez sans insulte.';
  end if;
  if (select count(*) from public.comments where user_id = new.user_id and created_at > now() - interval '1 minute') >= 5 then
    raise exception 'Doucement : attendez un instant avant de commenter à nouveau';
  end if;
  new.text := trim(new.text);
  return new;
end $$;

-- 4. Blocage d'un lecteur par un autre lecteur ---------------------------------------------------
create table if not exists public.blocks (
  user_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_id)
);
alter table public.blocks enable row level security;
drop policy if exists blocks_own on public.blocks;
create policy blocks_own on public.blocks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, delete on public.blocks to authenticated;

-- Bloquer l'auteur d'un commentaire (l'app ne connaît que le commentaire, pas l'auteur).
create or replace function public.block_author(cid uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.blocks (user_id, blocked_id)
  select auth.uid(), c.user_id from public.comments c where c.id = cid and auth.uid() is not null and c.user_id <> auth.uid()
  on conflict do nothing;
$$;
revoke all on function public.block_author(uuid) from public, anon;
grant execute on function public.block_author(uuid) to authenticated;

-- Commentaires d'une info, sans ceux des comptes que le lecteur a bloqués.
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
     and not exists (select 1 from public.blocks b where b.user_id = auth.uid() and b.blocked_id = c.user_id)
   group by c.id, p.pseudo
   order by c.created_at desc
   limit 200;
$$;

-- 5. Tableau de bord ----------------------------------------------------------------------------
-- Lecteurs actifs : l'app signale une ouverture par jour et par appareil (identifiant au hasard, rien de personnel).
create table if not exists public.visits (
  day date not null default (now() at time zone 'Europe/Paris')::date,
  device text not null check (char_length(device) between 8 and 64),
  user_id uuid references auth.users (id) on delete set null,
  primary key (day, device)
);
alter table public.visits enable row level security;
revoke all on public.visits from anon, authenticated;

create or replace function public.ping(d text) returns void
language sql security definer set search_path = public as $$
  insert into public.visits (device, user_id) values (d, auth.uid())
  on conflict (day, device) do update set user_id = coalesce(excluded.user_id, public.visits.user_id);
$$;
grant execute on function public.ping(text) to anon, authenticated;

-- Coût d'un passage du moteur, en dollars.
-- shortcut: tarifs Anthropic de novembre 2026 ($/million de jetons) écrits ici, à mettre à jour s'ils changent.
create or replace function public.run_cost(stats jsonb) returns numeric
language sql immutable as $$
  select (coalesce((stats->'ai'->>'input')::numeric, 0) * p.i + coalesce((stats->'ai'->>'output')::numeric, 0) * p.o) / 1e6
    from (select case when stats->>'model' like 'claude-haiku%' then 0.10 when stats->>'model' like 'claude-sonnet%' then 2 else 4 end as i,
                 case when stats->>'model' like 'claude-haiku%' then 0.50 when stats->>'model' like 'claude-sonnet%' then 10 else 20 end as o) p;
$$;

create or replace function public.dashboard() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare today date := (now() at time zone 'Europe/Paris')::date;
begin
  if not public.is_staff() then raise exception 'Réservé à l''équipe'; end if;
  return jsonb_build_object(
    'active_today', (select count(*) from visits where day = today),
    'active_7', (select count(distinct device) from visits where day > today - 7),
    'active_30', (select count(distinct device) from visits where day > today - 30),
    'accounts', (select count(*) from profiles),
    'accounts_7', (select count(*) from profiles where created_at > now() - interval '7 days'),
    'premium', (select count(*) from profiles where premium),
    'comments_7', (select count(*) from comments where created_at > now() - interval '7 days'),
    'likes_7', (select count(*) from reactions where value = 1 and created_at > now() - interval '7 days'),
    'reports_open', (select count(distinct comment_id) from reports where not resolved),
    'banned', (select count(*) from profiles where banned),
    'ai_today', (select coalesce(sum(run_cost(stats)), 0) from engine_runs where (started_at at time zone 'Europe/Paris')::date = today),
    'ai_7', (select coalesce(sum(run_cost(stats)), 0) from engine_runs where started_at > now() - interval '7 days'),
    'ai_30', (select coalesce(sum(run_cost(stats)), 0) from engine_runs where started_at > now() - interval '30 days'),
    'last_runs', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from (
      select distinct on (kind) kind, status, started_at, finished_at, summary from engine_runs order by kind, started_at desc) r)
  );
end $$;
revoke all on function public.dashboard() from public, anon;
grant execute on function public.dashboard() to authenticated;

-- Réglages : liste de mots interdits en plus de la liste de base.
create or replace function public.set_setting(k text, v text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  if k not in (
    'ANTHROPIC_API_KEY', 'UNSPLASH_ACCESS_KEY', 'PEXELS_API_KEY',
    'ENGINE_PAUSED', 'TITRE_MODEL', 'TITRE_EFFORT', 'AI_GUIDELINES', 'AI_AVOID',
    'WINDOW_HOURS', 'PER_RUBRIC', 'MAX_CARDS', 'MAX_ESSENTIAL', 'MIN_IMPORTANCE', 'MIN_SOURCES',
    'AUTO_PUBLISH', 'AUTO_FIX', 'PUBLISH_FLAGGED', 'PUBLISH_MIN_IMPORTANCE',
    'FLASH_ENABLED', 'FLASH_AUTO_PUBLISH', 'FLASH_MIN_IMPORTANCE', 'FLASH_MIN_SOURCES', 'FLASH_MAX_PER_DAY',
    'BANNED_WORDS', 'AI_MODERATION'
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
  insert into public.audit_log (actor, action, target, detail)
  values (auth.uid(), 'Réglage modifié', k, case when k like '%_KEY' then 'clé remplacée' else left(coalesce(trim(v), ''), 200) end);
end $$;

-- 6. Photos envoyées depuis le back office (Supabase Storage, dossier public « photos ») -----------
-- Sans Storage (tests locaux) ou sans droit suffisant, on passe : l'adresse d'image reste possible.
do $$ begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('photos', 'photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;
    drop policy if exists photos_staff_insert on storage.objects;
    create policy photos_staff_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'photos' and public.is_staff());
  end if;
exception when others then
  raise notice 'Envoi de photos non installé : %', sqlerrm;
end $$;

-- 7. Journal automatique des changements importants ------------------------------------------------
-- Le moteur peut joindre une raison (décision de l'IA) avec set_config('titre.reason', …, true).
create or replace function public.audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare a text; t text;
begin
  -- Un IF par table : PL/pgSQL ne lit pas new.banned sur une table qui n'a pas cette colonne.
  if tg_table_name = 'comments' then
    if new.status is distinct from old.status then
      a := case new.status when 'hidden' then 'Commentaire masqué' else 'Commentaire rétabli' end; t := '« ' || new.text || ' »';
    end if;
  elsif tg_table_name = 'profiles' then
    if new.banned is distinct from old.banned then
      a := case when new.banned then 'Lecteur banni' else 'Bannissement levé' end; t := coalesce(new.pseudo, 'lecteur sans pseudo');
    elsif new.role is distinct from old.role then
      a := 'Rôle : ' || old.role || ' → ' || new.role; t := coalesce(new.pseudo, 'compte sans pseudo');
    end if;
  elsif tg_table_name = 'articles' then
    if new.status is distinct from old.status then
      a := case new.status when 'published' then 'Info publiée' when 'rejected' then 'Info rejetée' else 'Info repassée en brouillon' end; t := new.title;
    end if;
  elsif new.status is distinct from old.status then -- flashes
    a := case new.status when 'published' then 'Dernière minute publiée' else 'Dernière minute masquée' end; t := new.title;
  end if;
  if a is null then return new; end if;
  insert into public.audit_log (actor, action, target, detail)
  values (auth.uid(), a, left(t, 200), nullif(current_setting('titre.reason', true), ''));
  return new;
end $$;
drop trigger if exists comments_audit on public.comments;
create trigger comments_audit after update on public.comments for each row execute function public.audit();
drop trigger if exists profiles_audit on public.profiles;
create trigger profiles_audit after update on public.profiles for each row execute function public.audit();
drop trigger if exists articles_audit on public.articles;
create trigger articles_audit after update on public.articles for each row execute function public.audit();
drop trigger if exists flashes_audit on public.flashes;
create trigger flashes_audit after update on public.flashes for each row execute function public.audit();

create or replace function public.admin_audit(lim int default 200)
returns table (at timestamptz, who text, action text, target text, detail text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  return query
    select l.at, case when l.actor is null then 'IA / moteur' else coalesce(p.pseudo, u.email, 'membre de l''équipe') end, l.action, l.target, l.detail
      from public.audit_log l left join public.profiles p on p.id = l.actor left join auth.users u on u.id = l.actor
     order by l.at desc limit least(lim, 1000);
end $$;
revoke all on function public.admin_audit(int) from public, anon;
grant execute on function public.admin_audit(int) to authenticated;

-- 8. Lecteurs : recherche, activité, suppression de compte (administrateurs) ----------------------------
create or replace function public.admin_users(search text default '')
returns table (id uuid, pseudo text, email text, role text, premium boolean, banned boolean, created_at timestamptz,
               last_seen date, comments int, hidden int, reports int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  return query
    select p.id, p.pseudo, u.email::text, p.role, p.premium, p.banned, p.created_at,
           (select max(v.day) from public.visits v where v.user_id = p.id),
           (select count(*)::int from public.comments c where c.user_id = p.id),
           (select count(*)::int from public.comments c where c.user_id = p.id and c.status = 'hidden'),
           (select count(*)::int from public.reports r join public.comments c on c.id = r.comment_id where c.user_id = p.id)
      from public.profiles p join auth.users u on u.id = p.id
     where coalesce(search, '') = '' or p.pseudo ilike '%' || search || '%' or u.email ilike '%' || search || '%'
     order by p.created_at desc limit 200;
end $$;
revoke all on function public.admin_users(text) from public, anon;
grant execute on function public.admin_users(text) to authenticated;

-- Supprimer un compte et tout ce qu'il a écrit (droit à l'effacement). Jamais un administrateur.
create or replace function public.delete_user(uid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  if exists (select 1 from public.profiles where id = uid and role = 'admin') then
    raise exception 'Impossible de supprimer un administrateur';
  end if;
  insert into public.audit_log (actor, action, target)
  select auth.uid(), 'Compte supprimé', coalesce(pseudo, 'lecteur sans pseudo') from public.profiles where id = uid;
  delete from auth.users where id = uid;
end $$;
revoke all on function public.delete_user(uuid) from public, anon;
grant execute on function public.delete_user(uuid) to authenticated;

-- 9. Tableau de bord : les infos qui ont le plus fait réagir cette semaine ------------------------------
create or replace function public.top_articles() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(t), '[]'::jsonb) from (
    select a.title, a.rubric_id, s.likes, s.comments
      from public.articles a join public.article_stats s on s.article_id = a.id
     where a.published_at > now() - interval '7 days' and public.is_staff()
     order by s.likes + 2 * s.comments desc, a.published_at desc limit 5) t;
$$;
grant execute on function public.top_articles() to authenticated;

-- ===== supabase/migrations/0010_lecteurs.sql
-- App lecteur : rubriques complètes, réactions emoji, messages d'accueil ciblés, badge Premium,
-- réglages des mises à jour au fil de la journée.

-- 1. Tous les grands domaines de l'actu ------------------------------------------------------------
insert into public.rubrics (id, name, position) values
  ('france', 'France', 1), ('monde', 'Monde', 2), ('eco', 'Économie', 3), ('tech', 'High-tech', 4),
  ('science', 'Sciences', 5), ('sante', 'Santé', 6), ('ecologie', 'Écologie', 7), ('sport', 'Sport', 8),
  ('culture', 'Culture', 9), ('people', 'People', 10)
on conflict (id) do update set position = excluded.position,
  name = case when public.rubrics.name in ('Éco', 'Tech') then excluded.name else public.rubrics.name end;

-- Sources des nouvelles rubriques (à vérifier dans le back office, page Sources : une adresse morte y affiche son erreur).
insert into public.sources (name, url, rubric_hint) values
  ('Le Monde', 'https://www.lemonde.fr/planete/rss_full.xml', 'ecologie'),
  ('Reporterre', 'https://reporterre.net/spip.php?page=backend', 'ecologie'),
  ('Le Monde', 'https://www.lemonde.fr/sciences/rss_full.xml', 'science'),
  ('Le Monde', 'https://www.lemonde.fr/sante/rss_full.xml', 'sante'),
  ('Le Monde', 'https://www.lemonde.fr/pixels/rss_full.xml', 'tech'),
  ('20 Minutes', 'https://www.20minutes.fr/feeds/rss-people.xml', 'people')
on conflict (url) do nothing;

-- 2. Réactions emoji (quand l'équipe remplace les commentaires) -----------------------------------
create table if not exists public.article_emojis (
  user_id uuid not null references auth.users (id) on delete cascade,
  article_id uuid not null references public.articles (id) on delete cascade,
  emoji text not null check (emoji in ('❤️', '😂', '😮', '😢', '😡', '👏')),
  created_at timestamptz not null default now(),
  primary key (user_id, article_id)
);
alter table public.article_emojis enable row level security;
drop policy if exists emojis_own on public.article_emojis;
create policy emojis_own on public.article_emojis for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.article_emojis to authenticated;

create or replace view public.article_emoji_stats as
select e.article_id, e.emoji, count(*)::int as n
  from public.article_emojis e join public.articles a on a.id = e.article_id and a.status = 'published'
 group by e.article_id, e.emoji;
grant select on public.article_emoji_stats to anon, authenticated;

-- Réglages publics lus par l'app (rien de secret).
create or replace function public.app_config() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('comments_mode', coalesce((select value from public.app_settings where key = 'COMMENTS_MODE'), 'comments'));
$$;
grant execute on function public.app_config() to anon, authenticated;

-- Commentaires coupés par l'équipe : la base refuse aussi les nouveaux.
create or replace function public.guard_comments_mode() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select value from public.app_settings where key = 'COMMENTS_MODE') = 'emoji' and not public.is_moderator() then
    raise exception 'Les commentaires sont fermés : réagissez avec un emoji';
  end if;
  return new;
end $$;
drop trigger if exists comments_mode_guard on public.comments;
create trigger comments_mode_guard before insert on public.comments
for each row execute function public.guard_comments_mode();

-- 3. Badge Premium à côté du pseudo dans les commentaires -------------------------------------------
drop function if exists public.article_comments(uuid);
create function public.article_comments(aid uuid)
returns table (id uuid, text text, pseudo text, created_at timestamptz, likes int, dislikes int, mine smallint, own boolean, premium boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.text, coalesce(p.pseudo, 'lecteur'), c.created_at,
         coalesce(sum(case when v.value = 1 then 1 else 0 end), 0)::int,
         coalesce(sum(case when v.value = -1 then 1 else 0 end), 0)::int,
         coalesce(max(case when v.user_id = auth.uid() then v.value end), 0)::smallint,
         coalesce(c.user_id = auth.uid(), false),
         coalesce(p.premium, false)
    from public.comments c
    join public.articles a on a.id = c.article_id and a.status = 'published'
    left join public.profiles p on p.id = c.user_id
    left join public.comment_votes v on v.comment_id = c.id
   where c.article_id = aid and c.status = 'visible'
     and not exists (select 1 from public.blocks b where b.user_id = auth.uid() and b.blocked_id = c.user_id)
   group by c.id, p.pseudo, p.premium
   order by c.created_at desc
   limit 200;
$$;
grant execute on function public.article_comments(uuid) to anon, authenticated;

-- 4. Message à l'ouverture de l'app, pour tout le monde ou un public choisi ------------------------
create table if not exists public.app_messages (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  body text not null default '' check (char_length(body) <= 400),
  audience text not null default 'all' check (audience in ('all', 'free', 'premium', 'guests', 'members')),
  active boolean not null default true,
  ends_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.app_messages enable row level security;
drop policy if exists messages_read on public.app_messages;
create policy messages_read on public.app_messages for select using ((active and (ends_at is null or ends_at > now())) or public.is_staff());
drop policy if exists messages_staff on public.app_messages;
create policy messages_staff on public.app_messages for all using (public.is_staff()) with check (public.is_staff());
grant select on public.app_messages to anon;
grant select, insert, update, delete on public.app_messages to authenticated;

-- 5. Réglages : commentaires ou emoji, mises à jour au fil de la journée --------------------------
create or replace function public.set_setting(k text, v text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  if k not in (
    'ANTHROPIC_API_KEY', 'UNSPLASH_ACCESS_KEY', 'PEXELS_API_KEY',
    'ENGINE_PAUSED', 'TITRE_MODEL', 'TITRE_EFFORT', 'AI_GUIDELINES', 'AI_AVOID',
    'WINDOW_HOURS', 'PER_RUBRIC', 'MAX_CARDS', 'MAX_ESSENTIAL', 'MIN_IMPORTANCE', 'MIN_SOURCES',
    'AUTO_PUBLISH', 'AUTO_FIX', 'PUBLISH_FLAGGED', 'PUBLISH_MIN_IMPORTANCE',
    'FLASH_ENABLED', 'FLASH_AUTO_PUBLISH', 'FLASH_MIN_IMPORTANCE', 'FLASH_MIN_SOURCES', 'FLASH_MAX_PER_DAY',
    'BANNED_WORDS', 'AI_MODERATION',
    'LIVE_UPDATES', 'LIVE_MIN_IMPORTANCE', 'COMMENTS_MODE'
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
  insert into public.audit_log (actor, action, target, detail)
  values (auth.uid(), 'Réglage modifié', k, case when k like '%_KEY' then 'clé remplacée' else left(coalesce(trim(v), ''), 200) end);
end $$;

-- ===== supabase/migrations/0011_choix_moderation.sql
-- Choix de la modération (mots-clés, IA, ou les deux) et coût en jetons de la modération par l'IA.

-- MODERATION : 'both' (par défaut), 'words' (mots-clés seulement) ou 'ai' (IA seulement).
-- Ancien interrupteur AI_MODERATION repris : coupé = mots-clés seulement.
insert into public.app_settings (key, value)
select 'MODERATION', 'words' from public.app_settings where key = 'AI_MODERATION' and value = '0'
on conflict (key) do nothing;
delete from public.app_settings where key = 'AI_MODERATION';

-- Filtre de mots-clés : sans effet quand la rédaction choisit « IA seulement ».
create or replace function public.has_insult(t text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.norm_text(t) ~ ('\m(' || string_agg(trim(public.norm_text(w)), '|') || ')(e|s|es)?\M'), false)
    from unnest(array[
      'connard', 'connasse', 'salope', 'salaud', 'encule', 'enculer', 'batard', 'pute', 'fils de pute', 'fdp',
      'ntm', 'niquer', 'ta gueule', 'tg', 'pd', 'pede', 'tapette', 'gouine', 'negre', 'bougnoule',
      'youpin', 'abruti', 'cretin', 'enfoire', 'petasse', 'poufiasse', 'trouduc', 'sous merde'
    ] || string_to_array(coalesce((select value from public.app_settings where key = 'BANNED_WORDS'), ''), ',')) w
   where trim(public.norm_text(w)) <> ''
     and coalesce((select value from public.app_settings where key = 'MODERATION'), 'both') <> 'ai';
$$;

create or replace function public.set_setting(k text, v text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  if k not in (
    'ANTHROPIC_API_KEY', 'UNSPLASH_ACCESS_KEY', 'PEXELS_API_KEY',
    'ENGINE_PAUSED', 'TITRE_MODEL', 'TITRE_EFFORT', 'AI_GUIDELINES', 'AI_AVOID',
    'WINDOW_HOURS', 'PER_RUBRIC', 'MAX_CARDS', 'MAX_ESSENTIAL', 'MIN_IMPORTANCE', 'MIN_SOURCES',
    'AUTO_PUBLISH', 'AUTO_FIX', 'PUBLISH_FLAGGED', 'PUBLISH_MIN_IMPORTANCE',
    'FLASH_ENABLED', 'FLASH_AUTO_PUBLISH', 'FLASH_MIN_IMPORTANCE', 'FLASH_MIN_SOURCES', 'FLASH_MAX_PER_DAY',
    'BANNED_WORDS', 'AI_MODERATION', 'MODERATION', 'LIVE_UPDATES', 'LIVE_MIN_IMPORTANCE', 'COMMENTS_MODE'
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
  insert into public.audit_log (actor, action, target, detail)
  values (auth.uid(), 'Réglage modifié', k, case when k like '%_KEY' then 'clé remplacée' else left(coalesce(trim(v), ''), 200) end);
end $$;

-- Modération par l'IA sur 30 jours : commentaires tranchés, jetons consommés, coût estimé en dollars.
create or replace function public.moderation_cost() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'judged', coalesce(sum(jsonb_array_length(coalesce(details->'moderation', '[]'::jsonb))), 0),
    'input', coalesce(sum((details->'moderation_ai'->>'input')::numeric), 0),
    'output', coalesce(sum((details->'moderation_ai'->>'output')::numeric), 0),
    'cost', coalesce(sum(public.run_cost(jsonb_build_object('model', details->'moderation_ai'->>'model', 'ai', details->'moderation_ai'))), 0))
  from public.engine_runs
  where started_at > now() - interval '30 days' and details ? 'moderation_ai' and public.is_staff();
$$;
grant execute on function public.moderation_cost() to authenticated;

-- ===== supabase/migrations/0012_publicite.sql
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

-- ===== supabase/migrations/0013_moderation_lecteurs.sql
-- Modération et gestion des lecteurs complètes : suspensions temporaires, suspension automatique
-- des récidivistes, fiche lecteur (historique, export RGPD, pseudo réinitialisé), filtres.

-- 0. Bloc commun aux fils modération, publicité, premium et back office (copié tel quel, idempotent) :
-- la liste des réglages autorisés devient une table, chacun y ajoute ses clés sans redéfinir set_setting.
create table if not exists public.setting_keys (key text primary key);
alter table public.setting_keys enable row level security;
insert into public.setting_keys (key) values
  ('ANTHROPIC_API_KEY'), ('UNSPLASH_ACCESS_KEY'), ('PEXELS_API_KEY'),
  ('ENGINE_PAUSED'), ('TITRE_MODEL'), ('TITRE_EFFORT'), ('AI_GUIDELINES'), ('AI_AVOID'),
  ('WINDOW_HOURS'), ('PER_RUBRIC'), ('MAX_CARDS'), ('MAX_ESSENTIAL'), ('MIN_IMPORTANCE'), ('MIN_SOURCES'),
  ('AUTO_PUBLISH'), ('AUTO_FIX'), ('PUBLISH_FLAGGED'), ('PUBLISH_MIN_IMPORTANCE'),
  ('FLASH_ENABLED'), ('FLASH_AUTO_PUBLISH'), ('FLASH_MIN_IMPORTANCE'), ('FLASH_MIN_SOURCES'), ('FLASH_MAX_PER_DAY'),
  ('BANNED_WORDS'), ('AI_MODERATION'), ('MODERATION'), ('LIVE_UPDATES'), ('LIVE_MIN_IMPORTANCE'), ('COMMENTS_MODE')
on conflict do nothing;

create or replace function public.set_setting(k text, v text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  if not exists (select 1 from public.setting_keys where key = k) then
    raise exception 'Réglage inconnu : %', k;
  end if;
  if char_length(coalesce(v, '')) > 2000 then raise exception 'Valeur trop longue (2 000 caractères au plus)'; end if;
  if coalesce(trim(v), '') = '' then
    delete from public.app_settings where key = k;
  else
    insert into public.app_settings (key, value, updated_at, updated_by) values (k, trim(v), now(), auth.uid())
    on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
  end if;
  insert into public.audit_log (actor, action, target, detail)
  values (auth.uid(), 'Réglage modifié', k, case when k like '%_KEY' then 'clé remplacée' else left(coalesce(trim(v), ''), 200) end);
end $$;
-- (fin du bloc commun)

-- Seuil de suspension automatique : N commentaires masqués en 30 jours = 7 jours de suspension (0 = jamais, 3 par défaut).
insert into public.setting_keys (key) values ('AUTO_SUSPEND') on conflict do nothing;

-- 1. Suspensions temporaires ------------------------------------------------------------------------
alter table public.profiles add column if not exists suspended_until timestamptz;
alter table public.profiles add column if not exists ban_reason text;

-- Un compte banni ou suspendu ne commente plus et ne signale plus.
create or replace function public.guard_muted() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = new.user_id;
  if p.banned then raise exception 'Votre compte ne peut plus commenter'; end if;
  if p.suspended_until > now() then
    raise exception 'Votre compte est suspendu jusqu''au %', to_char(p.suspended_until at time zone 'Europe/Paris', 'DD/MM à HH24"h"MI');
  end if;
  return new;
end $$;
drop trigger if exists comments_muted on public.comments;
create trigger comments_muted before insert on public.comments for each row execute function public.guard_muted();
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert with check (
  user_id = auth.uid() and not exists (select 1 from public.profiles where id = auth.uid() and (banned or suspended_until > now())));

-- Le lecteur ne peut toucher ni à son rôle, ni à Premium, ni à ses sanctions ; son pseudo passe le filtre.
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and (new.role is distinct from old.role or new.premium is distinct from old.premium) then
    raise exception 'Modification réservée aux administrateurs';
  end if;
  if auth.uid() is not null and not public.is_moderator()
     and (new.banned is distinct from old.banned or new.suspended_until is distinct from old.suspended_until
          or new.ban_reason is distinct from old.ban_reason) then
    raise exception 'Modification réservée à l''équipe';
  end if;
  if new.pseudo is distinct from old.pseudo and public.has_insult(new.pseudo) then
    raise exception 'Ce pseudo n''est pas autorisé';
  end if;
  return new;
end $$;

-- Suspendre pour quelques jours (0 = lever la suspension), avec un motif visible dans la fiche et le journal.
create or replace function public.suspend_user(uid uuid, days int, reason text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_moderator() then raise exception 'Réservé à l''équipe'; end if;
  if days > 0 and exists (select 1 from public.profiles where id = uid and role <> 'reader') then
    raise exception 'Retirez d''abord cette personne de l''équipe';
  end if;
  perform set_config('titre.reason', coalesce(nullif(trim(reason), ''), ''), true);
  update public.profiles
     set suspended_until = case when days > 0 then now() + make_interval(days => least(days, 365)) end,
         ban_reason = case when days > 0 then nullif(trim(reason), '') end
   where id = uid;
end $$;
revoke all on function public.suspend_user(uuid, int, text) from public, anon;
grant execute on function public.suspend_user(uuid, int, text) to authenticated;

-- Bannir garde aussi son motif.
create or replace function public.set_banned(uid uuid, ban boolean, reason text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_moderator() then raise exception 'Réservé à l''équipe'; end if;
  if ban and exists (select 1 from public.profiles where id = uid and role <> 'reader') then
    raise exception 'Retirez d''abord cette personne de l''équipe';
  end if;
  perform set_config('titre.reason', coalesce(nullif(trim(reason), ''), ''), true);
  update public.profiles set banned = ban, ban_reason = case when ban then nullif(trim(reason), '') end,
         suspended_until = case when ban then null else suspended_until end
   where id = uid;
  if ban then
    perform set_config('titre.reason', 'auteur banni', true);
    update public.comments set status = 'hidden' where user_id = uid and status = 'visible';
    update public.reports set resolved = true where comment_id in (select id from public.comments where user_id = uid);
  end if;
end $$;
drop function if exists public.set_banned(uuid, boolean);
revoke all on function public.set_banned(uuid, boolean, text) from public, anon;
grant execute on function public.set_banned(uuid, boolean, text) to authenticated;

-- 2. Suspension automatique des récidivistes ------------------------------------------------------------
create or replace function public.auto_suspend() returns trigger
language plpgsql security definer set search_path = public as $$
declare lim int := coalesce(nullif((select value from public.app_settings where key = 'AUTO_SUSPEND'), '')::int, 3); n int;
        prev text := current_setting('titre.reason', true);
begin
  if lim <= 0 or new.status <> 'hidden' or old.status <> 'visible' then return new; end if;
  if not exists (select 1 from public.profiles where id = new.user_id and role = 'reader' and not banned
                 and (suspended_until is null or suspended_until < now())) then return new; end if;
  select count(*) into n from public.comments where user_id = new.user_id and status = 'hidden' and created_at > now() - interval '30 days';
  if n >= lim then
    perform set_config('titre.reason', format('suspension automatique : %s commentaires masqués en 30 jours', n), true);
    update public.profiles set suspended_until = now() + interval '7 days',
           ban_reason = format('%s commentaires masqués en 30 jours', n)
     where id = new.user_id;
    perform set_config('titre.reason', coalesce(prev, ''), true); -- le motif du masquage reste celui de la modération
  end if;
  return new;
end $$;
drop trigger if exists comments_auto_suspend on public.comments;
create trigger comments_auto_suspend after update of status on public.comments for each row execute function public.auto_suspend();

-- 3. Journal : suspensions comprises ------------------------------------------------------------------
create or replace function public.audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare a text; t text;
begin
  -- Un IF par table : PL/pgSQL ne lit pas new.banned sur une table qui n'a pas cette colonne.
  if tg_table_name = 'comments' then
    if new.status is distinct from old.status then
      a := case new.status when 'hidden' then 'Commentaire masqué' else 'Commentaire rétabli' end; t := '« ' || new.text || ' »';
    end if;
  elsif tg_table_name = 'profiles' then
    t := coalesce(new.pseudo, 'lecteur sans pseudo');
    if new.banned is distinct from old.banned then
      a := case when new.banned then 'Lecteur banni' else 'Bannissement levé' end;
    elsif new.suspended_until is distinct from old.suspended_until then
      a := case when new.suspended_until > now()
                then 'Lecteur suspendu jusqu''au ' || to_char(new.suspended_until at time zone 'Europe/Paris', 'DD/MM HH24"h"MI')
                else 'Suspension levée' end;
    elsif new.role is distinct from old.role then
      a := 'Rôle : ' || old.role || ' → ' || new.role;
    elsif new.pseudo is distinct from old.pseudo and auth.uid() is distinct from new.id then
      a := 'Pseudo réinitialisé (ancien : ' || coalesce(old.pseudo, '—') || ')';
    end if;
  elsif tg_table_name = 'articles' then
    if new.status is distinct from old.status then
      a := case new.status when 'published' then 'Info publiée' when 'rejected' then 'Info rejetée' else 'Info repassée en brouillon' end; t := new.title;
    end if;
  elsif new.status is distinct from old.status then -- flashes
    a := case new.status when 'published' then 'Dernière minute publiée' else 'Dernière minute masquée' end; t := new.title;
  end if;
  if a is null then return new; end if;
  insert into public.audit_log (actor, action, target, detail)
  values (auth.uid(), a, left(t, 200), nullif(current_setting('titre.reason', true), ''));
  return new;
end $$;

-- 4. Pseudo choquant : la modération le remplace par un pseudo neutre ---------------------------------------
create or replace function public.reset_pseudo(uid uuid) returns text
language plpgsql security definer set search_path = public as $$
declare p text := 'lecteur' || substr(md5(random()::text), 1, 6);
begin
  if not public.is_moderator() then raise exception 'Réservé à l''équipe'; end if;
  update public.profiles set pseudo = p where id = uid and pseudo is not null;
  return p;
end $$;
revoke all on function public.reset_pseudo(uuid) from public, anon;
grant execute on function public.reset_pseudo(uuid) to authenticated;

-- 5. Liste des lecteurs : filtres et pages de 50 -----------------------------------------------------------
drop function if exists public.admin_users(text);
create or replace function public.admin_users(search text default '', filter text default 'all', page int default 0)
returns table (id uuid, pseudo text, email text, role text, premium boolean, banned boolean, suspended_until timestamptz,
               ban_reason text, created_at timestamptz, last_seen date, comments int, hidden int, reports int, total bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  return query
    select x.*, count(*) over () from (
      select p.id, p.pseudo, u.email::text, p.role, p.premium, p.banned, p.suspended_until, p.ban_reason, p.created_at,
             (select max(v.day) from public.visits v where v.user_id = p.id),
             (select count(*)::int from public.comments c where c.user_id = p.id),
             (select count(*)::int from public.comments c where c.user_id = p.id and c.status = 'hidden'),
             (select count(*)::int from public.reports r join public.comments c on c.id = r.comment_id where c.user_id = p.id)
        from public.profiles p join auth.users u on u.id = p.id
       where (coalesce(search, '') = '' or p.pseudo ilike '%' || search || '%' or u.email ilike '%' || search || '%')
         and case filter
               when 'banned' then p.banned
               when 'suspended' then p.suspended_until > now()
               when 'team' then p.role <> 'reader'
               when 'premium' then p.premium
               else true end
    ) x (id, pseudo, email, role, premium, banned, suspended_until, ban_reason, created_at, last_seen, comments, hidden, reports)
    where filter <> 'reported' or x.reports > 0
    order by case when filter = 'reported' then x.reports end desc nulls last, x.created_at desc
    limit 50 offset greatest(page, 0) * 50;
end $$;
revoke all on function public.admin_users(text, text, int) from public, anon;
grant execute on function public.admin_users(text, text, int) to authenticated;

-- 6. Fiche lecteur et export de ses données (droit d'accès RGPD) ---------------------------------------------
create or replace function public.admin_user_detail(uid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  return jsonb_build_object(
    'likes', (select count(*) from public.reactions where user_id = uid and value = 1),
    'reports_made', (select count(*) from public.reports where user_id = uid),
    'blocked_by', (select count(*) from public.blocks where blocked_id = uid),
    'days_30', (select count(*) from public.visits where user_id = uid and day > current_date - 30),
    'comments', (select coalesce(jsonb_agg(c order by c.created_at desc), '[]'::jsonb) from (
      select c.id, c.text, c.status, c.created_at, a.title as article,
             (select count(*) from public.reports r where r.comment_id = c.id) as reports
        from public.comments c join public.articles a on a.id = c.article_id
       where c.user_id = uid order by c.created_at desc limit 100) c),
    'history', (select coalesce(jsonb_agg(h order by h.at desc), '[]'::jsonb) from (
      select l.at, l.action, l.detail from public.audit_log l
       where l.target = (select coalesce(pseudo, 'lecteur sans pseudo') from public.profiles where id = uid)
       order by l.at desc limit 30) h)
  );
end $$;
revoke all on function public.admin_user_detail(uuid) from public, anon;
grant execute on function public.admin_user_detail(uuid) to authenticated;

create or replace function public.admin_user_export(uid uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare out jsonb;
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  select jsonb_build_object(
    'exporte_le', now(),
    'compte', (select jsonb_build_object('email', u.email, 'cree_le', p.created_at, 'pseudo', p.pseudo, 'role', p.role,
                                         'premium', p.premium, 'banni', p.banned, 'suspendu_jusqu_au', p.suspended_until, 'preferences', p.prefs)
                 from public.profiles p join auth.users u on u.id = p.id where p.id = uid),
    'commentaires', (select coalesce(jsonb_agg(jsonb_build_object('texte', text, 'statut', status, 'le', created_at, 'info', article_id)), '[]'::jsonb) from public.comments where user_id = uid),
    'reactions', (select coalesce(jsonb_agg(jsonb_build_object('info', article_id, 'valeur', value, 'le', created_at)), '[]'::jsonb) from public.reactions where user_id = uid),
    'votes_commentaires', (select coalesce(jsonb_agg(jsonb_build_object('commentaire', comment_id, 'valeur', value)), '[]'::jsonb) from public.comment_votes where user_id = uid),
    'signalements_faits', (select coalesce(jsonb_agg(jsonb_build_object('commentaire', comment_id, 'le', created_at)), '[]'::jsonb) from public.reports where user_id = uid),
    'comptes_bloques', (select count(*) from public.blocks where user_id = uid),
    'jours_de_visite', (select coalesce(jsonb_agg(day order by day), '[]'::jsonb) from public.visits where user_id = uid)
  ) into out;
  insert into public.audit_log (actor, action, target)
  select auth.uid(), 'Données exportées (RGPD)', coalesce(pseudo, 'lecteur sans pseudo') from public.profiles where id = uid;
  return out;
end $$;
revoke all on function public.admin_user_export(uuid) from public, anon;
grant execute on function public.admin_user_export(uuid) to authenticated;

-- ===== supabase/migrations/0014_premium.sql
-- Premium et abonnements : offres, abonnements (App Store, Google Play via RevenueCat, offerts, codes),
-- historique des paiements, codes promo. profiles.premium reste le booléen lu partout (app, pubs,
-- badge) : il est désormais recalculé tout seul à partir des abonnements.

-- 1. Offres affichées dans l'app ---------------------------------------------------------------
create table if not exists public.plans (
  id text primary key,
  name text not null,
  period text not null check (period in ('month', 'year', 'lifetime')),
  price_cents int not null check (price_cents >= 0),
  currency text not null default 'EUR',
  trial_days int not null default 0 check (trial_days between 0 and 90),
  apple_product_id text,
  google_product_id text,
  -- Petite phrase sous le prix (« 2 mois offerts »).
  highlight text,
  active boolean not null default true,
  position int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.plans enable row level security;
drop policy if exists plans_read on public.plans;
create policy plans_read on public.plans for select using (active or public.is_admin());
drop policy if exists plans_admin on public.plans;
create policy plans_admin on public.plans for all using (public.is_admin()) with check (public.is_admin());
insert into public.plans (id, name, period, price_cents, trial_days, apple_product_id, google_product_id, highlight, position) values
  ('mensuel', 'Mensuel', 'month', 299, 7, 'titre_premium_mensuel', 'titre_premium:mensuel', null, 1),
  ('annuel', 'Annuel', 'year', 2499, 7, 'titre_premium_annuel', 'titre_premium:annuel', '30 % moins cher', 0)
on conflict (id) do nothing;

-- 2. Abonnements -------------------------------------------------------------------------------
-- status : trial (essai), active, grace (paiement en échec, accès gardé), cancelled (ne se
-- renouvellera pas, accès jusqu'à expires_at), expired, refunded, revoked (retiré par l'équipe).
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_id text references public.plans (id) on delete set null,
  source text not null check (source in ('app_store', 'play_store', 'web', 'promo', 'gift', 'code')),
  status text not null check (status in ('trial', 'active', 'grace', 'cancelled', 'expired', 'refunded', 'revoked')),
  started_at timestamptz not null default now(),
  expires_at timestamptz, -- vide = à vie
  auto_renew boolean not null default false,
  store_ref text,          -- identifiant de l'achat d'origine chez Apple ou Google
  product_id text,
  price_cents int,
  currency text,
  sandbox boolean not null default false,
  note text,
  granted_by uuid references auth.users (id) on delete set null,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists subscriptions_store_ref on public.subscriptions (source, store_ref) where store_ref is not null;
create index if not exists subscriptions_user on public.subscriptions (user_id);
alter table public.subscriptions enable row level security;
drop policy if exists subscriptions_read on public.subscriptions;
create policy subscriptions_read on public.subscriptions for select using (user_id = auth.uid() or public.is_admin());

-- 3. Historique (paiements, résiliations, cadeaux…) --------------------------------------------
create table if not exists public.subscription_events (
  id bigserial primary key,
  at timestamptz not null default now(),
  user_id uuid references public.profiles (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  kind text not null,
  source text,
  amount_cents int, -- négatif pour un remboursement
  currency text,
  sandbox boolean not null default false,
  external_id text unique, -- identifiant de l'événement RevenueCat : chaque événement n'est compté qu'une fois
  detail text,
  raw jsonb
);
create index if not exists subscription_events_at on public.subscription_events (at desc);
alter table public.subscription_events enable row level security;
drop policy if exists subscription_events_admin on public.subscription_events;
create policy subscription_events_admin on public.subscription_events for select using (public.is_admin());

-- 4. Codes promo -------------------------------------------------------------------------------
create table if not exists public.promo_codes (
  code text primary key check (code ~ '^[A-Z0-9-]{4,24}$'),
  days int not null check (days between 1 and 3650),
  max_uses int check (max_uses > 0), -- vide = illimité
  uses int not null default 0,
  expires_at timestamptz,
  active boolean not null default true,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.promo_codes enable row level security;
drop policy if exists promo_codes_admin on public.promo_codes;
create policy promo_codes_admin on public.promo_codes for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.promo_redemptions (
  code text not null references public.promo_codes (code) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  at timestamptz not null default now(),
  primary key (code, user_id)
);
alter table public.promo_redemptions enable row level security;
-- Essais de code ratés : 10 par heure au plus, contre ceux qui devinent.
create table if not exists public.promo_attempts (user_id uuid not null, at timestamptz not null default now());
create index if not exists promo_attempts_user on public.promo_attempts (user_id, at);
alter table public.promo_attempts enable row level security;

-- 5. Le booléen premium suit les abonnements ---------------------------------------------------
alter table public.profiles add column if not exists premium_until timestamptz;

create or replace function public.sub_live(status text, expires_at timestamptz) returns boolean
language sql stable as $$
  select status in ('trial', 'active', 'grace', 'cancelled') and (expires_at is null or expires_at > now());
$$;

create or replace function public.sync_premium(uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare live boolean; lifetime boolean; until timestamptz;
  c1 text := current_setting('request.jwt.claim.sub', true); c2 text := current_setting('request.jwt.claims', true);
begin
  select coalesce(bool_or(true), false), coalesce(bool_or(expires_at is null), false), max(expires_at)
    into live, lifetime, until
    from public.subscriptions where user_id = uid and public.sub_live(status, expires_at);
  -- guard_profile refuse qu'un lecteur change premium : ce changement vient des abonnements, pas de lui.
  -- On l'écrit donc « au nom du serveur » (sans identité de lecteur), puis on remet l'identité en place.
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  update public.profiles
     set premium = live, premium_until = case when live and not lifetime then until end
   where id = uid and (premium is distinct from live or premium_until is distinct from case when live and not lifetime then until end);
  perform set_config('request.jwt.claim.sub', coalesce(c1, ''), true);
  perform set_config('request.jwt.claims', coalesce(c2, ''), true);
end $$;
revoke all on function public.sync_premium(uuid) from public, anon, authenticated;

create or replace function public.subscriptions_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then perform public.sync_premium(old.user_id); return old; end if;
  new.updated_at := now();
  return new;
end $$;
create or replace function public.subscriptions_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.sync_premium(coalesce(new.user_id, old.user_id));
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then perform public.sync_premium(old.user_id); end if;
  return null;
end $$;
drop trigger if exists subscriptions_touch on public.subscriptions;
create trigger subscriptions_touch before update on public.subscriptions for each row execute function public.subscriptions_changed();
drop trigger if exists subscriptions_sync on public.subscriptions;
create trigger subscriptions_sync after insert or update or delete on public.subscriptions for each row execute function public.subscriptions_after();

-- Fin des abonnements arrivés à échéance (lancé par le moteur toutes les 20 minutes).
create or replace function public.expire_premium() returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0; r record;
begin
  for r in update public.subscriptions set status = 'expired'
            where status in ('trial', 'active', 'grace', 'cancelled') and expires_at is not null and expires_at <= now()
           returning id, user_id, source, sandbox loop
    insert into public.subscription_events (user_id, subscription_id, kind, source, sandbox, detail)
    values (r.user_id, r.id, 'expiration', r.source, r.sandbox, 'Échéance passée');
    n := n + 1;
  end loop;
  -- Rattrapage : un profil Premium sans abonnement en cours.
  for r in select id from public.profiles p where premium and not exists
             (select 1 from public.subscriptions s where s.user_id = p.id and public.sub_live(s.status, s.expires_at)) loop
    perform public.sync_premium(r.id);
  end loop;
  return n;
end $$;
revoke all on function public.expire_premium() from public, anon, authenticated;

-- 6. Événements envoyés par RevenueCat (via la fonction Edge « revenuecat ») -------------------
-- Réservé au serveur (clé service_role) : jamais appelable depuis l'app.
create or replace function public.apply_store_event(ev jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare
  t text := upper(coalesce(ev->>'type', ''));
  uid uuid; src text; ref text; pl text; st text; renew boolean;
  exp timestamptz; at timestamptz; sid uuid; amt int; kind text; cur public.subscriptions;
  a text;
begin
  if ev->>'id' is not null and exists (select 1 from public.subscription_events where external_id = ev->>'id') then
    return 'déjà traité';
  end if;
  at := coalesce(to_timestamp((ev->>'event_timestamp_ms')::bigint / 1000.0), now());

  -- Le compte : app_user_id = identifiant Supabase du lecteur (l'app appelle Purchases.logIn).
  for a in select x from jsonb_array_elements_text(coalesce(ev->'aliases', '[]'::jsonb) || jsonb_build_array(ev->>'app_user_id', ev->>'original_app_user_id')) x loop
    if a ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and exists (select 1 from public.profiles where id = a::uuid) then
      uid := a::uuid;
    end if;
  end loop;

  src := case upper(coalesce(ev->>'store', '')) when 'APP_STORE' then 'app_store' when 'MAC_APP_STORE' then 'app_store'
           when 'PLAY_STORE' then 'play_store' when 'STRIPE' then 'web' when 'RC_BILLING' then 'web' when 'PADDLE' then 'web' else 'promo' end;

  if t = 'TRANSFER' then
    update public.subscriptions s set status = 'revoked', note = 'Achat transféré vers un autre compte'
     where s.user_id in (select x::uuid from jsonb_array_elements_text(coalesce(ev->'transferred_from', '[]'::jsonb)) x
                          where x ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
       and s.source in ('app_store', 'play_store', 'web') and public.sub_live(s.status, s.expires_at);
    insert into public.subscription_events (user_id, kind, source, external_id, detail, raw, sandbox)
    values (uid, 'transfert', src, ev->>'id', 'Achat transféré d''un compte à un autre', ev, upper(coalesce(ev->>'environment', '')) = 'SANDBOX');
    return 'transfert';
  end if;

  if t = 'TEST' or uid is null then
    insert into public.subscription_events (user_id, kind, source, external_id, detail, raw, sandbox)
    values (uid, case when t = 'TEST' then 'test' else 'ignoré' end, src, ev->>'id',
            case when t = 'TEST' then 'Test envoyé depuis RevenueCat' else 'Compte inconnu : ' || coalesce(ev->>'app_user_id', '?') end, ev, true);
    return case when t = 'TEST' then 'test' else 'compte inconnu' end;
  end if;

  ref := coalesce(ev->>'original_transaction_id', ev->>'transaction_id', ev->>'id');
  select id into pl from public.plans
   where ev->>'product_id' in (apple_product_id, google_product_id) or split_part(ev->>'product_id', ':', 1) = split_part(google_product_id, ':', 1)
   order by (ev->>'product_id' in (apple_product_id, google_product_id)) desc limit 1;
  exp := case when ev->>'expiration_at_ms' is not null then to_timestamp((ev->>'expiration_at_ms')::bigint / 1000.0) end;
  amt := case when ev->>'price_in_purchased_currency' is not null then round((ev->>'price_in_purchased_currency')::numeric * 100)::int end;

  select * into cur from public.subscriptions where source = src and store_ref = ref;

  case
    when t in ('INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE', 'SUBSCRIPTION_EXTENDED', 'TEMPORARY_ENTITLEMENT_GRANT') then
      st := case when upper(coalesce(ev->>'period_type', '')) = 'TRIAL' then 'trial' else 'active' end; renew := true;
      kind := case t when 'INITIAL_PURCHASE' then case when st = 'trial' then 'essai' else 'achat' end
                     when 'RENEWAL' then case when cur.status = 'trial' then 'conversion' else 'renouvellement' end
                     when 'UNCANCELLATION' then 'reprise' when 'PRODUCT_CHANGE' then 'changement d''offre' else 'prolongation' end;
    when t = 'NON_RENEWING_PURCHASE' then st := 'active'; renew := false; kind := 'achat';
    when t = 'CANCELLATION' then
      if upper(coalesce(ev->>'cancel_reason', '')) = 'CUSTOMER_SUPPORT' then st := 'refunded'; kind := 'remboursement'; amt := -abs(coalesce(amt, cur.price_cents, 0));
      else st := 'cancelled'; kind := 'résiliation'; amt := null; end if;
      renew := false;
    when t = 'BILLING_ISSUE' then st := 'grace'; renew := coalesce(cur.auto_renew, true); kind := 'problème de paiement'; amt := null;
    when t = 'EXPIRATION' then st := 'expired'; renew := false; kind := 'expiration'; amt := null;
    when t = 'SUBSCRIPTION_PAUSED' then st := coalesce(cur.status, 'active'); renew := false; kind := 'pause'; amt := null;
    else st := coalesce(cur.status, 'active'); renew := coalesce(cur.auto_renew, false); kind := lower(t); amt := null;
  end case;
  -- Seuls les paiements réels comptent comme revenu (pas l'essai gratuit).
  if st = 'trial' then amt := null; end if;

  if cur.id is null then
    insert into public.subscriptions (user_id, plan_id, source, status, started_at, expires_at, auto_renew, store_ref, product_id, price_cents, currency, sandbox, last_event_at)
    values (uid, pl, src, st, coalesce(to_timestamp((ev->>'purchased_at_ms')::bigint / 1000.0), at), exp, renew, ref, ev->>'product_id',
            nullif(abs(coalesce(amt, 0)), 0), ev->>'currency', upper(coalesce(ev->>'environment', '')) = 'SANDBOX', at)
    returning id into sid;
  elsif cur.last_event_at is null or at >= cur.last_event_at then
    -- Les événements peuvent arriver dans le désordre : un vieux ne remplace pas un récent.
    update public.subscriptions
       set user_id = uid, plan_id = coalesce(pl, plan_id), status = st, expires_at = coalesce(exp, expires_at), auto_renew = renew,
           product_id = coalesce(ev->>'product_id', product_id), price_cents = coalesce(nullif(abs(coalesce(amt, 0)), 0), price_cents),
           currency = coalesce(ev->>'currency', currency), last_event_at = at
     where id = cur.id;
    sid := cur.id;
  else
    sid := cur.id;
  end if;

  insert into public.subscription_events (at, user_id, subscription_id, kind, source, amount_cents, currency, sandbox, external_id, detail, raw)
  values (at, uid, sid, kind, src, amt, ev->>'currency', upper(coalesce(ev->>'environment', '')) = 'SANDBOX', ev->>'id', ev->>'product_id', ev);
  return kind;
end $$;
revoke all on function public.apply_store_event(jsonb) from public, anon, authenticated;

-- 7. Côté lecteur ------------------------------------------------------------------------------
create or replace function public.my_subscription() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'premium', coalesce(p.premium, false), 'until', p.premium_until,
    'status', s.status, 'source', s.source, 'plan', pl.name, 'auto_renew', coalesce(s.auto_renew, false), 'expires_at', s.expires_at)
    from public.profiles p
    left join lateral (select * from public.subscriptions x where x.user_id = p.id and public.sub_live(x.status, x.expires_at)
                        order by x.expires_at desc nulls first limit 1) s on true
    left join public.plans pl on pl.id = s.plan_id
   where p.id = auth.uid();
$$;
revoke all on function public.my_subscription() from public, anon;
grant execute on function public.my_subscription() to authenticated;

-- Jours offerts, ajoutés après la fin de ce qui est déjà en cours.
create or replace function public.give_days(uid uuid, d int, src text, why text, by_ uuid) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare base timestamptz; ends timestamptz; sid uuid;
begin
  if exists (select 1 from public.subscriptions where user_id = uid and expires_at is null and public.sub_live(status, expires_at)) then
    return null; -- déjà Premium à vie
  end if;
  select greatest(now(), coalesce(max(expires_at), now())) into base from public.subscriptions where user_id = uid and public.sub_live(status, expires_at);
  ends := case when d is null or d <= 0 then null else coalesce(base, now()) + make_interval(days => d) end;
  insert into public.subscriptions (user_id, source, status, expires_at, note, granted_by)
  values (uid, src, 'active', ends, why, by_) returning id into sid;
  insert into public.subscription_events (user_id, subscription_id, kind, source, detail)
  values (uid, sid, case src when 'code' then 'code promo' else 'offert' end, src,
          case when ends is null then 'À vie' else d || ' jour' || case when d > 1 then 's' else '' end end || coalesce(' · ' || why, ''));
  return coalesce(ends, 'infinity'::timestamptz);
end $$;
revoke all on function public.give_days(uuid, int, text, text, uuid) from public, anon, authenticated;

create or replace function public.redeem_code(c text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pc public.promo_codes; uid uuid := auth.uid(); ends timestamptz;
begin
  if uid is null then raise exception 'Connectez-vous pour utiliser un code'; end if;
  if exists (select 1 from public.profiles where id = uid and banned) then raise exception 'Ce compte ne peut pas utiliser de code'; end if;
  if (select count(*) from public.promo_attempts where user_id = uid and at > now() - interval '1 hour') >= 10 then
    raise exception 'Trop d''essais. Réessayez dans une heure.';
  end if;
  select * into pc from public.promo_codes where code = upper(trim(c)) for update;
  if pc.code is null or not pc.active or (pc.expires_at is not null and pc.expires_at < now()) or (pc.max_uses is not null and pc.uses >= pc.max_uses) then
    -- Pas d'exception ici : elle annulerait l'essai noté juste au-dessus.
    insert into public.promo_attempts (user_id) values (uid);
    return jsonb_build_object('error', 'Ce code n''est pas valable');
  end if;
  if exists (select 1 from public.promo_redemptions where code = pc.code and user_id = uid) then
    raise exception 'Vous avez déjà utilisé ce code';
  end if;
  ends := public.give_days(uid, pc.days, 'code', 'Code ' || pc.code, null);
  if ends is null then raise exception 'Vous êtes déjà Premium à vie'; end if;
  insert into public.promo_redemptions (code, user_id) values (pc.code, uid);
  update public.promo_codes set uses = uses + 1 where code = pc.code;
  return jsonb_build_object('days', pc.days, 'until', ends);
end $$;
revoke all on function public.redeem_code(text) from public, anon;
grant execute on function public.redeem_code(text) to authenticated;

-- 8. Back office (administrateurs) -------------------------------------------------------------
create or replace function public.admin_grant_premium(uid uuid, days int, note text default null) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare ends timestamptz;
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  ends := public.give_days(uid, days, 'gift', nullif(trim(coalesce(note, '')), ''), auth.uid());
  if ends is null then raise exception 'Ce lecteur est déjà Premium à vie'; end if;
  insert into public.audit_log (actor, action, target, detail)
  values (auth.uid(), 'Premium offert', (select coalesce(pseudo, 'lecteur sans pseudo') from public.profiles where id = uid),
          case when days is null or days <= 0 then 'à vie' else days || ' jours' end || coalesce(' · ' || note, ''));
  return ends;
end $$;
revoke all on function public.admin_grant_premium(uuid, int, text) from public, anon;
grant execute on function public.admin_grant_premium(uuid, int, text) to authenticated;

-- Retire l'accès tout de suite. Un abonnement Apple ou Google continue d'être prélevé par le store :
-- le rembourser se fait dans App Store Connect ou la Play Console.
create or replace function public.admin_revoke_premium(uid uuid, note text default null) returns int
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare n int;
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  with x as (
    update public.subscriptions set status = 'revoked', note = coalesce(nullif(trim(coalesce($2, '')), ''), note)
     where user_id = uid and public.sub_live(status, expires_at) returning id, source)
  insert into public.subscription_events (user_id, subscription_id, kind, source, detail)
  select uid, id, 'retiré', source, nullif(trim(coalesce($2, '')), '') from x;
  get diagnostics n = row_count;
  insert into public.audit_log (actor, action, target, detail)
  values (auth.uid(), 'Premium retiré', (select coalesce(pseudo, 'lecteur sans pseudo') from public.profiles where id = uid), nullif(trim(coalesce($2, '')), ''));
  return n;
end $$;
revoke all on function public.admin_revoke_premium(uuid, text) from public, anon;
grant execute on function public.admin_revoke_premium(uuid, text) to authenticated;

-- Abonnés : l'abonnement le plus récent de chaque lecteur. filter : live, trial, paying, gift, cancelled, ended, all.
create or replace function public.admin_subscribers(search text default '', filter text default 'live', uid uuid default null)
returns table (user_id uuid, pseudo text, email text, sub_id uuid, status text, source text, plan text, started_at timestamptz,
               expires_at timestamptz, auto_renew boolean, price_cents int, currency text, sandbox boolean, note text, live boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  return query
    select s.user_id, p.pseudo, u.email::text, s.id, s.status, s.source, pl.name, s.started_at, s.expires_at, s.auto_renew,
           s.price_cents, s.currency, s.sandbox, s.note, public.sub_live(s.status, s.expires_at)
      from (select distinct on (x.user_id) x.* from public.subscriptions x
             order by x.user_id, public.sub_live(x.status, x.expires_at) desc, x.expires_at desc nulls first, x.created_at desc) s
      join public.profiles p on p.id = s.user_id
      left join auth.users u on u.id = s.user_id
      left join public.plans pl on pl.id = s.plan_id
     where (uid is null or s.user_id = uid)
       and (coalesce(search, '') = '' or p.pseudo ilike '%' || search || '%' or u.email ilike '%' || search || '%')
       and case coalesce(filter, 'live')
             when 'live' then public.sub_live(s.status, s.expires_at)
             when 'trial' then s.status = 'trial' and public.sub_live(s.status, s.expires_at)
             when 'paying' then s.source in ('app_store', 'play_store', 'web') and s.status in ('active', 'grace', 'cancelled') and public.sub_live(s.status, s.expires_at)
             when 'gift' then s.source in ('gift', 'code', 'promo') and public.sub_live(s.status, s.expires_at)
             when 'cancelled' then s.status in ('cancelled', 'grace') and public.sub_live(s.status, s.expires_at)
             when 'ended' then not public.sub_live(s.status, s.expires_at)
             else true end
     order by s.updated_at desc
     limit 300;
end $$;
revoke all on function public.admin_subscribers(text, text, uuid) from public, anon;
grant execute on function public.admin_subscribers(text, text, uuid) to authenticated;

create or replace function public.admin_sub_events(uid uuid default null, lim int default 200)
returns table (at timestamptz, pseudo text, kind text, source text, amount_cents int, currency text, sandbox boolean, detail text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  return query
    select e.at, p.pseudo, e.kind, e.source, e.amount_cents, e.currency, e.sandbox, e.detail
      from public.subscription_events e left join public.profiles p on p.id = e.user_id
     where uid is null or e.user_id = uid
     order by e.at desc limit least(coalesce(lim, 200), 1000);
end $$;
revoke all on function public.admin_sub_events(uuid, int) from public, anon;
grant execute on function public.admin_sub_events(uuid, int) to authenticated;

-- Chiffres clés (hors achats de test). MRR = revenu mensuel récurrent : les abonnements payants qui
-- se renouvellent, l'annuel compté pour un douzième.
create or replace function public.premium_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_staff() then raise exception 'Réservé à l''équipe'; end if;
  with live as (
    select s.*, coalesce(pl.period, case when s.product_id ilike '%an%' then 'year' else 'month' end) as period,
           coalesce(s.price_cents, pl.price_cents, 0) as price
      from public.subscriptions s left join public.plans pl on pl.id = s.plan_id
     where public.sub_live(s.status, s.expires_at) and not s.sandbox)
  select jsonb_build_object(
    'premium', (select count(*) from public.profiles where premium),
    'paying', (select count(distinct user_id) from live where source in ('app_store', 'play_store', 'web') and status <> 'trial'),
    'trial', (select count(distinct user_id) from live where status = 'trial'),
    'gift', (select count(distinct user_id) from live where source in ('gift', 'code', 'promo')),
    'cancelling', (select count(distinct user_id) from live where status in ('cancelled', 'grace')),
    'mrr_cents', (select coalesce(sum(case period when 'year' then price / 12.0 when 'month' then price else 0 end), 0)::int
                    from live where source in ('app_store', 'play_store', 'web') and status in ('active', 'grace') and auto_renew),
    'revenue_30_cents', (select coalesce(sum(amount_cents), 0) from public.subscription_events where at > now() - interval '30 days' and not sandbox),
    'revenue_all_cents', (select coalesce(sum(amount_cents), 0) from public.subscription_events where not sandbox),
    'new_30', (select count(*) from public.subscription_events where at > now() - interval '30 days' and not sandbox and kind in ('achat', 'essai')),
    'conversions_30', (select count(*) from public.subscription_events where at > now() - interval '30 days' and not sandbox and kind = 'conversion'),
    'churn_30', (select count(*) from public.subscription_events where at > now() - interval '30 days' and not sandbox and kind in ('expiration', 'remboursement') and source in ('app_store', 'play_store', 'web')),
    'by_source', (select coalesce(jsonb_object_agg(source, n), '{}'::jsonb) from (select source, count(distinct user_id) n from live group by source) x)
  ) into r;
  return r;
end $$;
revoke all on function public.premium_stats() from public, anon;
grant execute on function public.premium_stats() to authenticated;

-- 9. Premium déjà accordé avant ce système (case cochée à la main) : on le garde, à vie. -----------
insert into public.subscriptions (user_id, source, status, expires_at, note)
select id, 'gift', 'active', null, 'Premium accordé avant les abonnements'
  from public.profiles p where premium and not exists (select 1 from public.subscriptions s where s.user_id = p.id);

-- ===== supabase/migrations/0015_algorithme.sql
-- Algorithme « Mon édition » (cahier des charges §16), sans IA : des points, des mots-clés et des règles réglables.
--   • l'app note ce que fait le lecteur (temps sur la carte, « Lire », source, partage, « Moins de sujets comme ça ») ;
--   • likes, dislikes et commentaires viennent des tables existantes ;
--   • chaque signal donne des points à une rubrique et aux mots-clés de l'info, points qui perdent la moitié
--     de leur valeur en 21 jours ;
--   • l'édition = sujets majeurs pour tous + infos choisies selon les goûts + découverte.
-- Tout se règle dans le back office (Lecteurs > Algorithme) : poids, proportions, mots-clés.

-- 1. Réglages : un seul réglage ALGO (JSON), complété par les valeurs par défaut ------------------------
insert into public.setting_keys (key) values ('ALGO') on conflict do nothing;

create or replace function public.algo_defaults() returns jsonb language sql immutable as $$
  select '{
    "enabled": true,
    "share_essential": 25, "share_discovery": 12,
    "w_importance": 45, "w_affinity": 35, "w_collective": 10, "w_fresh": 10,
    "affinity_start": 10, "ramp": 50, "half_life": 21, "smooth": 5,
    "skip_ms": 2000, "long_ms": 12000, "min_views": 200, "max_rubric": 50, "keep_days": 90,
    "signals": {"click": 3, "share": 3, "summary_end": 2, "like": 2, "comment": 2, "summary": 1.5,
                "source": 1, "long": 1, "back": 0.5, "skip": -0.5, "dislike": -0.5, "less": -3}
  }'::jsonb;
$$;

-- Réglages en vigueur : ceux du back office par-dessus les valeurs par défaut (un JSON abîmé est ignoré).
create or replace function public.algo_conf() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d jsonb := public.algo_defaults(); s jsonb;
begin
  begin s := (select value::jsonb from public.app_settings where key = 'ALGO'); exception when others then s := null; end;
  if jsonb_typeof(s) is distinct from 'object' then return d; end if;
  return d || (s - 'signals') || jsonb_build_object('signals', d->'signals' || coalesce(case when jsonb_typeof(s->'signals') = 'object' then s->'signals' end, '{}'));
end $$;

-- 2. Mots-clés (liste gérée par l'équipe) et mots-clés repérés dans chaque info -------------------------
create table if not exists public.algo_keywords (
  id bigint generated always as identity primary key,
  label text not null unique check (char_length(label) between 2 and 40),
  words text[] not null default '{}',   -- variantes cherchées dans le texte (le libellé est toujours cherché)
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.algo_keywords enable row level security;
drop policy if exists algo_keywords_staff on public.algo_keywords;
create policy algo_keywords_staff on public.algo_keywords for all using (public.is_staff()) with check (public.is_staff());
revoke all on public.algo_keywords from anon;

create table if not exists public.article_topics (
  article_id uuid primary key references public.articles (id) on delete cascade,
  topics text[] not null default '{}'
);
alter table public.article_topics enable row level security;
drop policy if exists article_topics_staff on public.article_topics;
create policy article_topics_staff on public.article_topics for select using (public.is_staff());
revoke all on public.article_topics from anon;

-- Mots-clés d'une info, par fréquence : une occurrence dans le titre compte double, 6 mots-clés au plus.
-- Le texte de l'info est normalisé une seule fois (« materialized » : sinon une fois par mot-clé, ~300 ms par article,
-- et l'installation de la base expirait). norm_text ne garde que des lettres et des espaces simples : un mot est compté
-- « entouré d'espaces », par remplacement, sans expression régulière.
create or replace function public.word_count(hay text, w text) returns int language sql immutable as $$
  select (length(hay) - length(replace(hay, ' ' || w || ' ', ' '))) / (length(w) + 1);
$$;
create or replace function public.find_topics(title text, body text) returns text[]
language sql stable security definer set search_path = public as $$
  with t as materialized (select ' ' || replace(public.norm_text(title), ' ', '  ') || ' ' as ti, ' ' || replace(public.norm_text(body), ' ', '  ') || ' ' as bo),
  hits as (
    select k.label, sum(2 * public.word_count(t.ti, replace(w, ' ', '  ')) + public.word_count(t.bo, replace(w, ' ', '  '))) as n
      from public.algo_keywords k, t,
           lateral (select distinct trim(public.norm_text(x)) as w from unnest(k.words || k.label) x) v
     where k.active and v.w <> ''
     group by k.label
  )
  select coalesce(array_agg(label order by n desc, label), '{}') from (select * from hits where n > 0 order by n desc, label limit 6) h;
$$;

create or replace function public.article_text(a public.articles) returns text language sql immutable as $$
  select concat_ws(' ', a.key_sentence,
    (select string_agg(f->>'text', ' ') from jsonb_array_elements(coalesce(a.facts, '[]')) f),
    (select string_agg(s, ' ') from jsonb_array_elements_text(coalesce(a.summary, '[]')) s));
$$;

create or replace function public.tag_article() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.article_topics (article_id, topics) values (new.id, public.find_topics(new.title, public.article_text(new)))
  on conflict (article_id) do update set topics = excluded.topics;
  return new;
end $$;
drop trigger if exists articles_topics on public.articles;
create trigger articles_topics after insert or update of title, key_sentence, facts, summary on public.articles
for each row execute function public.tag_article();

-- Liste de mots-clés modifiée : les infos récentes sont réétiquetées tout de suite.
create or replace function public.retag_articles() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.article_topics (article_id, topics)
  select a.id, public.find_topics(a.title, public.article_text(a)) from public.articles a
   where a.edition_date >= current_date - (public.algo_conf()->>'keep_days')::int
  on conflict (article_id) do update set topics = excluded.topics;
  return null;
end $$;
drop trigger if exists algo_keywords_retag on public.algo_keywords;
create trigger algo_keywords_retag after insert or update or delete on public.algo_keywords
for each statement execute function public.retag_articles();

-- 3. Journal de lecture (écrit par l'app, lu seulement par les calculs ci-dessous) ----------------------
create table if not exists public.reading_events (
  id bigint generated always as identity primary key,
  device text not null check (char_length(device) between 8 and 64),
  user_id uuid references auth.users (id) on delete cascade,
  article_id uuid not null references public.articles (id) on delete cascade,
  kind text not null check (kind in ('view', 'summary', 'summary_end', 'source', 'click', 'share', 'back', 'less')),
  ms int,
  at timestamptz not null default now()
);
create index if not exists reading_events_user on public.reading_events (user_id, at);
create index if not exists reading_events_device on public.reading_events (device, at);
create index if not exists reading_events_article on public.reading_events (article_id);
alter table public.reading_events enable row level security;
revoke all on public.reading_events from anon, authenticated;

-- « Remettre mes goûts à zéro » : les signaux plus anciens sont ignorés (likes compris).
create table if not exists public.taste_resets (
  who text primary key,               -- identifiant du compte, ou « d: » + appareil sans compte
  at timestamptz not null default now()
);
alter table public.taste_resets enable row level security;
revoke all on public.taste_resets from anon, authenticated;

-- L'app envoie ses signaux par paquets : [{ "a": id de l'info, "k": type, "ms": durée }].
-- Au premier envoi connecté, les signaux de l'appareil passent sur le compte (rien n'est perdu à l'inscription).
create or replace function public.track(d text, ev jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if char_length(coalesce(d, '')) not between 8 and 64 or jsonb_typeof(ev) <> 'array' then return; end if;
  if auth.uid() is not null then
    update public.reading_events set user_id = auth.uid() where device = d and user_id is null;
  end if;
  insert into public.reading_events (device, user_id, article_id, kind, ms)
  select d, auth.uid(), a.id, e->>'k', least(greatest((e->>'ms')::int, 0), 600000)
    from (select value e from jsonb_array_elements(ev) limit 100) x
    join public.articles a on a.id::text = e->>'a' and a.status = 'published'
   where e->>'k' in ('view', 'summary', 'summary_end', 'source', 'click', 'share', 'back', 'less');
end $$;
grant execute on function public.track(text, jsonb) to anon, authenticated;

create or replace function public.reset_taste(d text) returns void
language sql security definer set search_path = public as $$
  delete from public.reading_events where (auth.uid() is not null and user_id = auth.uid()) or (device = d and user_id is null);
  insert into public.taste_resets (who, at) values (coalesce(auth.uid()::text, 'd:' || d), now())
  on conflict (who) do update set at = now();
$$;
grant execute on function public.reset_taste(text) to anon, authenticated;

-- 4. Profil de goûts : points par rubrique et par mot-clé, qui s'effacent avec le temps --------------------
-- Lecteur connecté : uid ; sans compte : son appareil (dev). Renvoie
-- { rubrics: {id: points}, topics: {mot-clé: points}, n: nombre de signaux }.
create or replace function public.reader_taste(uid uuid, dev text) returns jsonb
language sql stable security definer set search_path = public as $$
  with c as (select public.algo_conf() c),
  since as (
    select greatest(now() - make_interval(days => (c->>'keep_days')::int),
                    coalesce((select at from public.taste_resets where who = coalesce(uid::text, 'd:' || dev)), '-infinity')) t
      from c
  ),
  sig as (
    select e.article_id, e.at,
           case when e.kind <> 'view' then (c->'signals'->>e.kind)::numeric
                when e.ms < (c->>'skip_ms')::int then (c->'signals'->>'skip')::numeric
                when e.ms >= (c->>'long_ms')::int then (c->'signals'->>'long')::numeric
                else 0 end as w
      from public.reading_events e, c, since
     where e.at > since.t and ((uid is not null and e.user_id = uid) or (uid is null and e.device = dev and e.user_id is null))
    union all
    select r.article_id, r.created_at, (c->'signals'->>case when r.value = 1 then 'like' else 'dislike' end)::numeric
      from public.reactions r, c, since where uid is not null and r.user_id = uid and r.created_at > since.t
    union all
    select distinct on (m.article_id) m.article_id, m.created_at, (c->'signals'->>'comment')::numeric
      from public.comments m, c, since where uid is not null and m.user_id = uid and m.created_at > since.t
  ),
  w as (
    select s.article_id, s.w * power(0.5, extract(epoch from now() - s.at) / 86400 / (c->>'half_life')::numeric) as w
      from sig s, c where s.w <> 0
  )
  select jsonb_build_object(
    'rubrics', coalesce((select jsonb_object_agg(rubric_id, round(p, 2)) from (
        select a.rubric_id, sum(w.w) p from w join public.articles a on a.id = w.article_id group by a.rubric_id) x), '{}'),
    'topics', coalesce((select jsonb_object_agg(t, round(p, 2)) from (
        select t, sum(w.w) p from w join public.article_topics at on at.article_id = w.article_id, unnest(at.topics) t
         group by t order by abs(sum(w.w)) desc limit 100) y), '{}'),
    'n', (select count(*) from w));
$$;
revoke all on function public.reader_taste(uuid, text) from public, anon, authenticated;

-- 5. L'édition d'un lecteur --------------------------------------------------------------------------
-- Toutes les infos publiées de la dernière édition, dans l'ordre où le lecteur doit les voir : d'abord les
-- `quota` cartes de son édition (slot ess / pv / dec), puis le reste pour « Charger plus » (slot more).
create or replace function public.compose_edition(uid uuid, dev text, active text[], quota int, perso boolean default true)
returns table (article_id uuid, slot text, reason text, score numeric, pos int)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  c jsonb := public.algo_conf();
  taste jsonb := case when perso and (c->>'enabled')::boolean then public.reader_taste(uid, dev) else '{"rubrics":{},"topics":{},"n":0}' end;
  k numeric := greatest((c->>'smooth')::numeric, 0.1);
  wa numeric; wi numeric;
  n_ess int; n_dec int; cap int;
  ed date := (select e.date from public.editions e where e.status = 'published' order by e.date desc limit 1);
  r record; prev1 text; prev2 text; i int := 0; mid int;
begin
  quota := least(greatest(coalesce(quota, 8), 1), 100);
  active := coalesce(active, '{}');
  -- Le poids des goûts monte avec le nombre de signaux ; ce qu'il ne prend pas va à l'importance.
  wa := case when not (perso and (c->>'enabled')::boolean) then 0
             else (c->>'affinity_start')::numeric + ((c->>'w_affinity')::numeric - (c->>'affinity_start')::numeric)
                  * least(1, (taste->>'n')::numeric / greatest((c->>'ramp')::numeric, 1)) end;
  wi := (c->>'w_importance')::numeric + (c->>'w_affinity')::numeric - wa;
  n_ess := greatest(1, round(quota * (c->>'share_essential')::numeric / 100));
  n_dec := case when (c->>'share_discovery')::numeric > 0 then greatest(1, round(quota * (c->>'share_discovery')::numeric / 100)) else 0 end;
  cap := case when cardinality(active) <= 2 then quota else greatest(1, ceil(quota * (c->>'max_rubric')::numeric / 100)) end;

  create temp table if not exists _cand (id uuid, rubric text, rname text, essential boolean, importance int,
    aff numeric, fav text, sc numeric, slot text, why text, ord int) on commit drop;
  truncate _cand;

  insert into _cand (id, rubric, rname, essential, importance, aff, fav, sc)
  with art as (
    select a.id, a.rubric_id, rb.name, a.essential, a.importance, coalesce(a.published_at, a.created_at) as at,
           coalesce(t.topics, '{}') as topics
      from public.articles a join public.rubrics rb on rb.id = a.rubric_id
      left join public.article_topics t on t.article_id = a.id
     where a.edition_date = ed and a.status = 'published'
       -- « Moins de sujets comme ça » : cette info-là ne revient pas.
       and not exists (select 1 from public.reading_events e where e.article_id = a.id and e.kind = 'less'
                        and ((uid is not null and e.user_id = uid) or (uid is null and e.device = dev)))
  ),
  -- Intérêt collectif : part des lecteurs qui ouvrent, partagent ou cliquent (rang parmi les infos assez vues).
  coll as (
    select e.article_id, count(distinct e.device) filter (where e.kind = 'view') as views,
           count(distinct e.device) filter (where e.kind = 'summary') + 2 * count(distinct e.device) filter (where e.kind in ('share', 'click')) as eng
      from public.reading_events e where e.article_id in (select id from art) group by e.article_id
  ),
  coll_rank as (
    select article_id, percent_rank() over (order by eng::numeric / views) as pr
      from coll where views >= (c->>'min_views')::int
  ),
  aff as (
    select art.*,
           0.5 + 0.5 * coalesce((taste->'rubrics'->>art.rubric_id)::numeric, 0) / (abs(coalesce((taste->'rubrics'->>art.rubric_id)::numeric, 0)) + k) as ra,
           (select t from unnest(art.topics) t where (taste->'topics'->>t)::numeric > 0 order by (taste->'topics'->>t)::numeric desc limit 1) as fav
      from art
  ),
  aff2 as (
    select aff.*, coalesce((select avg(case when taste->'topics' ? t
                    then 0.5 + 0.5 * (taste->'topics'->>t)::numeric / (abs((taste->'topics'->>t)::numeric) + k) else aff.ra end)
                  from unnest(aff.topics) t), aff.ra) as ta
      from aff
  )
  select a2.id, a2.rubric_id, a2.name, a2.essential, a2.importance, (a2.ra + a2.ta) / 2, a2.fav,
         (wi * a2.importance / 10.0
          + wa * (a2.ra + a2.ta) / 2
          + (c->>'w_collective')::numeric * coalesce((select pr from coll_rank where coll_rank.article_id = a2.id), 0.5)
          + (c->>'w_fresh')::numeric * greatest(0, 1 - extract(epoch from now() - a2.at) / 86400)) / 100
    from aff2 a2;

  -- À ne pas manquer : les sujets majeurs du jour, pour tout le monde.
  update _cand set slot = 'ess', why = 'Sujet majeur du jour, proposé à tout le monde.'
   where id in (select id from _cand order by essential desc, importance desc, sc desc limit n_ess);
  -- Découverte : un sujet important d'une rubrique non suivie (sinon de la rubrique la moins lue).
  update _cand set slot = 'dec', why = 'Pour découvrir la rubrique ' || rname || '.'
   where id in (select id from _cand where slot is null
                 order by (rubric = any (active)), aff, importance desc, sc desc limit n_dec);
  -- Pour vous : meilleurs scores dans les rubriques suivies, sans qu'une rubrique prenne plus que sa part.
  for r in select * from _cand where slot is null order by (rubric = any (active)) desc, sc desc loop
    exit when (select count(*) from _cand where slot is not null) >= quota;
    continue when (select count(*) from _cand where _cand.rubric = r.rubric and slot is not null) >= cap
              and exists (select 1 from _cand x where x.slot is null and x.id <> r.id and (select count(*) from _cand y where y.rubric = x.rubric and y.slot is not null) < cap);
    update _cand set slot = 'pv', why = case when r.fav is not null then 'Vous lisez souvent : ' || r.fav || '.'
                                             when r.rubric = any (active) then 'Vous suivez la rubrique ' || r.rname || '.'
                                             else 'Une info importante du jour.' end
     where id = r.id;
  end loop;

  -- Ordre : les sujets majeurs en tête (d'abord celui qui vous parle le plus), puis le meilleur score
  -- en évitant trois infos de suite de la même rubrique ; la découverte au milieu.
  update _cand set ord = 0 where id = (select id from _cand where slot = 'ess' order by aff desc, sc desc limit 1);
  prev1 := (select rubric from _cand where ord = 0);
  mid := (select count(*) from _cand where slot is not null) / 2;
  loop
    i := i + 1;
    select * into r from _cand where ord is null and slot is not null
     order by (slot = 'ess') desc, (slot = 'dec' and i >= mid) desc, (slot = 'dec') asc,
              coalesce(rubric = prev1 and rubric = prev2, false) asc, aff desc, sc desc limit 1;
    exit when not found;
    update _cand set ord = i where id = r.id;
    prev2 := prev1; prev1 := r.rubric;
  end loop;
  -- Après l'édition : tout le reste, pour « Charger plus ».
  update _cand set slot = 'more', why = 'Pour aller plus loin aujourd''hui.',
         ord = 1000 + x.n from (select id, row_number() over (order by sc desc) n from _cand where slot is null) x where _cand.id = x.id;

  return query select _cand.id, _cand.slot, _cand.why, round(_cand.sc, 3), _cand.ord from _cand order by _cand.ord;
end $$;
revoke all on function public.compose_edition(uuid, text, text[], int, boolean) from public, anon, authenticated;

-- Pour l'app : l'édition du lecteur connecté, ou de l'appareil sans compte.
create or replace function public.my_edition(d text, active text[], quota int, perso boolean default true)
returns table (article_id uuid, slot text, reason text, pos int)
language sql security definer set search_path = public as $$
  select e.article_id, e.slot, e.reason, e.pos from public.compose_edition(auth.uid(), d, active, quota, perso) e;
$$;
grant execute on function public.my_edition(text, text[], int, boolean) to anon, authenticated;

-- 6. Back office ------------------------------------------------------------------------------------------
-- Fiche d'un lecteur : ses goûts et l'édition qu'il recevrait maintenant (avec ses rubriques et son quota).
create or replace function public.admin_reader_algo(uid uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.profiles; act text[]; qt int;
begin
  if not public.is_staff() then raise exception 'Réservé à l''équipe'; end if;
  select * into p from public.profiles where id = uid;
  act := coalesce((select array_agg(x) from jsonb_array_elements_text(case when jsonb_typeof(p.prefs->'active') = 'array' then p.prefs->'active' end) x), '{}');
  qt := coalesce((p.prefs->>'quota')::int, 8);
  return jsonb_build_object(
    'taste', public.reader_taste(uid, null), 'active', act, 'quota', qt,
    'edition', coalesce((select jsonb_agg(jsonb_build_object('title', a.title, 'rubric', a.rubric_id, 'slot', e.slot, 'reason', e.reason, 'score', e.score) order by e.pos)
                 from public.compose_edition(uid, null, act, qt) e join public.articles a on a.id = e.article_id where e.slot <> 'more'), '[]'));
end $$;
revoke all on function public.admin_reader_algo(uuid) from public, anon;
grant execute on function public.admin_reader_algo(uuid) to authenticated;

-- Statistiques des 7 derniers jours.
create or replace function public.algo_stats() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Réservé à l''équipe'; end if;
  return jsonb_build_object(
    'readers_7', (select count(distinct coalesce(user_id::text, device)) from public.reading_events where at > now() - interval '7 days'),
    'events_7', coalesce((select jsonb_object_agg(kind, n) from (select kind, count(*) n from public.reading_events where at > now() - interval '7 days' group by kind) x), '{}'),
    'likes_7', (select count(*) from public.reactions where value = 1 and created_at > now() - interval '7 days'),
    'dislikes_7', (select count(*) from public.reactions where value = -1 and created_at > now() - interval '7 days'),
    'resets_7', (select count(*) from public.taste_resets where at > now() - interval '7 days'),
    'topics', coalesce((select jsonb_agg(jsonb_build_object('topic', t, 'articles', n_a, 'reads', n_r) order by n_r desc) from (
        select t.t, count(distinct x.article_id) n_a, count(e.id) filter (where e.kind in ('summary', 'click', 'share')) n_r
          from public.article_topics x
          join public.articles a on a.id = x.article_id
          cross join lateral unnest(x.topics) t(t)
          left join public.reading_events e on e.article_id = x.article_id and e.at > now() - interval '7 days'
         where a.edition_date > current_date - 7 group by t.t order by 3 desc, 2 desc limit 15) y), '[]'),
    'untagged', (select count(*) from public.articles a left join public.article_topics t on t.article_id = a.id
                  where a.edition_date > current_date - 7 and a.status = 'published' and coalesce(cardinality(t.topics), 0) = 0));
end $$;
revoke all on function public.algo_stats() from public, anon;
grant execute on function public.algo_stats() to authenticated;

-- Journal de lecture plus vieux que la durée de conservation : effacé (appelé par le moteur).
create or replace function public.purge_reading_events() returns int
language sql security definer set search_path = public as $$
  with d as (delete from public.reading_events where at < now() - make_interval(days => (public.algo_conf()->>'keep_days')::int) returning 1)
  select count(*)::int from d;
$$;
revoke all on function public.purge_reading_events() from public, anon, authenticated;

-- 7. Mots-clés de départ (modifiables dans le back office) ------------------------------------------------
-- Volontairement aucun parti, candidat ni religion : on ne profile pas les opinions (RGPD art. 9).
insert into public.algo_keywords (label, words) values
  ('IA', '{intelligence artificielle,ChatGPT,OpenAI,Mistral AI,algorithme}'),
  ('Cybersécurité', '{cyberattaque,piratage,rançongiciel,hacker,fuite de données}'),
  ('Smartphones', '{iPhone,Android,smartphone,téléphone portable}'),
  ('Espace', '{fusée,satellite,Nasa,ESA,astronaute,Lune}'),
  ('Santé', '{hôpital,médecin,vaccin,épidémie,maladie,Sécurité sociale}'),
  ('Climat', '{réchauffement,canicule,CO2,émissions,COP,sécheresse}'),
  ('Énergie', '{électricité,nucléaire,EDF,pétrole,gaz,solaire,éolien}'),
  ('Transports', '{SNCF,train,TGV,métro,aérien,avion,grève des transports}'),
  ('Automobile', '{voiture,véhicule électrique,Renault,Stellantis,Tesla}'),
  ('Immobilier', '{logement,loyer,crédit immobilier,prix de l''immobilier}'),
  ('Emploi', '{chômage,embauche,licenciement,salaire,France Travail}'),
  ('Inflation', '{pouvoir d''achat,hausse des prix,BCE,taux d''intérêt}'),
  ('Impôts', '{fiscalité,impôt,taxe,TVA,budget}'),
  ('Retraites', '{retraite,pension,réforme des retraites}'),
  ('Bourse', '{CAC 40,marchés financiers,actionnaires,Wall Street}'),
  ('Entreprises', '{start-up,startup,PME,rachat,chiffre d''affaires}'),
  ('Agriculture', '{agriculteur,agricole,récolte,élevage,PAC}'),
  ('Éducation', '{école,lycée,université,enseignant,bac,élève}'),
  ('Justice', '{procès,tribunal,condamné,juge,enquête}'),
  ('Sécurité', '{police,gendarmerie,délinquance,attentat}'),
  ('Élections', '{élection,scrutin,vote,sondage,campagne électorale}'),
  ('Parlement', '{Assemblée nationale,Sénat,député,sénateur,projet de loi}'),
  ('Europe', '{Union européenne,UE,Bruxelles,Commission européenne,Parlement européen}'),
  ('États-Unis', '{Washington,Maison Blanche,américain,Congrès américain}'),
  ('Chine', '{Pékin,chinois}'),
  ('Ukraine', '{Kiev,Russie,Moscou,Kremlin}'),
  ('Proche-Orient', '{Israël,Gaza,Liban,Iran,Palestinien}'),
  ('Afrique', '{africain,Sahel,Maghreb}'),
  ('Football', '{Ligue 1,Ligue des champions,PSG,Mbappé,footballeur}'),
  ('Rugby', '{XV de France,Top 14,Six Nations}'),
  ('Tennis', '{Roland-Garros,Wimbledon,ATP,WTA}'),
  ('Cyclisme', '{Tour de France,vélo,peloton}'),
  ('Formule 1', '{F1,Grand Prix}'),
  ('Jeux olympiques', '{JO,olympique,paralympique}'),
  ('Cinéma', '{film,festival de Cannes,box-office,réalisateur}'),
  ('Musique', '{concert,album,chanteur,chanteuse,festival}'),
  ('Livres', '{roman,écrivain,prix Goncourt,librairie}'),
  ('Séries', '{série,Netflix,streaming}'),
  ('Jeux vidéo', '{jeu vidéo,console,PlayStation,Nintendo,Xbox}'),
  ('Environnement', '{biodiversité,pollution,océan,forêt,recyclage}')
on conflict (label) do nothing;

-- ===== supabase/migrations/0016_sujets_sensibles.sql
-- Sujets sensibles (drame, attentat, accident grave…) : une case sur chaque info, cochée par l'IA ou la rédaction.
-- Effets : l'algorithme ne les pousse jamais parce qu'ils attirent les clics (intérêt collectif neutre),
-- et l'app ne place pas de pub juste après. Leur place dépend seulement de leur importance.
alter table public.articles add column if not exists sensitive boolean not null default false;

create or replace function public.compose_edition(uid uuid, dev text, active text[], quota int, perso boolean default true)
returns table (article_id uuid, slot text, reason text, score numeric, pos int)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  c jsonb := public.algo_conf();
  taste jsonb := case when perso and (c->>'enabled')::boolean then public.reader_taste(uid, dev) else '{"rubrics":{},"topics":{},"n":0}' end;
  k numeric := greatest((c->>'smooth')::numeric, 0.1);
  wa numeric; wi numeric;
  n_ess int; n_dec int; cap int;
  ed date := (select e.date from public.editions e where e.status = 'published' order by e.date desc limit 1);
  r record; prev1 text; prev2 text; i int := 0; mid int;
begin
  quota := least(greatest(coalesce(quota, 8), 1), 100);
  active := coalesce(active, '{}');
  -- Le poids des goûts monte avec le nombre de signaux ; ce qu'il ne prend pas va à l'importance.
  wa := case when not (perso and (c->>'enabled')::boolean) then 0
             else (c->>'affinity_start')::numeric + ((c->>'w_affinity')::numeric - (c->>'affinity_start')::numeric)
                  * least(1, (taste->>'n')::numeric / greatest((c->>'ramp')::numeric, 1)) end;
  wi := (c->>'w_importance')::numeric + (c->>'w_affinity')::numeric - wa;
  n_ess := greatest(1, round(quota * (c->>'share_essential')::numeric / 100));
  n_dec := case when (c->>'share_discovery')::numeric > 0 then greatest(1, round(quota * (c->>'share_discovery')::numeric / 100)) else 0 end;
  cap := case when cardinality(active) <= 2 then quota else greatest(1, ceil(quota * (c->>'max_rubric')::numeric / 100)) end;

  create temp table if not exists _cand (id uuid, rubric text, rname text, essential boolean, importance int,
    aff numeric, fav text, sc numeric, slot text, why text, ord int) on commit drop;
  truncate _cand;

  insert into _cand (id, rubric, rname, essential, importance, aff, fav, sc)
  with art as (
    select a.id, a.rubric_id, rb.name, a.essential, a.sensitive, a.importance, coalesce(a.published_at, a.created_at) as at,
           coalesce(t.topics, '{}') as topics
      from public.articles a join public.rubrics rb on rb.id = a.rubric_id
      left join public.article_topics t on t.article_id = a.id
     where a.edition_date = ed and a.status = 'published'
       -- « Moins de sujets comme ça » : cette info-là ne revient pas.
       and not exists (select 1 from public.reading_events e where e.article_id = a.id and e.kind = 'less'
                        and ((uid is not null and e.user_id = uid) or (uid is null and e.device = dev)))
  ),
  -- Intérêt collectif : part des lecteurs qui ouvrent, partagent ou cliquent (rang parmi les infos assez vues).
  coll as (
    select e.article_id, count(distinct e.device) filter (where e.kind = 'view') as views,
           count(distinct e.device) filter (where e.kind = 'summary') + 2 * count(distinct e.device) filter (where e.kind in ('share', 'click')) as eng
      from public.reading_events e where e.article_id in (select id from art) group by e.article_id
  ),
  coll_rank as (
    select article_id, percent_rank() over (order by eng::numeric / views) as pr
      from coll where views >= (c->>'min_views')::int
  ),
  aff as (
    select art.*,
           0.5 + 0.5 * coalesce((taste->'rubrics'->>art.rubric_id)::numeric, 0) / (abs(coalesce((taste->'rubrics'->>art.rubric_id)::numeric, 0)) + k) as ra,
           (select t from unnest(art.topics) t where (taste->'topics'->>t)::numeric > 0 order by (taste->'topics'->>t)::numeric desc limit 1) as fav
      from art
  ),
  aff2 as (
    select aff.*, coalesce((select avg(case when taste->'topics' ? t
                    then 0.5 + 0.5 * (taste->'topics'->>t)::numeric / (abs((taste->'topics'->>t)::numeric) + k) else aff.ra end)
                  from unnest(aff.topics) t), aff.ra) as ta
      from aff
  )
  select a2.id, a2.rubric_id, a2.name, a2.essential, a2.importance, (a2.ra + a2.ta) / 2, a2.fav,
         (wi * a2.importance / 10.0
          + wa * (a2.ra + a2.ta) / 2
          -- Sujet sensible : jamais poussé parce qu'il attire les clics (intérêt collectif neutre).
          + (c->>'w_collective')::numeric * case when a2.sensitive then 0.5 else coalesce((select pr from coll_rank where coll_rank.article_id = a2.id), 0.5) end
          + (c->>'w_fresh')::numeric * greatest(0, 1 - extract(epoch from now() - a2.at) / 86400)) / 100
    from aff2 a2;

  -- À ne pas manquer : les sujets majeurs du jour, pour tout le monde.
  update _cand set slot = 'ess', why = 'Sujet majeur du jour, proposé à tout le monde.'
   where id in (select id from _cand order by essential desc, importance desc, sc desc limit n_ess);
  -- Découverte : un sujet important d'une rubrique non suivie (sinon de la rubrique la moins lue).
  update _cand set slot = 'dec', why = 'Pour découvrir la rubrique ' || rname || '.'
   where id in (select id from _cand where slot is null
                 order by (rubric = any (active)), aff, importance desc, sc desc limit n_dec);
  -- Pour vous : meilleurs scores dans les rubriques suivies, sans qu'une rubrique prenne plus que sa part.
  for r in select * from _cand where slot is null order by (rubric = any (active)) desc, sc desc loop
    exit when (select count(*) from _cand where slot is not null) >= quota;
    continue when (select count(*) from _cand where _cand.rubric = r.rubric and slot is not null) >= cap
              and exists (select 1 from _cand x where x.slot is null and x.id <> r.id and (select count(*) from _cand y where y.rubric = x.rubric and y.slot is not null) < cap);
    update _cand set slot = 'pv', why = case when r.fav is not null then 'Vous lisez souvent : ' || r.fav || '.'
                                             when r.rubric = any (active) then 'Vous suivez la rubrique ' || r.rname || '.'
                                             else 'Une info importante du jour.' end
     where id = r.id;
  end loop;

  -- Ordre : les sujets majeurs en tête (d'abord celui qui vous parle le plus), puis le meilleur score
  -- en évitant trois infos de suite de la même rubrique ; la découverte au milieu.
  update _cand set ord = 0 where id = (select id from _cand where slot = 'ess' order by aff desc, sc desc limit 1);
  prev1 := (select rubric from _cand where ord = 0);
  mid := (select count(*) from _cand where slot is not null) / 2;
  loop
    i := i + 1;
    select * into r from _cand where ord is null and slot is not null
     order by (slot = 'ess') desc, (slot = 'dec' and i >= mid) desc, (slot = 'dec') asc,
              coalesce(rubric = prev1 and rubric = prev2, false) asc, aff desc, sc desc limit 1;
    exit when not found;
    update _cand set ord = i where id = r.id;
    prev2 := prev1; prev1 := r.rubric;
  end loop;
  -- Après l'édition : tout le reste, pour « Charger plus ».
  update _cand set slot = 'more', why = 'Pour aller plus loin aujourd''hui.',
         ord = 1000 + x.n from (select id, row_number() over (order by sc desc) n from _cand where slot is null) x where _cand.id = x.id;

  return query select _cand.id, _cand.slot, _cand.why, round(_cand.sc, 3), _cand.ord from _cand order by _cand.ord;
end $$;
revoke all on function public.compose_edition(uuid, text, text[], int, boolean) from public, anon, authenticated;

-- ===== supabase/migrations/0017_identite.sql
-- Personnalisation de l'app depuis le back office (page « Personnalisation ») :
-- identité (nom, logo, couleurs, police), textes de l'app, notification du matin et e-mails des comptes.
-- Chaque groupe est un réglage JSON ; l'app le lit au démarrage et garde ses valeurs par défaut si rien n'est réglé.

insert into public.setting_keys (key) values
  ('BRAND'), ('APP_TEXTS'), ('NOTIFICATIONS'),
  ('MAIL_SENDER_NAME'), ('MAIL_SENDER_EMAIL'),
  ('SMTP_HOST'), ('SMTP_PORT'), ('SMTP_USER'), ('SMTP_PASS_KEY'),
  ('MAIL_CONFIRM_SUBJECT'), ('MAIL_CONFIRM_BODY'), ('MAIL_RESET_SUBJECT'), ('MAIL_RESET_BODY')
on conflict do nothing;

-- (bloc commun) set_setting : les modèles d'e-mails et les textes de l'app peuvent dépasser 2 000 caractères.
create or replace function public.set_setting(k text, v text)
returns void language plpgsql security definer set search_path = public as $$
declare lim int := case when k like 'MAIL_%_BODY' or k = 'APP_TEXTS' then 10000 else 2000 end;
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  if not exists (select 1 from public.setting_keys where key = k) then
    raise exception 'Réglage inconnu : %', k;
  end if;
  if char_length(coalesce(v, '')) > lim then raise exception 'Valeur trop longue (% caractères au plus)', lim; end if;
  if coalesce(trim(v), '') = '' then
    delete from public.app_settings where key = k;
  else
    insert into public.app_settings (key, value, updated_at, updated_by) values (k, trim(v), now(), auth.uid())
    on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
  end if;
  insert into public.audit_log (actor, action, target, detail)
  values (auth.uid(), 'Réglage modifié', k, case when k like '%_KEY' then 'clé remplacée' else left(coalesce(trim(v), ''), 200) end);
end $$;
-- (fin du bloc commun)

-- Lit un réglage JSON ; un contenu abîmé est ignoré (l'app garde alors ses valeurs par défaut).
create or replace function public.setting_json(k text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v text;
begin
  select value into v from public.app_settings where key = k;
  if v is null then return null; end if;
  return v::jsonb;
exception when others then
  return null;
end $$;
revoke all on function public.setting_json(text) from public, anon, authenticated;

-- Réglages publics lus par l'app (rien de secret) : on y ajoute l'identité, les textes et la notification.
create or replace function public.app_config() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'comments_mode', coalesce((select value from public.app_settings where key = 'COMMENTS_MODE'), 'comments'),
    'brand', public.setting_json('BRAND'),
    'texts', public.setting_json('APP_TEXTS'),
    'notifications', public.setting_json('NOTIFICATIONS')
  );
$$;
grant execute on function public.app_config() to anon, authenticated;

-- ===== supabase/migrations/0018_reglages_app.sql
-- Tout ce qui restait écrit en dur devient réglable dans le back office (Personnalisation > Règles de l'app,
-- Messages compte et Premium ; Réglages > Modération). Chaque réglage vide garde la valeur d'origine.

insert into public.setting_keys (key) values ('APP_RULES'), ('NUDGES'), ('COMMENT_RATE'), ('REPORTS_TO_HIDE')
on conflict do nothing;

-- Entier réglé dans le back office, borné ; sinon la valeur par défaut.
create or replace function public.setting_int(k text, def int, lo int, hi int) returns int
language plpgsql stable security definer set search_path = public as $$
declare v int;
begin
  select value::int into v from public.app_settings where key = k;
  return greatest(lo, least(hi, coalesce(v, def)));
exception when others then
  return def;
end $$;
revoke all on function public.setting_int(text, int, int, int) from public, anon, authenticated;

-- Garde-fous des commentaires : le nombre de commentaires par minute se règle (5 par défaut).
create or replace function public.guard_comment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_staff() then return new; end if;
  if exists (select 1 from public.profiles where id = new.user_id and banned) then
    raise exception 'Votre compte ne peut plus commenter';
  end if;
  if not exists (select 1 from public.profiles where id = new.user_id and pseudo is not null) then
    raise exception 'Choisissez un pseudo avant de commenter';
  end if;
  if not exists (select 1 from public.articles where id = new.article_id and status = 'published') then
    raise exception 'Cette info n''est plus en ligne';
  end if;
  if public.has_insult(new.text) then
    raise exception 'Ce commentaire contient un mot interdit. Reformulez sans insulte.';
  end if;
  if (select count(*) from public.comments where user_id = new.user_id and created_at > now() - interval '1 minute')
     >= public.setting_int('COMMENT_RATE', 5, 1, 60) then
    raise exception 'Doucement : attendez un instant avant de commenter à nouveau';
  end if;
  new.text := trim(new.text);
  return new;
end $$;

-- Masquage automatique : au N-ième signalement (3 par défaut, 0 = jamais).
create or replace function public.auto_hide_reported() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int := public.setting_int('REPORTS_TO_HIDE', 3, 0, 50);
begin
  if n > 0 and (select count(*) from public.reports where comment_id = new.comment_id and not resolved) >= n then
    update public.comments set status = 'hidden' where id = new.comment_id and status = 'visible';
  end if;
  return new;
end $$;

-- Réglages publics lus par l'app : on ajoute les règles de l'app et les messages compte / Premium.
create or replace function public.app_config() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'comments_mode', coalesce((select value from public.app_settings where key = 'COMMENTS_MODE'), 'comments'),
    'brand', public.setting_json('BRAND'),
    'texts', public.setting_json('APP_TEXTS'),
    'notifications', public.setting_json('NOTIFICATIONS'),
    'rules', public.setting_json('APP_RULES'),
    'nudges', public.setting_json('NUDGES')
  );
$$;
grant execute on function public.app_config() to anon, authenticated;

-- ===== supabase/migrations/0019_moteur_sources.sql
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

-- ===== supabase/migrations/0020_budget_ia.sql
-- Budget de l'IA : plafond de dépense par jour et par mois, et interrupteur qui coupe toute dépense.
-- Les montants sont en dollars, comme la facture d'Anthropic et le Tableau de bord (estimation par run_cost).
insert into public.setting_keys (key) values ('AI_OFF'), ('AI_BUDGET_DAY'), ('AI_BUDGET_MONTH') on conflict do nothing;

-- Dépense estimée de l'IA aujourd'hui et ce mois-ci (heure de Paris), passages en cours compris.
-- Appelée par le moteur (sans compte) et par l'équipe dans le back office.
create or replace function public.ai_spend() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare today date := (now() at time zone 'Europe/Paris')::date;
begin
  if auth.uid() is not null and not public.is_staff() then raise exception 'Réservé à l''équipe'; end if;
  return jsonb_build_object(
    'today', (select coalesce(sum(public.run_cost(stats)), 0) from public.engine_runs where (started_at at time zone 'Europe/Paris')::date = today),
    'month', (select coalesce(sum(public.run_cost(stats)), 0) from public.engine_runs where date_trunc('month', started_at at time zone 'Europe/Paris') = date_trunc('month', today::timestamp)));
end $$;
revoke all on function public.ai_spend() from public, anon;
grant execute on function public.ai_spend() to authenticated;

-- ===== supabase/migrations/0021_relance_auto.sql
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

-- ===== supabase/migrations/0022_reconnaissance.sql
-- Reconnaissance des lecteurs : badges (Premium, paliers de lecture, Bienfaiteur et statuts donnés à la main,
-- équipe, ancienneté, pionniers, commentaires appréciés), tous réglables dans le back office (Lecteurs > Reconnaissance).
-- Un lecteur peut cacher les siens. Aussi : nombre de lecteurs qui ont vu chaque info (pouces remplis selon le ratio).

insert into public.setting_keys (key) values ('RECOGNITION') on conflict do nothing;

alter table public.profiles add column if not exists show_badges boolean not null default true;
create index if not exists profiles_created on public.profiles (created_at);

-- 1. Les badges ----------------------------------------------------------------------------------------
-- kind : premium (abonné), reads (a lu au moins N infos), manual (donné à la main, ex. Bienfaiteur),
-- team (membre de l'équipe), seniority (compte de plus de N jours), early (parmi les N premiers comptes),
-- liked (ses commentaires ont reçu au moins N likes), streak (venu N jours d'affilée), early_bird (a lu avant 8 h
-- au moins N matins), explorer (a lu des infos dans au moins N rubriques), sharer (a partagé au moins N infos),
-- event (a ouvert l'app entre starts_at et ends_at : badge d'un événement ou d'une période).
create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('premium', 'reads', 'manual', 'team', 'seniority', 'early', 'liked', 'streak', 'early_bird', 'explorer', 'sharer', 'event')),
  label text not null check (char_length(label) between 1 and 30),
  description text not null default '' check (char_length(description) <= 200),
  icon text not null default '⭐' check (char_length(icon) between 1 and 8),
  color text not null default '#7B5CFF' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  threshold int not null default 0 check (threshold >= 0),
  position int not null default 0,
  starts_at date,
  ends_at date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.badges enable row level security;
drop policy if exists badges_read on public.badges;
create policy badges_read on public.badges for select using (active or public.is_admin());
drop policy if exists badges_admin on public.badges;
create policy badges_admin on public.badges for all using (public.is_admin()) with check (public.is_admin());
grant select on public.badges to anon;
grant select, insert, update, delete on public.badges to authenticated;

insert into public.badges (kind, label, description, icon, color, threshold, position, starts_at, ends_at)
select kind, label, description, icon, color, threshold, position,
       case when kind = 'event' then current_date end, case when kind = 'event' then current_date + 60 end
  from (values
  ('premium', 'Premium', 'Abonné Premium : soutient l''app.', '💎', '#C86BFA', 0, 1),
  ('manual', 'Bienfaiteur', 'A proposé des idées pour améliorer l''app.', '💌', '#FFB547', 0, 2),
  ('team', 'Équipe', 'Fait partie de l''équipe.', '🛡️', '#3D7BFF', 0, 3),
  ('reads', 'Curieux', 'A lu plus de 50 infos.', '📖', '#5AD1B5', 50, 10),
  ('reads', 'Assidu', 'A lu plus de 250 infos.', '📚', '#4FB0FF', 250, 11),
  ('reads', 'Érudit', 'A lu plus de 1 000 infos.', '🧠', '#9A7BFF', 1000, 12),
  ('reads', 'Encyclopédie', 'A lu plus de 5 000 infos.', '🏆', '#FFD166', 5000, 13),
  ('early', 'Pionnier', 'Parmi les 1 000 premiers comptes.', '🚀', '#FF8A7A', 1000, 20),
  ('seniority', 'Fidèle', 'Membre depuis plus d''un an.', '🎂', '#FF6B8A', 365, 21),
  ('liked', 'Plume appréciée', 'Ses commentaires ont reçu plus de 100 likes.', '✍️', '#7B5CFF', 100, 22),
  ('streak', 'Série de 7 jours', 'Venu 7 jours d''affilée.', '🔥', '#FF8A3D', 7, 30),
  ('streak', 'Série de 30 jours', 'Venu 30 jours d''affilée.', '⚡', '#FFB547', 30, 31),
  ('streak', 'Série de 100 jours', 'Venu 100 jours d''affilée.', '💯', '#FF6B8A', 100, 32),
  ('early_bird', 'Lève-tôt', 'A lu son édition avant 8 h, 20 matins.', '☀️', '#FFD166', 20, 33),
  ('explorer', 'Explorateur', 'A lu des infos dans les 10 rubriques.', '🧭', '#5AD1B5', 10, 34),
  ('sharer', 'Partageur', 'A partagé 10 infos.', '📣', '#4FB0FF', 10, 35),
  ('event', 'Présent au lancement', 'Était là pendant les deux premiers mois.', '🎉', '#C86BFA', 0, 40)
) v (kind, label, description, icon, color, threshold, position)
where not exists (select 1 from public.badges);

-- Statuts donnés à la main (Bienfaiteur et ceux que l'équipe crée).
create table if not exists public.user_badges (
  user_id uuid not null references auth.users (id) on delete cascade,
  badge_id uuid not null references public.badges (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);
alter table public.user_badges enable row level security;
revoke all on public.user_badges from anon, authenticated;

-- 2. Infos lues par compte, gardées pour toujours (le journal de lecture, lui, s'efface après 90 jours) ------
create table if not exists public.user_reads (
  user_id uuid not null references auth.users (id) on delete cascade,
  article_id uuid not null,
  at timestamptz not null default now(),
  primary key (user_id, article_id)
);
alter table public.user_reads enable row level security;
revoke all on public.user_reads from anon, authenticated;
insert into public.user_reads (user_id, article_id, at)
select user_id, article_id, min(at) from public.reading_events where kind = 'view' and user_id is not null group by 1, 2
on conflict do nothing;

-- Partages par compte, gardés pour toujours aussi.
create table if not exists public.user_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  shares int not null default 0
);
alter table public.user_stats enable row level security;
revoke all on public.user_stats from anon, authenticated;
insert into public.user_stats (user_id, shares)
select user_id, count(*) from public.reading_events where kind = 'share' and user_id is not null group by 1
on conflict (user_id) do nothing;

-- Même fonction que dans 0015, qui note en plus chaque info vue par un lecteur connecté.
create or replace function public.track(d text, ev jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if char_length(coalesce(d, '')) not between 8 and 64 or jsonb_typeof(ev) <> 'array' then return; end if;
  if auth.uid() is not null then
    with up as (update public.reading_events set user_id = auth.uid() where device = d and user_id is null returning article_id, kind)
    insert into public.user_reads (user_id, article_id) select distinct auth.uid(), article_id from up where kind = 'view'
    on conflict do nothing;
    -- La visite du jour compte pour le compte (séries), même si le lecteur s'est connecté après l'ouverture.
    update public.visits set user_id = auth.uid() where device = d and day = (now() at time zone 'Europe/Paris')::date and user_id is null;
  end if;
  with ins as (
    insert into public.reading_events (device, user_id, article_id, kind, ms)
    select d, auth.uid(), a.id, e->>'k', least(greatest((e->>'ms')::int, 0), 600000)
      from (select value e from jsonb_array_elements(ev) limit 100) x
      join public.articles a on a.id::text = e->>'a' and a.status = 'published'
     where e->>'k' in ('view', 'summary', 'summary_end', 'source', 'click', 'share', 'back', 'less')
    returning user_id, article_id, kind),
  r as (insert into public.user_reads (user_id, article_id) select distinct user_id, article_id from ins where kind = 'view' and user_id is not null
        on conflict do nothing returning 1)
  insert into public.user_stats (user_id, shares) select user_id, count(*) from ins where kind = 'share' and user_id is not null group by user_id
  on conflict (user_id) do update set shares = public.user_stats.shares + excluded.shares;
end $$;
grant execute on function public.track(text, jsonb) to anon, authenticated;

-- 3. Réglages (JSON « RECOGNITION ») : minutes gagnées par info lue, icônes à côté du pseudo, pseudo coloré ----
create or replace function public.recognition_conf() returns jsonb
language sql stable security definer set search_path = public as $$
  select '{"minutes_per_article": 3, "max_icons": 3, "color_pseudo": true}'::jsonb || coalesce(public.setting_json('RECOGNITION'), '{}'::jsonb);
$$;
grant execute on function public.recognition_conf() to anon, authenticated;

-- Badges d'un compte, dans l'ordre choisi. Pour les paliers (lecture, ancienneté, pionnier, likes), seul le plus haut atteint.
create or replace function public.badges_of(uid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  with p as (select * from public.profiles where id = uid),
  n as (select count(*)::int v from public.user_reads where user_id = uid),
  l as (select count(*)::int v from public.comment_votes v join public.comments c on c.id = v.comment_id
         where c.user_id = uid and c.status = 'visible' and v.value = 1),
  got as (
    select b.* from public.badges b, p, n, l
     where b.active and case b.kind
       when 'premium' then p.premium and (p.premium_until is null or p.premium_until > now())
       when 'team' then p.role <> 'reader'
       when 'reads' then n.v >= b.threshold
       when 'seniority' then p.created_at <= now() - make_interval(days => b.threshold)
       when 'early' then (select count(*) from public.profiles q where q.created_at < p.created_at) < b.threshold
       when 'liked' then l.v >= b.threshold
       -- plus longue suite de jours de visite consécutifs
       when 'streak' then coalesce((select max(n) from (select count(*) n from (select day - (row_number() over (order by day))::int g
                           from (select distinct day from public.visits where user_id = uid) d) x group by g) y), 0) >= b.threshold
       when 'early_bird' then (select count(distinct (at at time zone 'Europe/Paris')::date) from public.user_reads
                                where user_id = uid and extract(hour from at at time zone 'Europe/Paris') < 8) >= b.threshold
       when 'explorer' then (select count(distinct a.rubric_id) from public.user_reads r join public.articles a on a.id = r.article_id
                              where r.user_id = uid) >= b.threshold
       when 'sharer' then coalesce((select shares from public.user_stats where user_id = uid), 0) >= b.threshold
       when 'event' then exists (select 1 from public.visits v where v.user_id = uid and v.day between b.starts_at and b.ends_at)
       else exists (select 1 from public.user_badges u where u.user_id = uid and u.badge_id = b.id)
     end),
  best as (
    select *, row_number() over (
      partition by case when kind in ('reads', 'seniority', 'liked', 'early', 'streak', 'early_bird', 'explorer', 'sharer') then kind else id::text end
      order by case when kind = 'early' then -threshold else threshold end desc) rn
    from got)
  select coalesce(jsonb_agg(jsonb_build_object('label', label, 'description', description, 'icon', icon, 'color', color, 'kind', kind)
                  order by position, threshold desc), '[]'::jsonb)
    from best where rn = 1;
$$;
revoke all on function public.badges_of(uuid) from public, anon, authenticated;

-- Fiche publique d'un lecteur, ouverte en touchant son pseudo sous un commentaire (cid), ou la mienne (cid vide).
-- Badges cachés par le lecteur : seulement le pseudo.
create or replace function public.reader_card(cid uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid; p public.profiles; n int;
begin
  if cid is null then uid := auth.uid();
  else select c.user_id into uid from public.comments c where c.id = cid and c.status = 'visible';
  end if;
  select * into p from public.profiles where id = uid;
  if not found then return null; end if;
  if not p.show_badges and uid is distinct from auth.uid() then
    return jsonb_build_object('pseudo', p.pseudo, 'hidden', true);
  end if;
  select count(*) into n from public.user_reads where user_id = uid;
  return jsonb_build_object(
    'pseudo', p.pseudo, 'hidden', false, 'show', p.show_badges, 'since', p.created_at, 'reads', n,
    'minutes_saved', n * (public.recognition_conf()->>'minutes_per_article')::numeric,
    'badges', public.badges_of(uid));
end $$;
grant execute on function public.reader_card(uuid) to anon, authenticated;

-- Commentaires : on ajoute les badges de l'auteur (vides s'il les cache).
drop function if exists public.article_comments(uuid);
create function public.article_comments(aid uuid)
returns table (id uuid, text text, pseudo text, created_at timestamptz, likes int, dislikes int, mine smallint, own boolean, premium boolean, badges jsonb)
language sql stable security definer set search_path = public as $$
  select c.id, c.text, coalesce(p.pseudo, 'lecteur'), c.created_at,
         coalesce(sum(case when v.value = 1 then 1 else 0 end), 0)::int,
         coalesce(sum(case when v.value = -1 then 1 else 0 end), 0)::int,
         coalesce(max(case when v.user_id = auth.uid() then v.value end), 0)::smallint,
         coalesce(c.user_id = auth.uid(), false),
         coalesce(p.premium, false),
         case when coalesce(p.show_badges, true) then public.badges_of(c.user_id) else '[]'::jsonb end
    from public.comments c
    join public.articles a on a.id = c.article_id and a.status = 'published'
    left join public.profiles p on p.id = c.user_id
    left join public.comment_votes v on v.comment_id = c.id
   where c.article_id = aid and c.status = 'visible'
     and not exists (select 1 from public.blocks b where b.user_id = auth.uid() and b.blocked_id = c.user_id)
   group by c.id, p.pseudo, p.premium, p.show_badges
   order by c.created_at desc
   limit 200;
$$;
grant execute on function public.article_comments(uuid) to anon, authenticated;

-- 4. Back office : donner ou retirer un statut à la main, voir qui l'a -----------------------------------------
create or replace function public.grant_badge(uid uuid, bid uuid, give boolean) returns void
language plpgsql security definer set search_path = public as $$
declare b text; who text;
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  select label into b from public.badges where id = bid and kind = 'manual';
  if b is null then raise exception 'Seuls les statuts « donnés à la main » s''attribuent'; end if;
  select coalesce(pseudo, uid::text) into who from public.profiles where id = uid;
  if give then
    insert into public.user_badges (user_id, badge_id, granted_by) values (uid, bid, auth.uid()) on conflict do nothing;
  else
    delete from public.user_badges where user_id = uid and badge_id = bid;
  end if;
  insert into public.audit_log (actor, action, target, detail)
  values (auth.uid(), case when give then 'Statut attribué' else 'Statut retiré' end, who, b);
end $$;
revoke all on function public.grant_badge(uuid, uuid, boolean) from public, anon;
grant execute on function public.grant_badge(uuid, uuid, boolean) to authenticated;

create or replace function public.badge_holders(bid uuid)
returns table (user_id uuid, pseudo text, email text, granted_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  return query select u.user_id, p.pseudo, a.email::text, u.granted_at
    from public.user_badges u left join public.profiles p on p.id = u.user_id left join auth.users a on a.id = u.user_id
   where u.badge_id = bid order by u.granted_at desc;
end $$;
revoke all on function public.badge_holders(uuid) from public, anon;
grant execute on function public.badge_holders(uuid) to authenticated;

-- 5. Lecteurs qui ont vu chaque info (comptes et appareils sans compte) : likes et dislikes deviennent un ratio ----
create or replace view public.article_stats as
select a.id as article_id,
  coalesce(sum(case when r.value = 1 then 1 else 0 end), 0)::int as likes,
  coalesce(sum(case when r.value = -1 then 1 else 0 end), 0)::int as dislikes,
  (select count(*) from public.comments c where c.article_id = a.id and c.status = 'visible')::int as comments,
  (select count(distinct coalesce(e.user_id::text, e.device)) from public.reading_events e
    where e.article_id = a.id and e.kind = 'view')::int as views
from public.articles a left join public.reactions r on r.article_id = a.id
where a.status = 'published'
group by a.id;

-- 6. Réglages publics lus par l'app : on ajoute ceux de la reconnaissance.
create or replace function public.app_config() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'comments_mode', coalesce((select value from public.app_settings where key = 'COMMENTS_MODE'), 'comments'),
    'brand', public.setting_json('BRAND'),
    'texts', public.setting_json('APP_TEXTS'),
    'notifications', public.setting_json('NOTIFICATIONS'),
    'rules', public.setting_json('APP_RULES'),
    'nudges', public.setting_json('NUDGES'),
    'recognition', public.recognition_conf()
  );
$$;
grant execute on function public.app_config() to anon, authenticated;

-- ===== supabase/migrations/0023_parrainage.sql
-- Parrainage : chaque lecteur a un lien d'invitation (et le code qui va avec). Un ami qui crée son compte avec ce lien,
-- ou qui tape le code dans les jours qui suivent, devient son filleul. Le parrainage est validé quand le filleul a
-- vraiment lu quelques infos (contre les faux comptes) : il compte alors pour le badge Ambassadeur et, si c'est réglé,
-- offre des jours Premium au parrain et au filleul. Tout se règle dans le back office (Lecteurs > Parrainage).

insert into public.setting_keys (key) values ('REFERRAL') on conflict do nothing;

-- 1. Codes et parrainages (fermés au public : tout passe par les fonctions ci-dessous) -------------------------
create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{4,12}$'),
  created_at timestamptz not null default now()
);
alter table public.referral_codes enable row level security;
revoke all on public.referral_codes from anon, authenticated;

create table if not exists public.referrals (
  referee uuid primary key references auth.users (id) on delete cascade, -- un filleul n'a qu'un parrain
  referrer uuid not null references auth.users (id) on delete cascade,
  via text not null default 'link' check (via in ('link', 'code')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  referrer_days int not null default 0, -- jours Premium offerts au parrain pour ce filleul
  referee_days int not null default 0,  -- jours Premium offerts au filleul
  check (referee <> referrer)
);
create index if not exists referrals_referrer on public.referrals (referrer, confirmed_at);
alter table public.referrals enable row level security;
revoke all on public.referrals from anon, authenticated;

-- 2. Réglages (JSON « REFERRAL ») ------------------------------------------------------------------------------
-- enabled : parrainage ouvert ; confirm_reads : infos lues par le filleul pour valider ; referrer_days / referee_days :
-- jours Premium offerts (0 = aucun) ; max_rewarded : filleuls récompensés au plus par parrain (le badge, lui, continue) ;
-- claim_days : jours après l'inscription pendant lesquels on peut encore taper un code ; link : adresse du lien
-- (vide = la version web de l'app) ; share_text : message partagé, {lien} et {code} sont remplacés.
create or replace function public.referral_conf() returns jsonb
language sql stable security definer set search_path = public as $$
  select '{"enabled": true, "confirm_reads": 5, "referrer_days": 7, "referee_days": 7, "max_rewarded": 10, "claim_days": 14, "link": "",
           "share_text": "J''ai trouvé une app qui résume l''actu du jour en quelques minutes. Essaie-la avec mon lien : {lien}"}'::jsonb
         || coalesce(public.setting_json('REFERRAL'), '{}'::jsonb);
$$;
revoke all on function public.referral_conf() from public, anon, authenticated;

-- 3. Le badge Ambassadeur : nouveau type « referral » (filleuls validés au moins N) ----------------------------
alter table public.badges drop constraint if exists badges_kind_check;
alter table public.badges add constraint badges_kind_check check (kind in ('premium', 'reads', 'manual', 'team', 'seniority', 'early', 'liked',
  'streak', 'early_bird', 'explorer', 'sharer', 'event', 'referral'));
insert into public.badges (kind, label, description, icon, color, threshold, position)
select * from (values
  ('referral', 'Ambassadeur', 'A fait découvrir l''app à 3 amis.', '🤝', '#3DDC97', 3, 36),
  ('referral', 'Grand ambassadeur', 'A fait découvrir l''app à 10 amis.', '🌟', '#FFB547', 10, 37)
) v (kind, label, description, icon, color, threshold, position)
where not exists (select 1 from public.badges where kind = 'referral');

-- Même fonction que dans 0022, avec le type « referral ».
create or replace function public.badges_of(uid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  with p as (select * from public.profiles where id = uid),
  n as (select count(*)::int v from public.user_reads where user_id = uid),
  l as (select count(*)::int v from public.comment_votes v join public.comments c on c.id = v.comment_id
         where c.user_id = uid and c.status = 'visible' and v.value = 1),
  got as (
    select b.* from public.badges b, p, n, l
     where b.active and case b.kind
       when 'premium' then p.premium and (p.premium_until is null or p.premium_until > now())
       when 'team' then p.role <> 'reader'
       when 'reads' then n.v >= b.threshold
       when 'seniority' then p.created_at <= now() - make_interval(days => b.threshold)
       when 'early' then (select count(*) from public.profiles q where q.created_at < p.created_at) < b.threshold
       when 'liked' then l.v >= b.threshold
       -- plus longue suite de jours de visite consécutifs
       when 'streak' then coalesce((select max(n) from (select count(*) n from (select day - (row_number() over (order by day))::int g
                           from (select distinct day from public.visits where user_id = uid) d) x group by g) y), 0) >= b.threshold
       when 'early_bird' then (select count(distinct (at at time zone 'Europe/Paris')::date) from public.user_reads
                                where user_id = uid and extract(hour from at at time zone 'Europe/Paris') < 8) >= b.threshold
       when 'explorer' then (select count(distinct a.rubric_id) from public.user_reads r join public.articles a on a.id = r.article_id
                              where r.user_id = uid) >= b.threshold
       when 'sharer' then coalesce((select shares from public.user_stats where user_id = uid), 0) >= b.threshold
       when 'event' then exists (select 1 from public.visits v where v.user_id = uid and v.day between b.starts_at and b.ends_at)
       when 'referral' then (select count(*) from public.referrals where referrer = uid and confirmed_at is not null) >= b.threshold
       else exists (select 1 from public.user_badges u where u.user_id = uid and u.badge_id = b.id)
     end),
  best as (
    select *, row_number() over (
      partition by case when kind in ('reads', 'seniority', 'liked', 'early', 'streak', 'early_bird', 'explorer', 'sharer', 'referral') then kind else id::text end
      order by case when kind = 'early' then -threshold else threshold end desc) rn
    from got)
  select coalesce(jsonb_agg(jsonb_build_object('label', label, 'description', description, 'icon', icon, 'color', color, 'kind', kind)
                  order by position, threshold desc), '[]'::jsonb)
    from best where rn = 1;
$$;
revoke all on function public.badges_of(uuid) from public, anon, authenticated;

-- 4. Rattacher un filleul à son parrain ----------------------------------------------------------------------
-- Renvoie un message d'erreur lisible, ou null si c'est fait.
create or replace function public.link_referral(uid uuid, c text, how text) returns text
language plpgsql security definer set search_path = public as $$
declare conf jsonb := public.referral_conf(); ref uuid; joined timestamptz;
begin
  if not coalesce((conf->>'enabled')::boolean, true) then return 'Le parrainage est fermé pour le moment'; end if;
  select user_id into ref from public.referral_codes where code = upper(regexp_replace(coalesce(c, ''), '[^A-Za-z0-9]', '', 'g'));
  if ref is null then return 'Ce code de parrainage n''existe pas'; end if;
  if ref = uid then return 'C''est votre propre code'; end if;
  if exists (select 1 from public.referrals where referee = uid) then return 'Vous avez déjà un parrain'; end if;
  -- Pas de parrainage croisé (A parraine B qui parraine A).
  if exists (select 1 from public.referrals where referee = ref and referrer = uid) then return 'Cette personne est déjà votre filleul'; end if;
  select created_at into joined from public.profiles where id = uid;
  if joined < now() - make_interval(days => greatest(coalesce((conf->>'claim_days')::int, 14), 0)) then
    return 'Le code se saisit dans les ' || (conf->>'claim_days') || ' jours qui suivent l''inscription';
  end if;
  if exists (select 1 from public.profiles where id in (uid, ref) and banned) then return 'Ce parrainage n''est pas possible'; end if;
  insert into public.referrals (referee, referrer, via) values (uid, ref, how);
  perform public.check_referral(uid);
  return null;
end $$;
revoke all on function public.link_referral(uuid, text, text) from public, anon, authenticated;

-- Inscription avec le lien : l'app envoie le code avec la création du compte (données de l'inscription, « ref »).
create or replace function public.referral_from_signup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.raw_user_meta_data->>'ref', '') <> '' then
    begin perform public.link_referral(new.id, new.raw_user_meta_data->>'ref', 'link');
    exception when others then null; -- un code abîmé ne doit jamais bloquer une inscription
    end;
  end if;
  return new;
end $$;
-- Déclenché après on_auth_user_created (ordre alphabétique) : le profil existe déjà.
drop trigger if exists on_auth_user_referral on auth.users;
create trigger on_auth_user_referral after insert on auth.users
for each row execute function public.referral_from_signup();

-- Lien ouvert ou code tapé après l'inscription (Mon compte), dans les jours réglés.
create or replace function public.claim_referral(c text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare err text; p text;
begin
  if auth.uid() is null then raise exception 'Connectez-vous pour utiliser un code de parrainage'; end if;
  err := public.link_referral(auth.uid(), c, 'code');
  if err is not null then return jsonb_build_object('error', err); end if;
  select pr.pseudo into p from public.referrals r join public.profiles pr on pr.id = r.referrer where r.referee = auth.uid();
  return jsonb_build_object('ok', true, 'referrer', p);
end $$;
revoke all on function public.claim_referral(text) from public, anon;
grant execute on function public.claim_referral(text) to authenticated;

-- 5. Validation : le filleul a lu assez d'infos → jours Premium (si réglés) et un filleul de plus pour le badge ---
create or replace function public.check_referral(uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.referrals; conf jsonb := public.referral_conf(); rd int; ed int; done int; who text;
begin
  select * into r from public.referrals where referee = uid and confirmed_at is null for update;
  if not found then return; end if;
  if (select count(*) from public.user_reads where user_id = uid) < greatest(coalesce((conf->>'confirm_reads')::int, 5), 0) then return; end if;
  if exists (select 1 from public.profiles where id = uid and banned) then return; end if;
  rd := greatest(coalesce((conf->>'referrer_days')::int, 0), 0);
  ed := greatest(coalesce((conf->>'referee_days')::int, 0), 0);
  select count(*) into done from public.referrals where referrer = r.referrer and referrer_days > 0;
  if done >= greatest(coalesce((conf->>'max_rewarded')::int, 10), 0) then rd := 0; end if;
  select coalesce(pseudo, 'un ami') into who from public.profiles where id = uid;
  -- give_days ne renvoie rien pour un compte déjà Premium à vie : rien n'est alors compté comme offert.
  if rd > 0 and public.give_days(r.referrer, rd, 'gift', 'Parrainage : ' || who, null) is null then rd := 0; end if;
  if ed > 0 and public.give_days(uid, ed, 'gift', 'Bienvenue (parrainage)', null) is null then ed := 0; end if;
  update public.referrals set confirmed_at = now(), referrer_days = rd, referee_days = ed where referee = uid;
end $$;
revoke all on function public.check_referral(uuid) from public, anon, authenticated;

-- À chaque nouvelle info lue par un filleul pas encore validé.
create or replace function public.user_reads_referral() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.referrals where referee = new.user_id and confirmed_at is null) then
    perform public.check_referral(new.user_id);
  end if;
  return null;
end $$;
drop trigger if exists user_reads_referral on public.user_reads;
create trigger user_reads_referral after insert on public.user_reads
for each row execute function public.user_reads_referral();

-- 6. Ce que l'app affiche dans Mon compte ---------------------------------------------------------------------
create or replace function public.my_referral() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); conf jsonb := public.referral_conf(); c text; ok int; wait int; days int; joined timestamptz; parent text; nxt jsonb;
begin
  if uid is null then return null; end if;
  if not coalesce((conf->>'enabled')::boolean, true) then return jsonb_build_object('enabled', false); end if;
  select code into c from public.referral_codes where user_id = uid;
  while c is null loop
    -- 6 caractères sans 0/O ni 1/I pour se dicter sans erreur.
    c := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 6));
    begin insert into public.referral_codes (user_id, code) values (uid, c);
    exception when unique_violation then
      select code into c from public.referral_codes where user_id = uid; -- déjà créé entre-temps, ou code déjà pris : on retire
    end;
  end loop;
  select count(*) filter (where confirmed_at is not null), count(*) filter (where confirmed_at is null), coalesce(sum(referrer_days), 0)
    into ok, wait, days from public.referrals where referrer = uid;
  select created_at into joined from public.profiles where id = uid;
  select coalesce(p.pseudo, 'un lecteur') into parent from public.referrals r left join public.profiles p on p.id = r.referrer where r.referee = uid;
  select jsonb_build_object('label', label, 'icon', icon, 'color', color, 'threshold', threshold) into nxt
    from public.badges where kind = 'referral' and active and threshold > ok order by threshold limit 1;
  return jsonb_build_object(
    'enabled', true, 'code', c, 'link', conf->>'link', 'share_text', conf->>'share_text',
    'confirmed', ok, 'pending', wait, 'days_earned', days,
    'referrer_days', case when (select count(*) from public.referrals where referrer = uid and referrer_days > 0) < (conf->>'max_rewarded')::int
                          then (conf->>'referrer_days')::int else 0 end,
    'referee_days', (conf->>'referee_days')::int, 'confirm_reads', (conf->>'confirm_reads')::int,
    'next_badge', nxt, 'referred_by', parent,
    'can_claim', parent is null and joined >= now() - make_interval(days => greatest((conf->>'claim_days')::int, 0)));
end $$;
revoke all on function public.my_referral() from public, anon;
grant execute on function public.my_referral() to authenticated;

-- 7. Back office : chiffres, meilleurs parrains, derniers parrainages, et les réglages --------------------------
create or replace function public.referral_admin() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  return jsonb_build_object(
    'conf', public.referral_conf(),
    'totals', (select jsonb_build_object(
        'referrals', count(*), 'confirmed', count(*) filter (where confirmed_at is not null),
        'pending', count(*) filter (where confirmed_at is null),
        'last_30', count(*) filter (where created_at > now() - interval '30 days'),
        'referrers', count(distinct referrer),
        'days_given', coalesce(sum(referrer_days + referee_days), 0)) from public.referrals),
    'top', coalesce((select jsonb_agg(t order by t.confirmed desc, t.total desc) from (
        select p.pseudo, u.email::text email, count(*) total, count(*) filter (where r.confirmed_at is not null) confirmed,
               sum(r.referrer_days) days, max(r.created_at) last
          from public.referrals r left join public.profiles p on p.id = r.referrer left join auth.users u on u.id = r.referrer
         group by r.referrer, p.pseudo, u.email order by 4 desc, 3 desc limit 20) t), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(t order by t.created_at desc) from (
        select r.created_at, r.confirmed_at, r.via, r.referrer_days, r.referee_days,
               pr.pseudo referrer, pe.pseudo referee, ue.email::text referee_email,
               (select count(*) from public.user_reads x where x.user_id = r.referee) reads
          from public.referrals r left join public.profiles pr on pr.id = r.referrer
          left join public.profiles pe on pe.id = r.referee left join auth.users ue on ue.id = r.referee
         order by r.created_at desc limit 50) t), '[]'::jsonb));
end $$;
revoke all on function public.referral_admin() from public, anon;
grant execute on function public.referral_admin() to authenticated;

-- ===== supabase/migrations/0024_sujets_suivis.sql
-- Suivre un sujet (« Ukraine », « Budget »…) : le lecteur suit un mot-clé, reçoit une alerte quand il bouge
-- et voit une petite frise de l'histoire (infos et Dernière minute qui en parlent).
--   • les sujets sont les mots-clés de l'algorithme (algo_keywords), gérés dans le back office ;
--   • une alerte = une notification envoyée par le moteur (service de notifications d'Expo, sans clé) ;
--   • jamais d'alerte pour un sujet sensible (migration 0016), ni pour une info publiée la nuit ;
--   • tout se règle dans le back office, Lecteurs > Sujets suivis (réglage JSON « FOLLOW »).

-- 1. Réglages ---------------------------------------------------------------------------------------------
insert into public.setting_keys (key) values ('FOLLOW') on conflict do nothing;

create or replace function public.follow_defaults() returns jsonb language sql immutable as $$
  select '{
    "enabled": true, "max_follows": 20,
    "alerts": true, "flashes": true, "min_importance": 6, "max_per_day": 3, "cooldown_hours": 4,
    "quiet_start": 22, "quiet_end": 8, "lookback_hours": 3,
    "timeline_days": 30, "timeline_max": 20,
    "alert_title": "{sujet}", "alert_body": "{titre}",
    "suggested": ["Ukraine", "Budget", "IA", "Climat", "Élections", "Football"]
  }'::jsonb;
$$;

-- Réglages en vigueur : ceux du back office par-dessus les valeurs par défaut (un JSON abîmé est ignoré).
create or replace function public.follow_conf() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s jsonb;
begin
  begin s := (select value::jsonb from public.app_settings where key = 'FOLLOW'); exception when others then s := null; end;
  return public.follow_defaults() || case when jsonb_typeof(s) = 'object' then s else '{}' end;
end $$;
grant execute on function public.follow_conf() to authenticated;

-- Heures calmes (heure de Paris) : de quiet_start à quiet_end, aucune alerte.
create or replace function public.follow_quiet(at timestamptz, c jsonb) returns boolean language sql stable as $$
  select case when qs = qe then false when qs < qe then h >= qs and h < qe else h >= qs or h < qe end
    from (select extract(hour from at at time zone 'Europe/Paris')::int h, (c->>'quiet_start')::int qs, (c->>'quiet_end')::int qe) x;
$$;

-- 2. Sujets proposés au suivi, et sujets des infos Dernière minute -----------------------------------------
-- Un mot-clé peut servir à l'algorithme sans être proposé au suivi (case dans le back office).
alter table public.algo_keywords add column if not exists followable boolean not null default true;
insert into public.algo_keywords (label, words) values
  ('Budget', '{budget de l''État,loi de finances,projet de budget,déficit public,dette publique,49.3}')
on conflict (label) do nothing;

-- Dernière minute : case « sujet sensible » (cochée par l'IA ou la rédaction) et mots-clés repérés.
alter table public.flashes add column if not exists sensitive boolean not null default false;
alter table public.flashes add column if not exists topics text[] not null default '{}';
create or replace function public.tag_flash() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.topics := public.find_topics(new.title, new.sentence);
  return new;
end $$;
drop trigger if exists flashes_tag on public.flashes;
create trigger flashes_tag before insert or update of title, sentence on public.flashes
for each row execute function public.tag_flash();
create or replace function public.retag_flashes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.flashes set topics = public.find_topics(title, sentence) where published_at > now() - interval '90 days';
  return null;
end $$;
drop trigger if exists algo_keywords_retag_flashes on public.algo_keywords;
create trigger algo_keywords_retag_flashes after insert or update or delete on public.algo_keywords
for each statement execute function public.retag_flashes();
update public.flashes set topics = public.find_topics(title, sentence) where published_at > now() - interval '90 days';

-- 3. Sujets suivis, téléphones à prévenir, alertes envoyées -------------------------------------------------
-- who : identifiant du compte, ou « d: » + appareil sans compte (comme taste_resets).
create table if not exists public.topic_follows (
  who text not null,
  topic text not null,
  alerts boolean not null default true,
  created_at timestamptz not null default now(),
  seen_at timestamptz not null default now(),
  primary key (who, topic)
);
create index if not exists topic_follows_topic on public.topic_follows (topic);
alter table public.topic_follows enable row level security;
revoke all on public.topic_follows from anon, authenticated;

-- Adresse de notification du téléphone (jeton Expo), donnée par l'app quand le lecteur accepte les alertes.
create table if not exists public.push_devices (
  token text primary key check (char_length(token) between 10 and 200),
  device text not null check (char_length(device) between 8 and 64),
  user_id uuid references auth.users (id) on delete cascade,
  platform text,
  updated_at timestamptz not null default now()
);
create index if not exists push_devices_user on public.push_devices (user_id);
create index if not exists push_devices_device on public.push_devices (device);
alter table public.push_devices enable row level security;
revoke all on public.push_devices from anon, authenticated;

create table if not exists public.topic_alerts (
  id bigint generated always as identity primary key,
  who text not null,
  topic text not null,
  item text not null,          -- « a: » + info, ou « f: » + Dernière minute
  title text,
  sent_at timestamptz not null default now()
);
create index if not exists topic_alerts_who on public.topic_alerts (who, sent_at);
create index if not exists topic_alerts_at on public.topic_alerts (sent_at);
alter table public.topic_alerts enable row level security;
revoke all on public.topic_alerts from anon, authenticated;

-- Identité du lecteur : son compte s'il est connecté (les sujets suivis sans compte passent alors sur le compte).
create or replace function public.follow_who(d text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if char_length(coalesce(d, '')) not between 8 and 64 then raise exception 'Appareil inconnu'; end if;
  if auth.uid() is null then return 'd:' || d; end if;
  insert into public.topic_follows (who, topic, alerts, created_at, seen_at)
  select auth.uid()::text, topic, alerts, created_at, seen_at from public.topic_follows where who = 'd:' || d
  on conflict do nothing;
  delete from public.topic_follows where who = 'd:' || d;
  return auth.uid()::text;
end $$;
revoke all on function public.follow_who(text) from public, anon, authenticated;

-- 4. Pour l'app -------------------------------------------------------------------------------------------
-- Ce que l'app affiche : réglages utiles, sujets proposés, sujets suivis avec le nombre d'infos nouvelles.
create or replace function public.my_topics(d text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c jsonb := public.follow_conf(); w text := public.follow_who(d);
begin
  return jsonb_build_object(
    'enabled', (c->>'enabled')::boolean, 'alerts', (c->>'alerts')::boolean, 'max', (c->>'max_follows')::int,
    'suggested', coalesce((select jsonb_agg(s order by o) from jsonb_array_elements_text(c->'suggested') with ordinality x(s, o)
                            where exists (select 1 from public.algo_keywords k where k.label = s and k.active and k.followable)), '[]'),
    'available', coalesce((select jsonb_agg(k.label order by k.label) from public.algo_keywords k where k.active and k.followable), '[]'),
    'following', coalesce((select jsonb_agg(jsonb_build_object('topic', f.topic, 'alerts', f.alerts,
        'new', (select count(*) from public.articles a join public.article_topics t on t.article_id = a.id
                 where a.status = 'published' and f.topic = any (t.topics) and a.published_at > f.seen_at)
             + (select count(*) from public.flashes x where x.status = 'published' and f.topic = any (x.topics) and x.published_at > f.seen_at),
        'last_at', greatest(
          (select max(a.published_at) from public.articles a join public.article_topics t on t.article_id = a.id
            where a.status = 'published' and f.topic = any (t.topics)),
          (select max(x.published_at) from public.flashes x where x.status = 'published' and f.topic = any (x.topics))))
        order by f.created_at)
      from public.topic_follows f join public.algo_keywords k on k.label = f.topic and k.active and k.followable
     where f.who = w), '[]'));
end $$;
grant execute on function public.my_topics(text) to anon, authenticated;

-- Suivre / ne plus suivre un sujet, et couper ou rétablir ses alertes.
create or replace function public.follow_topic(d text, topic text, follow boolean, alerts boolean default true) returns jsonb
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare c jsonb := public.follow_conf(); w text := public.follow_who(d);
begin
  if not follow then
    delete from public.topic_follows f where f.who = w and f.topic = follow_topic.topic;
    return public.my_topics(d);
  end if;
  if not (c->>'enabled')::boolean then raise exception 'Le suivi des sujets est coupé pour le moment.'; end if;
  if not exists (select 1 from public.algo_keywords k where k.label = follow_topic.topic and k.active and k.followable) then
    raise exception 'Ce sujet ne peut pas être suivi.';
  end if;
  if not exists (select 1 from public.topic_follows f where f.who = w and f.topic = follow_topic.topic)
     and (select count(*) from public.topic_follows f where f.who = w) >= (c->>'max_follows')::int then
    raise exception 'Vous suivez déjà % sujets : retirez-en un pour suivre celui-ci.', (c->>'max_follows')::int;
  end if;
  insert into public.topic_follows (who, topic, alerts) values (w, follow_topic.topic, coalesce(alerts, true))
  on conflict (who, topic) do update set alerts = excluded.alerts;
  return public.my_topics(d);
end $$;
grant execute on function public.follow_topic(text, text, boolean, boolean) to anon, authenticated;

-- Sujets (proposés au suivi) de chaque info de l'édition, pour les boutons « Suivre » de l'app.
create or replace function public.topics_of(ids uuid[]) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(t.article_id, to_jsonb(array(
           select x from unnest(t.topics) x where exists (select 1 from public.algo_keywords k where k.label = x and k.active and k.followable)))), '{}')
    from public.article_topics t join public.articles a on a.id = t.article_id
   where t.article_id = any (ids[1:200]) and a.status = 'published';
$$;
grant execute on function public.topics_of(uuid[]) to anon, authenticated;

-- La frise d'un sujet : ses infos et Dernière minute récentes, de la plus récente à la plus ancienne.
-- L'ouvrir remet le compteur « nouveau » à zéro pour ce lecteur.
create or replace function public.topic_timeline(d text, topic text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c jsonb := public.follow_conf(); w text := public.follow_who(d); f public.topic_follows;
begin
  select * into f from public.topic_follows x where x.who = w and x.topic = topic_timeline.topic;
  update public.topic_follows x set seen_at = now() where x.who = w and x.topic = topic_timeline.topic;
  return jsonb_build_object(
    'topic', topic, 'following', f.who is not null, 'alerts', coalesce(f.alerts, true),
    'items', coalesce((select jsonb_agg(i order by i.at desc) from (
      select * from (
        select 'a' as kind, a.id, a.title, a.key_sentence as sentence, a.rubric_id as rubric, a.importance, a.edition_date as edition,
               a.published_at as at, a.published_at > coalesce(f.seen_at, now()) as fresh
          from public.articles a join public.article_topics t on t.article_id = a.id
         where a.status = 'published' and topic_timeline.topic = any (t.topics)
           and a.published_at > now() - make_interval(days => (c->>'timeline_days')::int)
        union all
        select 'f', x.id, x.title, x.sentence, x.rubric_id, x.importance, null, x.published_at, x.published_at > coalesce(f.seen_at, now())
          from public.flashes x
         where x.status = 'published' and topic_timeline.topic = any (x.topics)
           and x.published_at > now() - make_interval(days => (c->>'timeline_days')::int)
      ) u order by at desc limit greatest((c->>'timeline_max')::int, 1)
    ) i), '[]'));
end $$;
grant execute on function public.topic_timeline(text, text) to anon, authenticated;

-- L'app donne l'adresse de notification du téléphone (et la reprend à la connexion ou à la déconnexion).
create or replace function public.register_push(d text, token text, platform text default null) returns void
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if char_length(coalesce(d, '')) not between 8 and 64 or char_length(coalesce(register_push.token, '')) not between 10 and 200 then return; end if;
  perform public.follow_who(d);
  insert into public.push_devices (token, device, user_id, platform, updated_at) values (register_push.token, d, auth.uid(), left(register_push.platform, 20), now())
  on conflict (token) do update set device = excluded.device, user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end $$;
grant execute on function public.register_push(text, text, text) to anon, authenticated;

-- 5. Pour le moteur : les alertes à envoyer maintenant (et notées comme envoyées) --------------------------
-- Une alerte par lecteur et par passage au plus : l'info la plus importante parmi ses sujets suivis, publiée
-- depuis peu, ni sensible ni publiée pendant les heures calmes, pas déjà signalée, un délai entre deux alertes
-- du même sujet et un plafond par jour.
create or replace function public.take_topic_alerts()
returns table (token text, title text, body text, topic text, item text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare c jsonb := public.follow_conf();
  day0 timestamptz := date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris';
begin
  delete from public.topic_alerts where sent_at < now() - interval '60 days';
  delete from public.push_devices where updated_at < now() - interval '120 days';
  if not ((c->>'enabled')::boolean and (c->>'alerts')::boolean) or public.follow_quiet(now(), c) then return; end if;

  create temp table if not exists _ti (item text, topic text, title text, importance int, at timestamptz) on commit drop;
  truncate _ti;
  insert into _ti
  select 'a:' || a.id, t, a.title, a.importance, a.published_at
    from public.articles a join public.article_topics x on x.article_id = a.id, unnest(x.topics) t
   where a.status = 'published' and not a.sensitive   -- jamais d'alerte pour un sujet sensible
     and a.importance >= (c->>'min_importance')::int
     and a.published_at > now() - make_interval(hours => (c->>'lookback_hours')::int)
     and not public.follow_quiet(a.published_at, c)    -- l'édition du matin a déjà sa notification
  union all
  select 'f:' || f.id, t, f.title, f.importance, f.published_at
    from public.flashes f, unnest(f.topics) t
   where (c->>'flashes')::boolean and f.status = 'published' and not f.sensitive
     and f.importance >= (c->>'min_importance')::int
     and f.published_at > now() - make_interval(hours => (c->>'lookback_hours')::int)
     and not public.follow_quiet(f.published_at, c);

  create temp table if not exists _tp (who text, topic text, item text, title text) on commit drop;
  truncate _tp;
  insert into _tp
  select distinct on (tf.who) tf.who, i.topic, i.item, i.title
    from public.topic_follows tf
    join _ti i on i.topic = tf.topic
    join public.algo_keywords k on k.label = tf.topic and k.active and k.followable
   where tf.alerts and i.at > tf.created_at
     and exists (select 1 from public.push_devices p where p.user_id::text = tf.who or ('d:' || p.device = tf.who and p.user_id is null))
     and not exists (select 1 from public.topic_alerts l where l.who = tf.who and l.item = i.item)
     and not exists (select 1 from public.topic_alerts l where l.who = tf.who and l.topic = i.topic
                       and l.sent_at > now() - make_interval(hours => (c->>'cooldown_hours')::int))
     and (select count(*) from public.topic_alerts l where l.who = tf.who and l.sent_at >= day0) < (c->>'max_per_day')::int
   order by tf.who, i.importance desc, i.at desc;

  insert into public.topic_alerts (who, topic, item, title) select p.who, p.topic, p.item, p.title from _tp p;
  return query
  select pd.token,
         left(replace(replace(c->>'alert_title', '{sujet}', p.topic), '{titre}', p.title), 120),
         left(replace(replace(c->>'alert_body', '{sujet}', p.topic), '{titre}', p.title), 240),
         p.topic, p.item
    from _tp p join public.push_devices pd on pd.user_id::text = p.who or ('d:' || pd.device = p.who and pd.user_id is null);
end $$;
revoke all on function public.take_topic_alerts() from public, anon, authenticated;

-- Téléphone qui n'accepte plus les notifications (application supprimée) : on l'oublie.
create or replace function public.drop_push(tokens text[]) returns void
language sql security definer set search_path = public as $$
  delete from public.push_devices where token = any (tokens);
$$;
revoke all on function public.drop_push(text[]) from public, anon, authenticated;

-- 6. Back office ------------------------------------------------------------------------------------------
create or replace function public.follow_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Réservé à l''équipe'; end if;
  return jsonb_build_object(
    'followers', (select count(distinct who) from public.topic_follows),
    'follows', (select count(*) from public.topic_follows),
    'phones', (select count(*) from public.push_devices),
    'alerts_today', (select count(*) from public.topic_alerts
                      where sent_at >= date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris'),
    'alerts_7', (select count(*) from public.topic_alerts where sent_at > now() - interval '7 days'),
    'topics', coalesce((select jsonb_agg(x order by x.followers desc, x.topic) from (
        select k.label as topic, k.followable, k.active,
               (select count(*) from public.topic_follows f where f.topic = k.label) as followers,
               (select count(*) from public.topic_alerts l where l.topic = k.label and l.sent_at > now() - interval '7 days') as alerts_7,
               (select count(*) from public.article_topics t join public.articles a on a.id = t.article_id
                 where k.label = any (t.topics) and a.status = 'published' and a.published_at > now() - interval '30 days') as items_30
          from public.algo_keywords k) x), '[]'),
    'recent', coalesce((select jsonb_agg(r order by r.at desc) from (
        select l.topic, l.title, max(l.sent_at) as at, count(*) as readers
          from public.topic_alerts l where l.sent_at > now() - interval '7 days'
         group by l.topic, l.item, l.title order by max(l.sent_at) desc limit 20) r), '[]'));
end $$;
grant execute on function public.follow_stats() to authenticated;

-- ===== supabase/migrations/0025_regie_objectifs.sql
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

-- ===== supabase/migrations/0026_moteur_garanti.sql
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

-- ===== supabase/migrations/0027_lancer_moteur.sql
-- Lancer le moteur depuis le back office, d'un clic : édition, mise à jour, Dernière minute,
-- ou passage à blanc (mode test : l'IA choisit et écrit, rien n'est publié).
-- Passe par le jeton GitHub saisi dans IA > Clés (GITHUB_DISPATCH_KEY), comme la relance automatique (0021).
create or replace function public.launch_engine(what text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare wf text; inputs jsonb; label text;
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  case what
    when 'edition' then wf := 'edition.yml'; inputs := '{"mode": "force"}';
    when 'update' then wf := 'edition.yml'; inputs := '{"mode": "update"}';
    when 'test' then wf := 'edition.yml'; inputs := '{"mode": "test"}';
    when 'flash' then wf := 'flash.yml'; inputs := '{}';
    when 'flash_test' then wf := 'flash.yml'; inputs := '{"mode": "test"}';
    else raise exception 'Passage inconnu : %', what;
  end case;
  if not exists (select 1 from public.app_settings where key = 'GITHUB_DISPATCH_KEY' and value <> '') or to_regnamespace('net') is null then
    return jsonb_build_object('ok', false, 'reason', 'token');
  end if;
  label := wf || coalesce(' ' || nullif(inputs->>'mode', ''), '');
  -- Un double clic ne lance pas deux passages.
  if exists (select 1 from public.dispatch_log where workflow = label and at > now() - interval '1 minute') then
    return jsonb_build_object('ok', false, 'reason', 'recent');
  end if;
  perform public.dispatch_workflow(wf, inputs);
  insert into public.audit_log (actor, action, target, detail) values (auth.uid(), 'Moteur lancé à la main', what, label);
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.launch_engine(text) from public, anon;
grant execute on function public.launch_engine(text) to authenticated;

-- ===== supabase/migrations/0028_fouille_ia.sql
-- Fouille de textes par l'IA : le moteur note chaque nuit si le média la refuse (robots.txt, tdmrep.json).
-- Une source qui refuse est désactivée, sauf si l'équipe l'a réactivée en connaissance de cause (ai_accepted).
alter table public.sources add column if not exists ai_refusal text;
alter table public.sources add column if not exists ai_checked_at timestamptz;
alter table public.sources add column if not exists ai_accepted boolean not null default false;

-- ===== supabase/migrations/0029_garde_fous_ia.sql
-- Garde-fous de l'IA : dépense (plafond par passage, anti-boucle, alerte à 80 %, historique)
-- et publication (ton neutre, rien d'inventé, limite par jour, tout dépublier d'un passage).

insert into public.setting_keys (key) values
  ('AI_BUDGET_RUN'), ('AI_BUDGET_ALERT'), ('AI_MAX_CALLS'),
  ('PUBLISH_MAX_PER_DAY'), ('GUARD_RULES'), ('GUARD_AI_CHECK'), ('GUARD_WORDS'), ('GUARD_HOLD')
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

-- ===== supabase/migrations/0030_securite_perfs.sql
-- Audit sécurité et performances (24/11).

-- 1. Fraude pub : l'ancien compteur ad_hit ajoutait des affichages et des clics sans aucune limite,
-- pour n'importe qui. L'app passe par ad_hits (plafonds par appareil et par adresse IP) depuis 0025.
revoke execute on function public.ad_hit(uuid, boolean) from public, anon, authenticated;

-- 2. Index manquants sur les chemins lus à chaque ouverture de l'app ou à chaque commentaire.
create index if not exists reactions_article on public.reactions (article_id);          -- likes d'une info
create index if not exists article_emojis_article on public.article_emojis (article_id); -- emoji d'une info
create index if not exists comment_votes_comment on public.comment_votes (comment_id);   -- votes sous les commentaires
create index if not exists comments_user on public.comments (user_id, created_at desc);  -- « 5 commentaires par minute »
create index if not exists visits_user on public.visits (user_id, day);                  -- séries de jours, fiche lecteur

-- ===== supabase/migrations/0031_edition_horaire.sql
-- Édition renouvelée au fil de la journée : chaque heure, le moteur ajoute les infos nouvelles et importantes,
-- et « Mon édition » garde le nombre d'infos choisi avec les plus importantes du moment en haut.
-- L'importance d'une info s'efface avec les heures (réglage ALGO.decay_hours, 6 h par défaut, 0 = jamais) :
-- une info dépassée descend, puis sort de l'édition vers « Charger plus ». Sous les sujets majeurs,
-- les infos sont rangées du plus pertinent au moins pertinent. Aucun appel à l'IA en plus.

create or replace function public.algo_defaults() returns jsonb language sql immutable as $$
  select '{
    "enabled": true,
    "share_essential": 25, "share_discovery": 12,
    "w_importance": 45, "w_affinity": 35, "w_collective": 10, "w_fresh": 10,
    "affinity_start": 10, "ramp": 50, "half_life": 21, "smooth": 5, "decay_hours": 6,
    "skip_ms": 2000, "long_ms": 12000, "min_views": 200, "max_rubric": 50, "keep_days": 90,
    "signals": {"click": 3, "share": 3, "summary_end": 2, "like": 2, "comment": 2, "summary": 1.5,
                "source": 1, "long": 1, "back": 0.5, "skip": -0.5, "dislike": -0.5, "less": -3}
  }'::jsonb;
$$;

create or replace function public.compose_edition(uid uuid, dev text, active text[], quota int, perso boolean default true)
returns table (article_id uuid, slot text, reason text, score numeric, pos int)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  c jsonb := public.algo_conf();
  taste jsonb := case when perso and (c->>'enabled')::boolean then public.reader_taste(uid, dev) else '{"rubrics":{},"topics":{},"n":0}' end;
  k numeric := greatest((c->>'smooth')::numeric, 0.1);
  wa numeric; wi numeric;
  n_ess int; n_dec int; cap int;
  -- Dernier jour ayant une info en ligne (comme l'app) : pas besoin d'attendre la fin du passage du matin.
  ed date := (select max(a.edition_date) from public.articles a where a.status = 'published');
  -- Une info perd la moitié de son importance toutes les decay_hours heures (0 = jamais) : les plus fraîches remontent.
  dh numeric := coalesce((c->>'decay_hours')::numeric, 0);
  r record;
begin
  quota := least(greatest(coalesce(quota, 8), 1), 100);
  active := coalesce(active, '{}');
  -- Le poids des goûts monte avec le nombre de signaux ; ce qu'il ne prend pas va à l'importance.
  wa := case when not (perso and (c->>'enabled')::boolean) then 0
             else (c->>'affinity_start')::numeric + ((c->>'w_affinity')::numeric - (c->>'affinity_start')::numeric)
                  * least(1, (taste->>'n')::numeric / greatest((c->>'ramp')::numeric, 1)) end;
  wi := (c->>'w_importance')::numeric + (c->>'w_affinity')::numeric - wa;
  n_ess := greatest(1, round(quota * (c->>'share_essential')::numeric / 100));
  n_dec := case when (c->>'share_discovery')::numeric > 0 then greatest(1, round(quota * (c->>'share_discovery')::numeric / 100)) else 0 end;
  cap := case when cardinality(active) <= 2 then quota else greatest(1, ceil(quota * (c->>'max_rubric')::numeric / 100)) end;

  create temp table if not exists _cand (id uuid, rubric text, rname text, essential boolean, importance int,
    aff numeric, fav text, sc numeric, slot text, why text, ord int, ci numeric) on commit drop;
  truncate _cand;

  insert into _cand (id, rubric, rname, essential, importance, aff, fav, sc, ci)
  with art0 as (
    select a.id, a.rubric_id, rb.name, a.essential, a.sensitive, a.importance, coalesce(a.published_at, a.created_at) as at,
           coalesce(t.topics, '{}') as topics
      from public.articles a join public.rubrics rb on rb.id = a.rubric_id
      left join public.article_topics t on t.article_id = a.id
     where a.edition_date = ed and a.status = 'published'
       -- « Moins de sujets comme ça » : cette info-là ne revient pas.
       and not exists (select 1 from public.reading_events e where e.article_id = a.id and e.kind = 'less'
                        and ((uid is not null and e.user_id = uid) or (uid is null and e.device = dev)))
  ),
  -- Importance du moment : la note de la rédaction, qui s'efface avec les heures.
  art as (
    select art0.*, art0.importance * case when dh > 0 then power(0.5, greatest(0, extract(epoch from now() - art0.at)) / 3600 / dh) else 1 end as ci
      from art0
  ),
  -- Intérêt collectif : part des lecteurs qui ouvrent, partagent ou cliquent (rang parmi les infos assez vues).
  coll as (
    select e.article_id, count(distinct e.device) filter (where e.kind = 'view') as views,
           count(distinct e.device) filter (where e.kind = 'summary') + 2 * count(distinct e.device) filter (where e.kind in ('share', 'click')) as eng
      from public.reading_events e where e.article_id in (select id from art) group by e.article_id
  ),
  coll_rank as (
    select article_id, percent_rank() over (order by eng::numeric / views) as pr
      from coll where views >= (c->>'min_views')::int
  ),
  aff as (
    select art.*,
           0.5 + 0.5 * coalesce((taste->'rubrics'->>art.rubric_id)::numeric, 0) / (abs(coalesce((taste->'rubrics'->>art.rubric_id)::numeric, 0)) + k) as ra,
           (select t from unnest(art.topics) t where (taste->'topics'->>t)::numeric > 0 order by (taste->'topics'->>t)::numeric desc limit 1) as fav
      from art
  ),
  aff2 as (
    select aff.*, coalesce((select avg(case when taste->'topics' ? t
                    then 0.5 + 0.5 * (taste->'topics'->>t)::numeric / (abs((taste->'topics'->>t)::numeric) + k) else aff.ra end)
                  from unnest(aff.topics) t), aff.ra) as ta
      from aff
  )
  select a2.id, a2.rubric_id, a2.name, a2.essential, a2.importance, (a2.ra + a2.ta) / 2, a2.fav,
         (wi * a2.ci / 10.0
          + wa * (a2.ra + a2.ta) / 2
          -- Sujet sensible : jamais poussé parce qu'il attire les clics (intérêt collectif neutre).
          + (c->>'w_collective')::numeric * case when a2.sensitive then 0.5 else coalesce((select pr from coll_rank where coll_rank.article_id = a2.id), 0.5) end
          + (c->>'w_fresh')::numeric * greatest(0, 1 - extract(epoch from now() - a2.at) / 86400)) / 100
, a2.ci
    from aff2 a2;

  -- À ne pas manquer : les sujets les plus importants du moment, pour tout le monde (ils tournent dans la journée).
  update _cand set slot = 'ess', why = 'Sujet majeur du moment, proposé à tout le monde.'
   where id in (select id from _cand order by ci desc, essential desc, sc desc limit n_ess);
  -- Découverte : un sujet important d'une rubrique non suivie (sinon de la rubrique la moins lue).
  update _cand set slot = 'dec', why = 'Pour découvrir la rubrique ' || rname || '.'
   where id in (select id from _cand where slot is null
                 order by (rubric = any (active)), aff, importance desc, sc desc limit n_dec);
  -- Pour vous : meilleurs scores dans les rubriques suivies, sans qu'une rubrique prenne plus que sa part.
  for r in select * from _cand where slot is null order by (rubric = any (active)) desc, sc desc loop
    exit when (select count(*) from _cand where slot is not null) >= quota;
    continue when (select count(*) from _cand where _cand.rubric = r.rubric and slot is not null) >= cap
              and exists (select 1 from _cand x where x.slot is null and x.id <> r.id and (select count(*) from _cand y where y.rubric = x.rubric and y.slot is not null) < cap);
    update _cand set slot = 'pv', why = case when r.fav is not null then 'Vous lisez souvent : ' || r.fav || '.'
                                             when r.rubric = any (active) then 'Vous suivez la rubrique ' || r.rname || '.'
                                             else 'Une info importante du jour.' end
     where id = r.id;
  end loop;

  -- Ordre : les sujets majeurs en tête, puis du plus pertinent au moins pertinent (plus on descend, moins c'est important).
  update _cand set ord = x.n from (select id, row_number() over (order by (slot = 'ess') desc, sc desc) - 1 as n
                                     from _cand where slot is not null) x where _cand.id = x.id;
  -- Après l'édition : tout le reste, pour « Charger plus ».
  update _cand set slot = 'more', why = 'Pour aller plus loin aujourd''hui.',
         ord = 1000 + x.n from (select id, row_number() over (order by sc desc) n from _cand where slot is null) x where _cand.id = x.id;

  return query select _cand.id, _cand.slot, _cand.why, round(_cand.sc, 3), _cand.ord from _cand order by _cand.ord;
end $$;
revoke all on function public.compose_edition(uuid, text, text[], int, boolean) from public, anon, authenticated;

-- ===== supabase/migrations/0032_angles_medias.sql
-- « Voir les angles » : sur un sujet qui divise, comment chaque média l'aborde, en une phrase neutre réécrite par l'IA
-- (même appel que la carte, aucun coût en plus). Vide le plus souvent ; l'app n'affiche le lien qu'à partir de 2 angles.
alter table public.articles add column if not exists angles jsonb;  -- [{source, text}] ou null
insert into public.setting_keys (key) values ('MEDIA_ANGLES') on conflict do nothing;

-- ===== supabase/migrations/0033_legal_rgpd.sql
-- Pages légales et RGPD : politique de confidentialité, conditions d'utilisation et mentions légales,
-- modifiables dans le back office (Personnalisation > Pages légales), lisibles dans l'app (Réglages) et sur
-- une adresse publique (site web ?legal=privacy). Suppression du compte par le lecteur (exigée par Apple).
-- Les textes de départ sont des MODÈLES à compléter et à faire relire : ce n'est pas un avis juridique.

insert into public.setting_keys (key) values ('LEGAL_PRIVACY'), ('LEGAL_TERMS'), ('LEGAL_NOTICE'), ('VISITS_KEEP_MONTHS')
on conflict do nothing;

-- (bloc commun) set_setting : les pages légales peuvent aller jusqu'à 20 000 caractères.
create or replace function public.set_setting(k text, v text)
returns void language plpgsql security definer set search_path = public as $$
declare lim int := case when k like 'LEGAL_%' then 20000 when k like 'MAIL_%_BODY' or k = 'APP_TEXTS' then 10000 else 2000 end;
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  if not exists (select 1 from public.setting_keys where key = k) then
    raise exception 'Réglage inconnu : %', k;
  end if;
  if char_length(coalesce(v, '')) > lim then raise exception 'Valeur trop longue (% caractères au plus)', lim; end if;
  if coalesce(trim(v), '') = '' then
    delete from public.app_settings where key = k;
  else
    insert into public.app_settings (key, value, updated_at, updated_by) values (k, trim(v), now(), auth.uid())
    on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
  end if;
  insert into public.audit_log (actor, action, target, detail)
  values (auth.uid(), 'Réglage modifié', k, case when k like '%_KEY' then 'clé remplacée' else left(coalesce(trim(v), ''), 200) end);
end $$;
-- (fin du bloc commun)

-- Lecture publique d'une page légale (rien d'autre n'est lisible par ce chemin).
create or replace function public.legal_text(k text) returns text
language sql stable security definer set search_path = public as $$
  select value from public.app_settings where key = k and k in ('LEGAL_PRIVACY', 'LEGAL_TERMS', 'LEGAL_NOTICE');
$$;
grant execute on function public.legal_text(text) to anon, authenticated;

-- Le lecteur supprime son compte : profil, likes, commentaires, badges, lectures et abonnement enregistré
-- partent avec lui (clés « on delete cascade »). Les comptes de l'équipe se retirent depuis le back office.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Connectez-vous d''abord'; end if;
  if public.is_staff() then raise exception 'Un compte de l''équipe ne se supprime pas depuis l''app'; end if;
  insert into public.audit_log (actor, action, target, detail) values (null, 'Compte supprimé par le lecteur', u::text, null);
  delete from auth.users where id = u;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Jours d'ouverture de l'app (table visits) : effacés après VISITS_KEEP_MONTHS mois (12 par défaut, back office >
-- Personnalisation > Pages légales). Ajouté au ménage que le moteur lance à chaque édition.
create or replace function public.purge_reading_events() returns int
language sql security definer set search_path = public as $$
  with d as (delete from public.reading_events where at < now() - make_interval(days => (public.algo_conf()->>'keep_days')::int) returning 1),
  v as (delete from public.visits where day < current_date - make_interval(months => public.setting_int('VISITS_KEEP_MONTHS', 12, 1, 120)) returning 1)
  select ((select count(*) from d) + (select count(*) from v))::int;
$$;
revoke all on function public.purge_reading_events() from public, anon, authenticated;

-- Modèles de départ ({nom} = nom de l'app ; les [crochets] sont à compléter). Une page vidée dans le back office
-- n'est plus affichée : il faut toujours un texte en ligne pour les stores.
insert into public.app_settings (key, value) values
('LEGAL_PRIVACY', $t$Politique de confidentialité

Dernière mise à jour : [date]

{nom} respecte votre vie privée. Cette page explique quelles données nous utilisons, pourquoi, et comment garder la main.

Qui est responsable de vos données ?
[Nom ou société], [adresse], joignable à [adresse e-mail de contact].

Ce que nous utilisons
• Sans compte : un identifiant tiré au hasard, propre à votre téléphone, vos réglages (rubriques, nombre d'infos, heure de la notification) et les jours où vous ouvrez l'app (série de jours).
• Ce que vous lisez dans l'app (infos vues, temps passé, résumés ouverts), pour composer « Mon édition ». Vous pouvez l'arrêter : Réglages > Édition selon mes goûts. Vous pouvez aussi tout effacer : Réglages > Remettre mes goûts à zéro.
• Avec un compte : votre adresse e-mail, votre pseudo, vos likes, commentaires, badges et invitations d'amis.
• Premium : l'achat passe par l'App Store ou Google Play. Nous ne voyons jamais vos données bancaires ; nous recevons seulement l'état de l'abonnement (via RevenueCat).
• Publicité : les pubs sont des cartes affichées par l'app elle-même. Nous comptons les affichages et les clics, sans vous suivre sur d'autres apps ou sites. Les pubs ne sont adaptées à vos rubriques que si vous l'acceptez (Réglages > Pubs selon mes centres d'intérêt, coupé par défaut).
• Notification du matin : un jeton technique fourni par Apple ou Google, seulement si vous l'activez.

Pourquoi (base légale)
• Faire fonctionner l'app et votre compte : exécution du service que vous demandez.
• Personnaliser votre édition et compter les lectures : notre intérêt légitime, que vous pouvez refuser à tout moment dans les Réglages.
• Pubs selon vos centres d'intérêt : votre consentement, retirable à tout moment.

Combien de temps
• Lectures : 90 jours au plus (réglable dans le back office, Lecteurs > Algorithme).
• Compte : tant qu'il existe. Supprimé, il disparaît aussitôt avec ses likes, commentaires et badges.
• Jours d'ouverture de l'app (série de jours, statistiques) : 12 mois, puis effacés automatiquement.
• Journaux techniques : [12] mois au plus.

Qui y a accès
Notre équipe et nos prestataires techniques, uniquement pour faire tourner l'app : Supabase (base de données, [région]), Apple et Google (stores et notifications), RevenueCat (abonnements), Anthropic (rédaction des résumés, sans aucune donnée de lecteur). Nous ne vendons jamais vos données.

Vos droits
Vous pouvez consulter, corriger, effacer ou récupérer vos données, et vous opposer à leur usage. Supprimer votre compte : Réglages > Mon compte > Supprimer mon compte. Pour toute autre demande : [adresse e-mail de contact]. Vous pouvez aussi saisir la CNIL (cnil.fr).

Mineurs
{nom} s'adresse aux personnes de 15 ans et plus.$t$),
('LEGAL_TERMS', $t$Conditions générales d'utilisation

Dernière mise à jour : [date]

1. Le service
{nom} présente chaque jour un résumé court des actualités, rédigé à partir de médias reconnus. Les liens vers les sources restent disponibles sous chaque info.

2. Les résumés
Les résumés sont rédigés avec l'aide d'une intelligence artificielle et relus par des règles automatiques. Malgré notre soin, une erreur reste possible : pour une décision importante, lisez la source.

3. Votre compte
Le compte est gratuit et personnel. Vous choisissez un pseudo correct et gardez votre mot de passe secret. Vous pouvez le supprimer à tout moment dans l'app.

4. Les commentaires
Restez courtois. Sont interdits : insultes, propos haineux ou discriminants, harcèlement, publicité, contenus illégaux. Un commentaire signalé peut être masqué ; un compte qui ne respecte pas ces règles peut être bloqué ou supprimé.

5. Premium
Premium retire les publicités. L'abonnement est payé et géré par l'App Store ou Google Play, se renouvelle automatiquement et se résilie dans les réglages de votre store, au plus tard 24 h avant la fin de la période. Supprimer votre compte n'arrête pas l'abonnement : pensez à le résilier dans votre store.

6. Publicité
La version gratuite affiche quelques cartes sponsorisées, toujours signalées comme telles.

7. Propriété
La marque {nom}, l'app et les résumés nous appartiennent. Les articles d'origine appartiennent à leurs médias. Les photos sont libres de droits ou utilisées avec l'accord de leur auteur.

8. Responsabilité
Nous faisons de notre mieux pour que l'app soit disponible, sans pouvoir le garantir à tout moment.

9. Changements
Nous pouvons modifier ces conditions ; la date ci-dessus change alors. Continuer à utiliser l'app vaut accord.

10. Droit applicable
Droit français. En cas de litige, contactez-nous d'abord : [adresse e-mail de contact].$t$),
('LEGAL_NOTICE', $t$Mentions légales

Éditeur
[Nom ou raison sociale]
[Forme juridique, capital, RCS ou SIRET]
[Adresse]
[Adresse e-mail de contact]

Directeur de la publication
[Prénom Nom]

Hébergement
Base de données : Supabase Inc., 970 Toa Payoh North #07-04, Singapour 318992 (serveurs en [région]).
Site web : GitHub Inc., 88 Colin P Kelly Jr Street, San Francisco, CA 94107, États-Unis.

Contact
[Adresse e-mail de contact]$t$)
on conflict (key) do nothing;

-- ===== supabase/migrations/0034_pourquoi_important.sql
-- « Pourquoi c'est important » : une phrase écrite par l'IA dans le même appel que la carte,
-- affichée dans la lecture plein écran (réglage APP_RULES.show_matters, 1 par défaut) et modifiable dans Articles.
alter table public.articles add column if not exists matters text;

-- ===== supabase/migrations/0035_stats_lecture.sql
-- Statistiques de lecture (tableau de bord), tirées du journal reading_events déjà tenu par l'app.
-- Rien de nouveau n'est noté : un lecteur qui a coupé « Édition selon mes goûts » n'envoie aucun signal, il n'est donc pas compté.
create or replace function public.reading_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Réservé à l''équipe'; end if;
  return (
    with ev as (select * from public.reading_events where at > now() - interval '7 days'),
    -- Une journée de lecteur = un appareil, un jour (heure de Paris) : combien d'infos différentes il a vues.
    d as (select count(distinct article_id) seen from ev where kind = 'view' group by device, (at at time zone 'Europe/Paris')::date)
    select jsonb_build_object(
      -- Infos les plus vues : temps médian sur la carte, ouvertes en plein écran, lues jusqu'au bout.
      'articles', coalesce((select jsonb_agg(t order by t.readers desc) from (
          select a.title, a.rubric_id,
                 count(distinct e.device) filter (where e.kind = 'view') readers,
                 round((percentile_cont(0.5) within group (order by e.ms) filter (where e.kind = 'view'))::numeric / 1000, 1) median_s,
                 count(distinct e.device) filter (where e.kind = 'summary') opened,
                 count(distinct e.device) filter (where e.kind = 'summary_end') finished
            from ev e join public.articles a on a.id = e.article_id
           group by a.id order by 3 desc limit 10) t), '[]'),
      'days', (select count(*) from d),
      -- Décrochage : part des journées où le lecteur a vu au moins n infos.
      'reach', (select jsonb_agg(jsonb_build_object('n', n, 'days', (select count(*) from d where d.seen >= n)) order by n)
                  from unnest(array[1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 24, 32]) n)));
end $$;
revoke all on function public.reading_stats() from public, anon;
grant execute on function public.reading_stats() to authenticated;

-- ===== supabase/migrations/0036_publier_douteuses.sql
-- « Retenir les cartes encore douteuses » coupé : les cartes restées en brouillon seulement pour un doute
-- (reprise mot pour mot, ton, chiffre, relecture IA) ou une alerte simple sont publiées, comme le moteur le fait désormais.
-- Seulement les 3 derniers jours, seulement les cartes écrites par l'IA, jamais si GUARD_HOLD ou le pilote automatique est coupé.
update public.articles a
   set status = 'published', published_at = now()
 where a.status = 'draft'
   and a.model is not null
   and a.edition_date >= current_date - 2
   and cardinality(a.review_notes) > 0
   and not exists (select 1 from unnest(a.review_notes) n
                    where n !~ '^(reprise|ton :|chiffre absent|relecture IA)' and n !~ '(trop long|ponctuation|en gras)')
   and a.importance >= coalesce((select value::int from public.app_settings where key = 'PUBLISH_MIN_IMPORTANCE' and value ~ '^[0-9]+$'), 1)
   and coalesce((select value from public.app_settings where key = 'GUARD_HOLD'), '0') <> '1'
   and coalesce((select value from public.app_settings where key = 'AUTO_PUBLISH'), '1') <> '0';

-- ===== supabase/migrations/0037_legal_studio23.sql
-- Pages légales : les [crochets] des modèles remplis avec l'éditeur (Studio 23, d'après studio-23.fr/mentions-legales.html).
-- Ne remplace que les crochets encore présents : un texte déjà retouché dans le back office garde ses retouches.
-- Reste à compléter à la main : [région] (région des serveurs Supabase).
update public.app_settings set value =
  replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(value,
    '[date]', '25 novembre 2026'),
    '[Nom ou société], [adresse], joignable à [adresse e-mail de contact].', 'Studio 23, entreprise individuelle (EI), Auxerre (89000), France, joignable à titre@studio-23.fr.'),
    '[Nom ou raison sociale]', 'Studio 23'),
    '[Forme juridique, capital, RCS ou SIRET]', 'Entreprise individuelle (EI), immatriculée au Registre national des entreprises, SIRET 987 664 893 00029'),
    '[Adresse]', 'Auxerre (89000), France'),
    '[Prénom Nom]', 'Le représentant légal de Studio 23'),
    '[adresse e-mail de contact]', 'titre@studio-23.fr'),
    '[Adresse e-mail de contact]', 'titre@studio-23.fr'),
    '[12] mois', '12 mois'),
    '[90]', '90'),
  updated_at = now()
 where key in ('LEGAL_PRIVACY', 'LEGAL_TERMS', 'LEGAL_NOTICE');

-- ===== supabase/migrations/0038_modele_taches_simples.sql
-- Deux modèles d'IA : TITRE_MODEL écrit les cartes, TITRE_MODEL_LIGHT (Haiku par défaut) fait le reste
-- (choisir les sujets, relire, Dernière minute, modération). Le coût d'un passage additionne les deux.
insert into public.setting_keys (key) values ('TITRE_MODEL_LIGHT') on conflict do nothing;

-- shortcut: tarifs Anthropic de novembre 2026 ($/million de jetons) écrits ici, à mettre à jour s'ils changent.
create or replace function public.run_cost(stats jsonb) returns numeric
language sql immutable as $$
  select coalesce(sum(
           (coalesce((u->>'input')::numeric, 0) * case when m like 'claude-haiku%' then 0.10 when m like 'claude-sonnet%' then 2 else 4 end
          + coalesce((u->>'output')::numeric, 0) * case when m like 'claude-haiku%' then 0.50 when m like 'claude-sonnet%' then 10 else 20 end) / 1e6), 0)
    from (values (stats->>'model', stats->'ai'), (stats->'ai'->'light'->>'model', stats->'ai'->'light')) v(m, u);
$$;

-- ===== supabase/migrations/0039_impressions_pub.sql
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
