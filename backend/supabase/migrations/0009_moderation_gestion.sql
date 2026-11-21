-- Modération renforcée (filtre d'insultes, blocage, bannissement, rôle Modération),
-- tableau de bord (lecteurs actifs, coût de l'IA) et photos envoyées depuis le back office.

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
    'BANNED_WORDS'
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
