-- Régie publicitaire, suite : objectifs et rythme, priorité, emplacements, comptage fiable.
\set QUIET on
\set ON_ERROR_STOP on
\echo --- Régie : objectifs, rythme, comptage fiable
delete from ad_campaigns;
-- « Aujourd'hui » à Paris (la base peut tourner à l'heure UTC).
select (now() at time zone 'Europe/Paris')::date as d \gset
insert into ad_campaigns (id, name, advertiser, title, url, max_views, starts_on, ends_on, pacing, priority, placements) values
  ('00000000-0000-0000-0000-00000000ad01', 'Régulière', 'Lumen', 'Pub R', 'https://r.test', 1000, :'d'::date - 1, :'d'::date + 8, 'even', 2, '{edition,flash}'),
  ('00000000-0000-0000-0000-00000000ad02', 'Rapide', 'Rayon', 'Pub F', 'https://f.test', 1000, :'d'::date - 1, :'d'::date + 8, 'fast', 1, '{edition}'),
  ('00000000-0000-0000-0000-00000000ad03', 'Maison', 'TITRE', 'Pub M', 'https://m.test', null, :'d'::date - 5, null, 'even', 3, '{edition,flash,rubrics}');
-- Hier : 100 affichages pour la régulière. Reste 900 en 9 jours : 100 par jour.
insert into ad_stats (campaign_id, day, placement, views) values ('00000000-0000-0000-0000-00000000ad01', :'d'::date - 1, 'edition', 100);

select case when need_today = 100 and days_left = 9 and factor >= 1 and today = 0
  then 'OK  objectif : 100 par jour pour finir pile à la date de fin, en retard ce matin donc accélérée' else 'ÉCHEC  rythme : ' || row(p.*)::text end
  from ad_pacing() p where id = '00000000-0000-0000-0000-00000000ad01';

set role anon;
select case when (select weight from live_ads() where id = '00000000-0000-0000-0000-00000000ad02') = 5
        and (select weight from live_ads() where id = '00000000-0000-0000-0000-00000000ad03') = 0.2
        and (select placements from live_ads() where id = '00000000-0000-0000-0000-00000000ad01') = '{edition,flash}'
  then 'OK  priorité haute ×5, remplissage ×0,2 ; emplacements transmis à l''app' else 'ÉCHEC  poids ou emplacements' end;
reset role;

-- Part du jour faite : la régulière attend demain ; la rapide continue.
insert into ad_stats (campaign_id, day, placement, views) values
  ('00000000-0000-0000-0000-00000000ad01', :'d'::date, 'edition', 110), ('00000000-0000-0000-0000-00000000ad02', :'d'::date, 'edition', 500);
set role anon;
select case when not exists (select 1 from live_ads() where id = '00000000-0000-0000-0000-00000000ad01')
        and exists (select 1 from live_ads() where id = '00000000-0000-0000-0000-00000000ad02')
  then 'OK  campagne régulière : part du jour faite, elle s''efface jusqu''à demain ; « au plus vite » continue' else 'ÉCHEC  freinage' end;
reset role;
delete from ad_stats where day = :'d'::date;

-- Comptage : un renvoi ne compte pas deux fois ; le clic seulement sur un affichage compté, depuis le même téléphone.
set role anon;
select case when ad_hits('telephone-1', '[
    {"i": "11111111-1111-4111-8111-111111111111", "c": "00000000-0000-0000-0000-00000000ad01", "p": "flash", "k": "view"},
    {"i": "11111111-1111-4111-8111-111111111111", "c": "00000000-0000-0000-0000-00000000ad01", "p": "flash", "k": "view"},
    {"i": "11111111-1111-4111-8111-111111111111", "c": "00000000-0000-0000-0000-00000000ad01", "p": "flash", "k": "click"},
    {"i": "11111111-1111-4111-8111-111111111111", "c": "00000000-0000-0000-0000-00000000ad01", "p": "flash", "k": "click"},
    {"i": "22222222-2222-4222-8222-222222222222", "c": "00000000-0000-0000-0000-00000000ad01", "p": "edition", "k": "click"},
    {"i": "33333333-3333-4333-8333-333333333333", "c": "00000000-0000-0000-0000-0000000000ff", "p": "edition", "k": "view"},
    {"i": "pas-un-uuid", "c": "00000000-0000-0000-0000-00000000ad01", "k": "view"}
  ]') = 2 and ad_hits('telephone-2', '[{"i": "11111111-1111-4111-8111-111111111111", "c": "00000000-0000-0000-0000-00000000ad01", "p": "flash", "k": "click"}]') = 0
  then 'OK  comptage : doublon, clic sans affichage, clic d''un autre téléphone, campagne inconnue et données abîmées ignorés'
  else 'ÉCHEC  dédoublonnage' end;
