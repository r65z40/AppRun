-- Premium et abonnements : événements RevenueCat, codes promo, cadeaux de l'équipe, échéances.
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
\set L '''00000000-0000-0000-0000-000000000001'''
\set M '''00000000-0000-0000-0000-000000000003'''
\set ADM '''00000000-0000-0000-0000-0000000000ad'''
create temp table t_ev (id text, ms bigint);
grant all on t_ev to authenticated;

-- Un événement RevenueCat minimal (prix en euros, horodatage en millisecondes).
create or replace function pg_temp.ev(typ text, eid text, ts_offset_min int, extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('type', typ, 'id', eid, 'app_user_id', '00000000-0000-0000-0000-000000000001', 'aliases', jsonb_build_array('$RCAnonymousID:abc'),
    'store', 'APP_STORE', 'environment', 'PRODUCTION', 'product_id', 'titre_premium_mensuel', 'period_type', 'NORMAL',
    'original_transaction_id', 'tx-1', 'currency', 'EUR', 'price_in_purchased_currency', 2.99,
    'event_timestamp_ms', (extract(epoch from now() + make_interval(mins => ts_offset_min)) * 1000)::bigint,
    'purchased_at_ms', (extract(epoch from now()) * 1000)::bigint,
    'expiration_at_ms', (extract(epoch from now() + interval '7 days') * 1000)::bigint) || extra $$;

-- 1. Seul le serveur peut envoyer des événements de paiement
set role authenticated;
set request.jwt.claim.sub = :L;
do $$ begin perform public.apply_store_event('{"type":"INITIAL_PURCHASE"}'); raise exception 'passé'; exception when insufficient_privilege then null; end $$;
reset role;
select 'OK  événements de paiement refusés depuis l''app';

-- 2. Essai gratuit, puis premier paiement
select public.apply_store_event(pg_temp.ev('INITIAL_PURCHASE', 'e1', 0, '{"period_type":"TRIAL","price_in_purchased_currency":0}'));
select case when premium and premium_until > now() + interval '6 days' then 'OK  essai gratuit : Premium tout de suite' else 'ÉCHEC  essai gratuit' end from profiles where id = :L;
select case when public.apply_store_event(pg_temp.ev('INITIAL_PURCHASE', 'e1', 0)) = 'déjà traité' then 'OK  un événement reçu deux fois n''est compté qu''une fois' else 'ÉCHEC  doublon' end;
select public.apply_store_event(pg_temp.ev('RENEWAL', 'e2', 10, jsonb_build_object('expiration_at_ms', (extract(epoch from now() + interval '37 days') * 1000)::bigint)));
select case when s.status = 'active' and s.plan_id = 'mensuel' and (select kind from subscription_events where external_id = 'e2') = 'conversion'
             and (select amount_cents from subscription_events where external_id = 'e2') = 299 and (select amount_cents from subscription_events where external_id = 'e1') is null
            then 'OK  essai converti en abonnement payant (2,99 €, offre Mensuel reconnue)' else 'ÉCHEC  conversion' end
  from subscriptions s where s.store_ref = 'tx-1';

-- 3. Un vieil événement arrivé en retard ne remplace pas un plus récent
select public.apply_store_event(pg_temp.ev('EXPIRATION', 'e-old', -60));
select case when premium then 'OK  événements dans le désordre : le plus récent gagne' else 'ÉCHEC  vieil événement appliqué' end from profiles where id = :L;

-- 4. Résiliation : l'accès reste jusqu'à l'échéance ; expiration : il s'arrête
select public.apply_store_event(pg_temp.ev('CANCELLATION', 'e3', 20, '{"cancel_reason":"UNSUBSCRIBE"}'));
select case when p.premium and s.status = 'cancelled' and not s.auto_renew then 'OK  résiliation : Premium gardé jusqu''à l''échéance' else 'ÉCHEC  résiliation' end
  from profiles p join subscriptions s on s.user_id = p.id and s.store_ref = 'tx-1' where p.id = :L;
select public.apply_store_event(pg_temp.ev('EXPIRATION', 'e4', 30));
select case when not premium and premium_until is null then 'OK  expiration : Premium retiré' else 'ÉCHEC  expiration' end from profiles where id = :L;

-- 5. Compte inconnu : noté, rien d'accordé
select case when public.apply_store_event(pg_temp.ev('INITIAL_PURCHASE', 'e5', 0, '{"app_user_id":"$RCAnonymousID:zzz","aliases":[],"original_transaction_id":"tx-2"}')) = 'compte inconnu'
             and not exists (select 1 from subscriptions where store_ref = 'tx-2') then 'OK  achat d''un compte inconnu noté sans rien accorder' else 'ÉCHEC  compte inconnu' end;

-- 6. Codes promo
insert into promo_codes (code, days, max_uses) values ('BIENVENUE', 30, 1), ('ENCORE', 1, 5);
set role authenticated;
set request.jwt.claim.sub = :L;
select public.redeem_code(' bienvenue ') is not null;
select public.redeem_code('ENCORE') is not null;
do $$ begin perform public.redeem_code('ENCORE'); raise exception 'passé'; exception when raise_exception then if sqlerrm not like '%déjà utilisé%' then raise; end if; end $$;
set request.jwt.claim.sub = :M;
select public.redeem_code('BIENVENUE')->>'error' like '%pas valable%';
reset role;
select case when (select premium from profiles where id = :L) and (select uses from promo_codes where code = 'BIENVENUE') = 1 and not (select premium from profiles where id = :M)
            then 'OK  code promo : 30 jours offerts, une fois par compte, nombre d''utilisations limité' else 'ÉCHEC  code promo' end;
set role authenticated;
set request.jwt.claim.sub = :M;
do $$ begin for i in 1..12 loop begin perform public.redeem_code('FAUX' || i); exception when raise_exception then null; end; end loop; end $$;
do $$ begin perform public.redeem_code('BIENVENUE'); raise exception 'passé'; exception when raise_exception then if sqlerrm not like 'Trop d%' then raise; end if; end $$;
reset role;
select 'OK  codes devinés : bloqué après 10 essais ratés en une heure';

-- 7. L'équipe offre et retire Premium (administrateurs seulement), et c'est au journal
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$ begin perform public.admin_grant_premium('00000000-0000-0000-0000-000000000003', 30); raise exception 'passé'; exception when raise_exception then if sqlerrm = 'passé' then raise; end if; end $$;
set request.jwt.claim.sub = :ADM;
select public.admin_grant_premium(:M, 90, 'Gagnant du concours') is not null;
select public.admin_grant_premium(:L, 10) > now() + interval '40 days'; -- ajouté après les 31 jours des codes
reset role;
select case when (select premium from profiles where id = :M) and (select count(*) from audit_log where action = 'Premium offert') = 2
            then 'OK  Premium offert par un admin (refusé à la rédaction), jours ajoutés à la suite, tracé au journal' else 'ÉCHEC  Premium offert' end;
set role authenticated;
set request.jwt.claim.sub = :ADM;
select public.admin_revoke_premium(:M, 'Erreur') = 1;
select case when count(*) = 1 and bool_and(not live) then 'OK  liste des abonnés : Premium retiré visible' else 'ÉCHEC  liste des abonnés' end from public.admin_subscribers('marie', 'all');
select case when (s->>'paying')::int = 0 and (s->>'gift')::int = 1 and (s->>'revenue_all_cents')::int = 299 then 'OK  chiffres clés : revenus, abonnés payants et offerts' else 'ÉCHEC  chiffres clés ' || s::text end from public.premium_stats() s;
reset role;
select case when not premium then 'OK  Premium retiré tout de suite' else 'ÉCHEC  retrait' end from profiles where id = :M;

-- 8. Échéance passée : le moteur éteint Premium
update subscriptions set expires_at = now() - interval '1 minute' where user_id = :L and source in ('code', 'gift');
select public.expire_premium() = 3;
select case when not premium then 'OK  échéance passée : Premium éteint par le moteur' else 'ÉCHEC  échéance' end from profiles where id = :L;
