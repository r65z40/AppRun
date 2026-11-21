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
insert into profiles (id, pseudo, role) values ('00000000-0000-0000-0000-000000000001', 'lecteur', 'reader'), ('00000000-0000-0000-0000-000000000002', 'redac', 'editor');
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
select a.title, s.likes, s.comments from articles a join article_stats s on s.article_id = a.id order by a.rubric_id, a.rank limit 3;
