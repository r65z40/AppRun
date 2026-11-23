-- Suivre un sujet : suivi, alertes (jamais pour un sujet sensible), frise, comptes, droits.
\set QUIET on
\set ON_ERROR_STOP on
\echo --- Suivre un sujet
-- Pas d'heures calmes pendant le test (il peut tourner la nuit).
insert into app_settings (key, value) values ('FOLLOW', '{"quiet_start": 0, "quiet_end": 0}')
on conflict (key) do update set value = excluded.value;
insert into editions (date, status) values (current_date + 2, 'published') on conflict (date) do update set status = 'published';

select jsonb_array_length(follow_topic('tel-lecteur-1', 'Ukraine', true)->'following') as n1 \gset
select follow_topic('tel-lecteur-1', 'Budget', true, false) \gset
select register_push('tel-lecteur-1', 'ExponentPushToken[test-1]', 'ios');
select case when :n1 = 1 and (my_topics('tel-lecteur-1')->'suggested') @> '["Ukraine", "Budget"]'
  then 'OK  sujet suivi sans compte, sujets proposés dans l''app' else 'ÉCHEC  suivi' end;

-- Puis l'actualité bouge : une info sur l'Ukraine, une autre sensible, une Dernière minute sensible.
insert into articles (edition_date, rubric_id, status, importance, title, key_sentence, facts, summary, published_at, sensitive)
values (current_date + 2, 'monde', 'published', 8, 'Sommet à Kiev sur la paix', 'Phrase clé.', '[{"text":"Un fait","source":"AFP","url":"https://a.test"}]', '["a","b","c"]', now(), false),
       (current_date + 2, 'monde', 'published', 9, 'Frappe meurtrière en Ukraine', 'Phrase clé.', '[{"text":"Un fait","source":"AFP","url":"https://a.test"}]', '["a","b","c"]', now(), true),
       (current_date + 2, 'france', 'published', 9, 'Le budget adopté au Parlement', 'Phrase clé.', '[{"text":"Un fait","source":"AFP","url":"https://a.test"}]', '["a","b","c"]', now(), false);
insert into flashes (title, sentence, importance, sensitive) values ('Attentat à Kiev', 'Un attentat a fait des victimes en Ukraine.', 10, true);

create temp table al as select * from take_topic_alerts();
select case when count(*) = 1 and min(topic) = 'Ukraine' and min(body) = 'Sommet à Kiev sur la paix' and min(token) = 'ExponentPushToken[test-1]'
  then 'OK  alerte envoyée pour le sujet suivi, jamais pour un sujet sensible ni un sujet aux alertes coupées'
  else 'ÉCHEC  alertes : ' || coalesce(string_agg(topic || ' / ' || body, ' ; '), 'aucune') end from al;
select case when (select count(*) from take_topic_alerts()) = 0
  then 'OK  pas deux fois la même alerte, délai entre deux alertes du même sujet' else 'ÉCHEC  alerte répétée' end;

-- Heures calmes : rien ne part.
insert into app_settings (key, value) values ('FOLLOW', '{"quiet_start": 0, "quiet_end": 24, "cooldown_hours": 0}')
on conflict (key) do update set value = excluded.value;
insert into articles (edition_date, rubric_id, status, importance, title, key_sentence, facts, summary, published_at)
values (current_date + 2, 'monde', 'published', 8, 'Ukraine : accord sur les céréales', 'Phrase clé.', '[{"text":"Un fait","source":"AFP","url":"https://a.test"}]', '["a","b","c"]', now());
select case when (select count(*) from take_topic_alerts()) = 0 then 'OK  heures calmes : aucune alerte' else 'ÉCHEC  heures calmes' end;
update app_settings set value = '{"quiet_start": 0, "quiet_end": 0, "max_follows": 2}' where key = 'FOLLOW';

-- La frise : infos et Dernière minute du sujet, la plus récente en tête ; l'ouvrir remet « nouveau » à zéro.
select case when (select (x->>'new')::int from jsonb_array_elements(my_topics('tel-lecteur-1')->'following') x where x->>'topic' = 'Ukraine') >= 3
        and jsonb_array_length(topic_timeline('tel-lecteur-1', 'Ukraine')->'items') >= 4
        and (select (x->>'new')::int from jsonb_array_elements(my_topics('tel-lecteur-1')->'following') x where x->>'topic' = 'Ukraine') = 0
        and exists (select 1 from jsonb_array_elements(topic_timeline('tel-lecteur-1', 'Ukraine')->'items') i where i->>'kind' = 'f')
  then 'OK  frise du sujet (infos et Dernière minute), compteur « nouveau » remis à zéro' else 'ÉCHEC  frise' end;
select case when (topics_of(array(select id from articles where title = 'Le budget adopté au Parlement'))->(select id::text from articles where title = 'Le budget adopté au Parlement')) ? 'Budget'
  then 'OK  boutons « Suivre » : sujets de chaque info (dont le nouveau mot-clé Budget)' else 'ÉCHEC  sujets des infos' end;

-- Plafond de sujets suivis.
do $$ begin
  perform follow_topic('tel-lecteur-1', 'Climat', true);
  raise exception 'plafond ignoré';
exception when others then
  if sqlerrm not like 'Vous suivez déjà 2 sujets%' then raise; end if;
end $$;
select 'OK  plafond de sujets suivis par lecteur';

-- Connexion : les sujets suivis sur le téléphone passent sur le compte.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f1', 'suivi@test.fr') on conflict do nothing;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
select jsonb_array_length(my_topics('tel-lecteur-1')->'following') as n2 \gset
select case when :n2 = 2
        and (select count(*) from topic_follows where who = '00000000-0000-0000-0000-0000000000f1') = 2
        and not exists (select 1 from topic_follows where who = 'd:tel-lecteur-1')
  then 'OK  sujets suivis gardés à la connexion' else 'ÉCHEC  passage sur le compte' end;
select register_push('tel-lecteur-1', 'ExponentPushToken[test-1]', 'ios');
reset request.jwt.claim.sub;
update topic_follows set alerts = true where topic = 'Budget';
update app_settings set value = '{"quiet_start": 0, "quiet_end": 0, "alert_title": "{sujet} bouge", "alert_body": "À l''instant : {titre}"}' where key = 'FOLLOW';
select case when (select title || ' | ' || body from take_topic_alerts()) = 'Budget bouge | À l''instant : Le budget adopté au Parlement'
  then 'OK  alerte du compte connecté, textes réglés dans le back office' else 'ÉCHEC  textes des alertes' end;

-- Droits : le public ne lit ni les sujets suivis ni les téléphones, et ne déclenche pas d'alertes.
set role anon;
select case when not has_table_privilege('anon', 'topic_follows', 'select') and not has_table_privilege('anon', 'push_devices', 'select')
        and not has_function_privilege('anon', 'take_topic_alerts()', 'execute') and has_function_privilege('anon', 'follow_topic(text, text, boolean, boolean)', 'execute')
  then 'OK  suivis et téléphones fermés au public' else 'ÉCHEC  droits du suivi' end;
reset role;
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a1';
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select case when (follow_stats()->>'followers')::int = 1 and (follow_stats()->>'alerts_7')::int = 2 and jsonb_array_length(follow_stats()->'recent') = 2
  then 'OK  back office : lecteurs, alertes et sujets suivis' else 'ÉCHEC  statistiques du suivi : ' || follow_stats()::text end;
reset request.jwt.claim.sub;
-- Nettoyage.
delete from app_settings where key = 'FOLLOW';
delete from editions where date = current_date + 2;
delete from flashes where title = 'Attentat à Kiev';
