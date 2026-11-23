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
create or replace function public.ad_hit(cid uuid, click boolean default false) returns void
language sql security definer set search_path = public as $$
  insert into public.ad_stats (campaign_id, day, views, clicks)
  select c.id, (now() at time zone 'Europe/Paris')::date, case when click then 0 else 1 end, case when click then 1 else 0 end
    from public.ad_campaigns c where c.id = cid
  on conflict (campaign_id, day) do update
    set views = public.ad_stats.views + excluded.views, clicks = public.ad_stats.clicks + excluded.clicks;
$$;
grant execute on function public.ad_hit(uuid, boolean) to anon, authenticated;

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
