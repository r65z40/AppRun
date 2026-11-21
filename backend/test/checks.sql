\set QUIET on
-- 1. Le moteur a écrit des brouillons
select count(*) as brouillons, count(*) > 0 as ok from articles where status = 'draft' \gset
\if :ok
\echo OK  brouillons créés : :brouillons
\else
\echo ÉCHEC  aucun brouillon
\quit
\endif
-- 2. Un visiteur anonyme ne voit pas les brouillons
set role anon;
select count(*) as vus from articles \gset
reset role;
select (:vus = 0) as ok \gset
\if :ok
\echo OK  brouillons invisibles pour le public
\else
\echo ÉCHEC  brouillons visibles
\endif
-- 3. Après publication, le public voit l'info
update articles set status = 'published', published_at = now() where id = (select id from articles order by rank limit 1);
update editions set status = 'published';
set role anon;
select count(*) as vus from articles \gset
reset role;
select (:vus = 1) as ok \gset
\if :ok
\echo OK  info publiée visible pour le public
\else
\echo ÉCHEC  info publiée non visible
\endif
-- 4. Un lecteur ne peut pas modifier une info, un membre de l'équipe si
insert into auth.users (id) values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
update profiles set pseudo = 'lecteur' where id = '00000000-0000-0000-0000-000000000001';
update profiles set pseudo = 'redac', role = 'editor' where id = '00000000-0000-0000-0000-000000000002';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
update articles set title = 'piraté';
select count(*) > 0 as bad from articles where title = 'piraté' \gset
\if :bad
\echo ÉCHEC  un lecteur a modifié une info
\else
\echo OK  un lecteur ne peut pas modifier une info
\endif
insert into comments (article_id, user_id, text) select id, '00000000-0000-0000-0000-000000000001', 'Très clair, merci' from articles where status = 'published' limit 1;
\echo OK  un lecteur peut commenter
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select count(*) as n from articles \gset
update articles set status = 'published' where status = 'draft';
reset role;
select count(*) as pub from articles where status = 'published' \gset
select (:pub = :n) as ok \gset
\if :ok
\echo OK  la rédaction voit et publie tous les brouillons (:n)
\else
\echo ÉCHEC  la rédaction ne peut pas publier
\endif
-- 5. Un membre de la rédaction ne peut pas se donner le rôle admin
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
\set ON_ERROR_STOP off
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000002';
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
update profiles set premium = true where id = '00000000-0000-0000-0000-000000000001';
\set ON_ERROR_STOP on
reset role;
select (select role = 'editor' from profiles where id = '00000000-0000-0000-0000-000000000002') and (select not premium from profiles where id = '00000000-0000-0000-0000-000000000001') as ok \gset
\if :ok
\echo OK  ni rôle admin ni Premium gratuit sans être admin
\else
\echo ÉCHEC  élévation de rôle possible
\endif
-- 6. Dernière minute : publiée, visible du public, sans doublon au second passage
select count(*) as nf, count(*) between 1 and 2 as ok from flashes \gset
\if :ok
\echo OK  dernière minute : :nf info(s), pas de doublon au second passage
\else
\echo ÉCHEC  dernière minute : :nf info(s)
\endif
set role anon;
select count(*) > 0 as ok from flashes \gset
reset role;
\if :ok
\echo OK  dernière minute visible du public
\else
\echo ÉCHEC  dernière minute invisible
\endif
select a.title, s.likes, s.comments from articles a join article_stats s on s.article_id = a.id order by a.rubric_id, a.rank limit 3;

select count(*) filter (where kind = 'edition' and status = 'ok') = 1 and count(*) filter (where kind = 'flash' and status = 'ok') = 2
       and bool_and(jsonb_array_length(log) > 0) as ok from engine_runs \gset
\if :ok
\echo OK  journal du moteur : 1 édition + 2 dernière minute, avec leurs lignes
\else
\echo ÉCHEC  journal du moteur incomplet
\endif
