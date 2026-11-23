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
create or replace function public.admin_subscribers(search text default '', filter text default 'live')
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
     where (coalesce(search, '') = '' or p.pseudo ilike '%' || search || '%' or u.email ilike '%' || search || '%')
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
revoke all on function public.admin_subscribers(text, text) from public, anon;
grant execute on function public.admin_subscribers(text, text) to authenticated;

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