reset role;
select case when (select views || '/' || clicks from ad_stats where campaign_id = '00000000-0000-0000-0000-00000000ad01' and day = :'d'::date and placement = 'flash') = '1/1'
  then 'OK  affichage et clic rangés sous Dernière minute' else 'ÉCHEC  emplacement des statistiques' end;

-- Impressions : une pub apparue un instant compte une impression ; restée 1 s, elle devient un affichage ; pas de clic avant.
set role anon;
select ad_hits('telephone-5', '[
    {"i": "55555555-5555-4555-8555-555555555555", "c": "00000000-0000-0000-0000-00000000ad01", "p": "edition", "k": "imp"},
    {"i": "55555555-5555-4555-8555-555555555555", "c": "00000000-0000-0000-0000-00000000ad01", "p": "edition", "k": "click"},
    {"i": "66666666-6666-4666-8666-666666666666", "c": "00000000-0000-0000-0000-00000000ad01", "p": "edition", "k": "imp"},
    {"i": "66666666-6666-4666-8666-666666666666", "c": "00000000-0000-0000-0000-00000000ad01", "p": "edition", "k": "imp"},
    {"i": "66666666-6666-4666-8666-666666666666", "c": "00000000-0000-0000-0000-00000000ad01", "p": "edition", "k": "view"},
    {"i": "66666666-6666-4666-8666-666666666666", "c": "00000000-0000-0000-0000-00000000ad01", "p": "edition", "k": "view"},
    {"i": "66666666-6666-4666-8666-666666666666", "c": "00000000-0000-0000-0000-00000000ad01", "p": "edition", "k": "click"}
  ]') \gset imp_
reset role;
select case when :imp_ad_hits = 4
        and (select impressions || '/' || views || '/' || clicks from ad_stats where campaign_id = '00000000-0000-0000-0000-00000000ad01' and day = :'d'::date and placement = 'edition') = '2/1/1'
        and (select impressions || '/' || views from ad_stats where campaign_id = '00000000-0000-0000-0000-00000000ad01' and day = :'d'::date and placement = 'flash') = '1/1'
  then 'OK  impressions : pub vue un instant comptée, affichage à 1 s, clic seulement après un affichage' else 'ÉCHEC  impressions' end;

-- Hors ligne : un affichage d'il y a 100 h arrive maintenant, ramené à 72 h ; la campagne maison avait commencé.
set role anon;
select ad_hits('telephone-1', jsonb_build_array(jsonb_build_object('i', '44444444-4444-4444-8444-444444444444', 'c', '00000000-0000-0000-0000-00000000ad03',
  'p', 'rubrics', 'k', 'view', 't', extract(epoch from now() - interval '100 hours') * 1000))) \gset late_
reset role;
select case when :late_ad_hits = 1 and (select day from ad_impressions where id = '44444444-4444-4444-8444-444444444444') = ((now() - interval '72 hours') at time zone 'Europe/Paris')::date
  then 'OK  affichage fait hors ligne compté au bon jour (72 h au plus)' else 'ÉCHEC  rattrapage hors ligne' end;

-- Anti-abus : 35 affichages d'une campagne depuis un même téléphone dans la journée, 30 comptés.
set role anon;
select ad_hits('telephone-3', (select jsonb_agg(jsonb_build_object('i', gen_random_uuid(), 'c', '00000000-0000-0000-0000-00000000ad02', 'p', 'edition', 'k', 'view')) from generate_series(1, 35))) \gset abus_
reset role;
select case when :abus_ad_hits = 30 then 'OK  anti-abus : au plus 30 affichages d''une campagne par téléphone et par jour' else 'ÉCHEC  anti-abus : ' || :abus_ad_hits end;

-- Accès : le détail des affichages et le rythme sont fermés au public.
select case when not has_table_privilege('anon', 'ad_impressions', 'select') and not has_function_privilege('anon', 'ad_pacing()', 'execute')
        and not has_function_privilege('anon', 'ad_purge()', 'execute')
  then 'OK  détail des affichages et rythme fermés au public' else 'ÉCHEC  accès à la régie' end;
do $$ begin
  set local role anon;
  perform public.ad_report();
  raise notice 'ÉCHEC  ad_report ouvert';
exception when others then null; end $$;

-- Ménage : le détail part après 35 jours, les totaux restent.
update ad_impressions set at = now() - interval '40 days' where id = '44444444-4444-4444-8444-444444444444';
select ad_purge();
select case when not exists (select 1 from ad_impressions where id = '44444444-4444-4444-8444-444444444444')
        and exists (select 1 from ad_stats where campaign_id = '00000000-0000-0000-0000-00000000ad03')
  then 'OK  ménage : détail des affichages effacé après 35 jours, totaux gardés' else 'ÉCHEC  ménage' end;

-- Rejouable : la migration repasse sans erreur.
\i supabase/migrations/0025_regie_objectifs.sql
select 'OK  migration 0025 rejouable';
