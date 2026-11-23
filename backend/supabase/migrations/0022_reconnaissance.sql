-- Reconnaissance des lecteurs : badges (Premium, paliers de lecture, Bienfaiteur et statuts donnés à la main,
-- équipe, ancienneté, pionniers, commentaires appréciés), tous réglables dans le back office (Lecteurs > Reconnaissance).
-- Un lecteur peut cacher les siens. Aussi : nombre de lecteurs qui ont vu chaque info (pouces remplis selon le ratio).

insert into public.setting_keys (key) values ('RECOGNITION') on conflict do nothing;

alter table public.profiles add column if not exists show_badges boolean not null default true;
create index if not exists profiles_created on public.profiles (created_at);

-- 1. Les badges ----------------------------------------------------------------------------------------
-- kind : premium (abonné), reads (a lu au moins N infos), manual (donné à la main, ex. Bienfaiteur),
-- team (membre de l'équipe), seniority (compte de plus de N jours), early (parmi les N premiers comptes),
-- liked (ses commentaires ont reçu au moins N likes).
create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('premium', 'reads', 'manual', 'team', 'seniority', 'early', 'liked')),
  label text not null check (char_length(label) between 1 and 30),
  description text not null default '' check (char_length(description) <= 200),
  icon text not null default '⭐' check (char_length(icon) between 1 and 8),
  color text not null default '#7B5CFF' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  threshold int not null default 0 check (threshold >= 0),
  position int not null default 0,
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

insert into public.badges (kind, label, description, icon, color, threshold, position)
select * from (values
  ('premium', 'Premium', 'Abonné Premium : soutient l''app.', '💎', '#C86BFA', 0, 1),
  ('manual', 'Bienfaiteur', 'A proposé des idées pour améliorer l''app.', '💌', '#FFB547', 0, 2),
  ('team', 'Équipe', 'Fait partie de l''équipe.', '🛡️', '#3D7BFF', 0, 3),
  ('reads', 'Curieux', 'A lu plus de 50 infos.', '📖', '#5AD1B5', 50, 10),
  ('reads', 'Assidu', 'A lu plus de 250 infos.', '📚', '#4FB0FF', 250, 11),
  ('reads', 'Érudit', 'A lu plus de 1 000 infos.', '🧠', '#9A7BFF', 1000, 12),
  ('reads', 'Encyclopédie', 'A lu plus de 5 000 infos.', '🏆', '#FFD166', 5000, 13),
  ('early', 'Pionnier', 'Parmi les 1 000 premiers comptes.', '🚀', '#FF8A7A', 1000, 20),
  ('seniority', 'Fidèle', 'Membre depuis plus d''un an.', '🎂', '#FF6B8A', 365, 21),
  ('liked', 'Plume appréciée', 'Ses commentaires ont reçu plus de 100 likes.', '✍️', '#7B5CFF', 100, 22)
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

-- Même fonction que dans 0015, qui note en plus chaque info vue par un lecteur connecté.
create or replace function public.track(d text, ev jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if char_length(coalesce(d, '')) not between 8 and 64 or jsonb_typeof(ev) <> 'array' then return; end if;
  if auth.uid() is not null then
    with up as (update public.reading_events set user_id = auth.uid() where device = d and user_id is null returning article_id, kind)
    insert into public.user_reads (user_id, article_id) select distinct auth.uid(), article_id from up where kind = 'view'
    on conflict do nothing;
  end if;
  with ins as (
    insert into public.reading_events (device, user_id, article_id, kind, ms)
    select d, auth.uid(), a.id, e->>'k', least(greatest((e->>'ms')::int, 0), 600000)
      from (select value e from jsonb_array_elements(ev) limit 100) x
      join public.articles a on a.id::text = e->>'a' and a.status = 'published'
     where e->>'k' in ('view', 'summary', 'summary_end', 'source', 'click', 'share', 'back', 'less')
    returning user_id, article_id, kind)
  insert into public.user_reads (user_id, article_id) select distinct user_id, article_id from ins where kind = 'view' and user_id is not null
  on conflict do nothing;
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
       else exists (select 1 from public.user_badges u where u.user_id = uid and u.badge_id = b.id)
     end),
  best as (
    select *, row_number() over (
      partition by case when kind in ('reads', 'seniority', 'liked', 'early') then kind else id::text end
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
