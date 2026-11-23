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
