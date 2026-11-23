-- Parrainage : lien d'invitation, code tapé après coup, validation après lecture, jours Premium, badge Ambassadeur.
\set QUIET on
\set ON_ERROR_STOP on
\echo --- Parrainage
insert into app_settings (key, value) values ('REFERRAL', '{"confirm_reads": 2, "referrer_days": 7, "referee_days": 3, "max_rewarded": 1}')
on conflict (key) do update set value = excluded.value;
update badges set threshold = 2 where label = 'Ambassadeur';
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c1', 'parrain@test.fr') on conflict do nothing;
update profiles set pseudo = 'Parrain' where id = '00000000-0000-0000-0000-0000000000c1';

-- Le parrain ouvre « Mon compte » : son code est créé une fois pour toutes.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select case when (my_referral()->>'code') ~ '^[A-Z2-9]{6}$' and my_referral()->>'code' = my_referral()->>'code'
        and (my_referral()->>'confirmed')::int = 0 and my_referral()->'next_badge'->>'label' = 'Ambassadeur'
  then 'OK  code de parrainage créé, stable, prochain badge : Ambassadeur' else 'ÉCHEC  mon parrainage : ' || my_referral()::text end;
reset request.jwt.claim.sub;

-- Deux amis s'inscrivent avec le lien (code en minuscules et avec un espace : toléré), un troisième avec un code abîmé.
insert into auth.users (id, email, raw_user_meta_data) select '00000000-0000-0000-0000-0000000000c2', 'ami1@test.fr',
  jsonb_build_object('ref', lower(code)) from referral_codes where user_id = '00000000-0000-0000-0000-0000000000c1';
insert into auth.users (id, email, raw_user_meta_data) select '00000000-0000-0000-0000-0000000000c3', 'ami2@test.fr',
  jsonb_build_object('ref', ' ' || code) from referral_codes where user_id = '00000000-0000-0000-0000-0000000000c1';
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000c4', 'ami3@test.fr', '{"ref": "ZZZZZZ"}');
update profiles set pseudo = 'Ami' || right(id::text, 1) where id in ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000c4');
select case when (select count(*) from referrals where referrer = '00000000-0000-0000-0000-0000000000c1' and confirmed_at is null) = 2
        and exists (select 1 from profiles where id = '00000000-0000-0000-0000-0000000000c4')
  then 'OK  inscriptions avec le lien suivies ; code inconnu ignoré sans bloquer l''inscription' else 'ÉCHEC  inscriptions parrainées' end;

-- Le troisième tape un code : le sien refusé, un inconnu refusé, celui du parrain accepté ; une deuxième fois refusé.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c4';
select case when claim_referral((select code from referral_codes where user_id = '00000000-0000-0000-0000-0000000000c1'))->>'referrer' = 'Parrain'
        and claim_referral('ABCDEF') ? 'error'
  then 'OK  code tapé dans Mon compte accepté une seule fois' else 'ÉCHEC  code tapé' end;
reset request.jwt.claim.sub;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select case when claim_referral(my_referral()->>'code')->>'error' = 'C''est votre propre code'
  then 'OK  impossible de se parrainer soi-même' else 'ÉCHEC  auto-parrainage' end;
reset request.jwt.claim.sub;

-- Le premier ami lit 2 infos : parrainage validé, 7 jours Premium au parrain et 3 au filleul.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c2';
select track('telephone-ami1', (select jsonb_agg(jsonb_build_object('a', id, 'k', 'view')) from (select id from articles where status = 'published' order by id limit 2) x));
reset request.jwt.claim.sub;
select case when (select confirmed_at is not null and referrer_days = 7 and referee_days = 3 from referrals where referee = '00000000-0000-0000-0000-0000000000c2')
        and (select premium from profiles where id = '00000000-0000-0000-0000-0000000000c1')
        and (select premium from profiles where id = '00000000-0000-0000-0000-0000000000c2')
        and (select confirmed_at is null from referrals where referee = '00000000-0000-0000-0000-0000000000c3')
  then 'OK  parrainage validé après 2 infos lues : Premium offert au parrain (7 j) et au filleul (3 j)' else 'ÉCHEC  validation du parrainage' end;

-- Le deuxième lit aussi : validé, mais le parrain a atteint son plafond de filleuls récompensés (1). Badge Ambassadeur.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c3';
select track('telephone-ami2', (select jsonb_agg(jsonb_build_object('a', id, 'k', 'view')) from (select id from articles where status = 'published' order by id limit 2) x));
reset request.jwt.claim.sub;
select case when (select referrer_days = 0 and referee_days = 3 and confirmed_at is not null from referrals where referee = '00000000-0000-0000-0000-0000000000c3')
        and badges_of('00000000-0000-0000-0000-0000000000c1') @> '[{"label":"Ambassadeur"}]'
        and not badges_of('00000000-0000-0000-0000-0000000000c1') @> '[{"label":"Grand ambassadeur"}]'
  then 'OK  plafond de récompenses respecté, badge Ambassadeur à 2 filleuls validés' else 'ÉCHEC  plafond ou badge : ' || badges_of('00000000-0000-0000-0000-0000000000c1')::text end;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select case when (r->>'confirmed')::int = 2 and (r->>'pending')::int = 1 and (r->>'days_earned')::int = 7 and (r->>'referrer_days')::int = 0
        and r->'next_badge'->>'label' = 'Grand ambassadeur'
  then 'OK  Mon compte : 2 amis validés, 1 en attente, 7 jours gagnés' else 'ÉCHEC  résumé du parrain : ' || r::text end from (select my_referral() r) x;
reset request.jwt.claim.sub;

-- Back office : réservé aux administrateurs ; tables fermées au public.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b2';
select case when (a->'totals'->>'referrals')::int = 3 and (a->'totals'->>'confirmed')::int = 2 and a->'top'->0->>'pseudo' = 'Parrain'
  then 'OK  back office : chiffres et meilleurs parrains' else 'ÉCHEC  back office parrainage : ' || a::text end from (select referral_admin() a) x;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
do $$ begin perform referral_admin(); raise exception 'pas refusé';
exception when others then if sqlerrm = 'pas refusé' then raise; end if; end $$;
reset request.jwt.claim.sub;
select case when not has_table_privilege('anon', 'referrals', 'select') and not has_table_privilege('authenticated', 'referral_codes', 'select')
        and not has_function_privilege('authenticated', 'public.link_referral(uuid, text, text)', 'execute')
  then 'OK  parrainages fermés au public, back office réservé aux administrateurs' else 'ÉCHEC  droits du parrainage' end;

-- Parrainage fermé dans les réglages.
update app_settings set value = '{"enabled": false}' where key = 'REFERRAL';
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c5', 'ami4@test.fr');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c5';
select case when my_referral() = '{"enabled": false}'::jsonb and claim_referral('ABCDEF') ? 'error'
  then 'OK  parrainage coupé dans le back office' else 'ÉCHEC  parrainage coupé' end;
reset request.jwt.claim.sub;
delete from app_settings where key = 'REFERRAL';
