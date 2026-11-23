-- Reconnaissance : badges des lecteurs, paliers de lecture, statut donné à la main, badges cachés, ratio de likes.
\set QUIET on
\set ON_ERROR_STOP on
\echo --- Reconnaissance des lecteurs
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b1', 'lea@test.fr'), ('00000000-0000-0000-0000-0000000000b2', 'admin@test.fr') on conflict do nothing;
update profiles set pseudo = 'Lea', premium = true where id = '00000000-0000-0000-0000-0000000000b1';
update profiles set pseudo = 'Chef', role = 'admin' where id = '00000000-0000-0000-0000-0000000000b2';
insert into editions (date, status) values (current_date + 2, 'published') on conflict (date) do update set status = 'published';
insert into articles (edition_date, rubric_id, status, importance, title, key_sentence, facts, summary, published_at)
select current_date + 2, 'france', 'published', 5, 'Badge ' || i, 'Phrase clé.', '[{"text":"Un fait","source":"AFP","url":"https://a.test"}]', '["a","b","c"]', now()
  from generate_series(1, 4) i;
update badges set threshold = 3 where label = 'Curieux';
update badges set threshold = 5 where label = 'Assidu';

-- Léa lit 4 infos (une deux fois) depuis son téléphone, connectée.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
select track('telephone-lea', (select jsonb_agg(jsonb_build_object('a', id, 'k', 'view')) from (select id from articles where title like 'Badge %' order by id limit 4) x));
select track('telephone-lea', (select jsonb_agg(jsonb_build_object('a', id, 'k', 'view')) from (select id from articles where title like 'Badge %' order by id limit 1) x));
set session_replication_role = replica; -- mode emoji réglé plus haut dans les tests : on passe ses garde-fous
insert into comments (article_id, user_id, text) select id, '00000000-0000-0000-0000-0000000000b1', 'Merci pour le résumé' from articles where title like 'Badge %' order by id limit 1;
set session_replication_role = default;
reset request.jwt.claim.sub;

select case when (select count(*) from user_reads where user_id = '00000000-0000-0000-0000-0000000000b1') = 4
  then 'OK  infos lues comptées une seule fois par compte' else 'ÉCHEC  compteur de lecture' end;
select case when (select string_agg(x->>'label', ',') from jsonb_array_elements(badges_of('00000000-0000-0000-0000-0000000000b1')) x) = 'Premium,Curieux,Pionnier'
  then 'OK  badges : Premium, palier de lecture le plus haut atteint seulement, Pionnier'
  else 'ÉCHEC  badges : ' || badges_of('00000000-0000-0000-0000-0000000000b1')::text end;

-- Un admin donne « Bienfaiteur » à la main ; un lecteur ne peut pas.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
do $$ begin
  perform grant_badge('00000000-0000-0000-0000-0000000000b1', (select id from badges where label = 'Bienfaiteur'), true);
  raise exception 'pas refusé';
exception when others then if sqlerrm = 'pas refusé' then raise; end if; end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b2';
select grant_badge('00000000-0000-0000-0000-0000000000b1', (select id from badges where label = 'Bienfaiteur'), true);
select case when badges_of('00000000-0000-0000-0000-0000000000b1') @> '[{"label":"Bienfaiteur"}]' and (select count(*) from badge_holders((select id from badges where label = 'Bienfaiteur'))) = 1
        and exists (select 1 from audit_log where action = 'Statut attribué' and target = 'Lea')
  then 'OK  Bienfaiteur donné à la main par un administrateur, noté au journal' else 'ÉCHEC  statut donné à la main' end;
reset request.jwt.claim.sub;

-- Fiche publique ouverte depuis un commentaire, temps gagné.
select case when (c->>'reads')::int = 4 and (c->>'minutes_saved')::numeric = 12 and jsonb_array_length(c->'badges') = 4
  then 'OK  fiche du lecteur depuis son commentaire : 4 infos lues, 12 min gagnées, 4 badges' else 'ÉCHEC  fiche : ' || c::text end
  from (select reader_card((select id from comments where text = 'Merci pour le résumé')) c) x;
select case when jsonb_array_length(badges) = 4 then 'OK  badges envoyés avec les commentaires' else 'ÉCHEC  badges des commentaires' end
  from article_comments((select article_id from comments where text = 'Merci pour le résumé')) where text = 'Merci pour le résumé';

-- Léa cache ses badges : les autres ne voient plus que son pseudo, elle voit toujours les siens.
update profiles set show_badges = false where id = '00000000-0000-0000-0000-0000000000b1';
select case when (select reader_card((select id from comments where text = 'Merci pour le résumé'))) = '{"pseudo": "Lea", "hidden": true}'::jsonb
        and (select badges from article_comments((select article_id from comments where text = 'Merci pour le résumé')) where text = 'Merci pour le résumé') = '[]'::jsonb
  then 'OK  badges cachés par le lecteur' else 'ÉCHEC  badges cachés' end;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
select case when (reader_card()->>'hidden')::boolean = false and jsonb_array_length(reader_card()->'badges') = 4 then 'OK  le lecteur voit toujours ses propres badges' else 'ÉCHEC  mes badges' end;
reset request.jwt.claim.sub;

-- Ratio : lecteurs qui ont vu l'info.
select case when views >= 1 then 'OK  nombre de lecteurs par info transmis à l''app (ratio des pouces)' else 'ÉCHEC  vues par info' end
  from article_stats where article_id = (select article_id from comments where text = 'Merci pour le résumé');
select case when (public.app_config()->'recognition'->>'minutes_per_article')::int = 3 and not has_table_privilege('anon', 'user_reads', 'select') and not has_table_privilege('anon', 'user_badges', 'select')
  then 'OK  réglages de la reconnaissance transmis à l''app, lectures et statuts fermés au public' else 'ÉCHEC  réglages ou droits' end;
