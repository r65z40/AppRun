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
