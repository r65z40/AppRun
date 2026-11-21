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
-- Le tout premier compte devient administrateur (installation), les suivants sont lecteurs.
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000ad');
insert into auth.users (id) values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
select (select role from profiles where id = '00000000-0000-0000-0000-0000000000ad') = 'admin'
   and (select role from profiles where id = '00000000-0000-0000-0000-000000000001') = 'reader' as ok \gset
\if :ok
\echo OK  premier compte = administrateur, les suivants = lecteurs
\else
\echo ÉCHEC  rôle du premier compte
\endif
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

-- Réglages : invisibles pour un lecteur, modifiables par l'administrateur, clés masquées.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
\set ON_ERROR_STOP off
select public.set_setting('ANTHROPIC_API_KEY', 'sk-ant-pirate');
select count(*) from public.app_settings;
\set ON_ERROR_STOP on
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000ad';
select public.set_setting('ANTHROPIC_API_KEY', 'sk-ant-test-1234');
select value = '••••1234' as ok from public.admin_settings() where key = 'ANTHROPIC_API_KEY' \gset
reset role;
\if :ok
\echo OK  réglages : refusés au lecteur, clé enregistrée par l’admin et affichée masquée
\else
\echo ÉCHEC  réglages
\endif
select count(*) = 1 and bool_and(value = 'sk-ant-test-1234') as ok from public.app_settings \gset
\if :ok
\echo OK  réglages : la clé du lecteur n’a pas été enregistrée
\else
\echo ÉCHEC  un lecteur a pu écrire un réglage
\endif

-- Communauté : commentaires publics avec pseudo, garde-fous, votes, signalements.
insert into auth.users (id) values ('00000000-0000-0000-0000-000000000003'), ('00000000-0000-0000-0000-000000000004'), ('00000000-0000-0000-0000-000000000005');
select id as aid from articles where status = 'published' order by rank limit 1 \gset
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
\set ON_ERROR_STOP off
insert into comments (article_id, user_id, text) values (:'aid', '00000000-0000-0000-0000-000000000003', 'sans pseudo');
update profiles set pseudo = 'pas valide !' where id = '00000000-0000-0000-0000-000000000003';
update profiles set pseudo = 'LECTEUR' where id = '00000000-0000-0000-0000-000000000003';
\set ON_ERROR_STOP on
update profiles set pseudo = 'marie.l' where id = '00000000-0000-0000-0000-000000000003';
insert into comments (article_id, user_id, text) values (:'aid', '00000000-0000-0000-0000-000000000003', '  À suivre de près  ');
reset role;
select count(*) filter (where text = 'sans pseudo') = 0 and count(*) filter (where text = 'À suivre de près') = 1 as ok from comments \gset
\if :ok
\echo OK  commentaire refusé sans pseudo, accepté avec (texte nettoyé)
\else
\echo ÉCHEC  garde-fou du pseudo
\endif
select (select pseudo from profiles where id = '00000000-0000-0000-0000-000000000003') = 'marie.l' as ok \gset
\if :ok
\echo OK  pseudo invalide ou déjà pris (majuscules comprises) refusé
\else
\echo ÉCHEC  contrôle du pseudo
\endif
-- Votes : le lecteur 1 aime le commentaire de marie.l ; un anonyme lit les commentaires avec les pseudos.
select id as cid from comments where text = 'À suivre de près' \gset
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
insert into comment_votes (user_id, comment_id, value) values ('00000000-0000-0000-0000-000000000001', :'cid', 1);
select likes = 1 and mine = 1 as ok from article_comments(:'aid') where id = :'cid' \gset
\if :ok
\echo OK  vote enregistré, visible pour son auteur
\else
\echo ÉCHEC  vote
\endif
reset role;
set request.jwt.claim.sub = '';
set role anon;
select count(*) = 2 and bool_and(pseudo in ('lecteur', 'marie.l')) and bool_and(mine = 0) as ok from article_comments(:'aid') \gset
reset role;
\if :ok
\echo OK  un visiteur lit les commentaires avec les pseudos, sans voir les profils
\else
\echo ÉCHEC  lecture publique des commentaires
\endif
-- (refus d'accès ou zéro ligne : dans les deux cas le public ne voit aucun profil)
\set ok true
set role anon;
\set ON_ERROR_STOP off
select count(*) = 0 as ok from profiles \gset
\set ON_ERROR_STOP on
reset role;
\if :ok
\echo OK  profils privés pour le public
\else
\echo ÉCHEC  profils visibles
\endif
-- Trop de commentaires d'affilée : refusé au 6e en une minute.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
insert into comments (article_id, user_id, text) select :'aid', '00000000-0000-0000-0000-000000000003', 'c' || g from generate_series(1, 4) g;
\set ON_ERROR_STOP off
insert into comments (article_id, user_id, text) values (:'aid', '00000000-0000-0000-0000-000000000003', 'de trop');
\set ON_ERROR_STOP on
reset role;
select count(*) = 0 as ok from comments where text = 'de trop' \gset
\if :ok
\echo OK  limite de 5 commentaires par minute
\else
\echo ÉCHEC  limite de rythme
\endif
-- Trois signalements différents : le commentaire est masqué automatiquement.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
insert into reports (comment_id, user_id) values (:'cid', '00000000-0000-0000-0000-000000000001');
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
insert into reports (comment_id, user_id) values (:'cid', '00000000-0000-0000-0000-000000000004');
reset role;
select status = 'visible' as ok2 from comments where id = :'cid' \gset
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000005';
insert into reports (comment_id, user_id) values (:'cid', '00000000-0000-0000-0000-000000000005');
reset role;
select :'ok2'::boolean and status = 'hidden' as ok from comments where id = :'cid' \gset
\if :ok
\echo OK  masqué automatiquement au 3e signalement (pas avant)
\else
\echo ÉCHEC  masquage automatique
\endif
-- Réactions : un like par lecteur, compté dans les statistiques publiques.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
insert into reactions (user_id, article_id, value) values ('00000000-0000-0000-0000-000000000004', :'aid', 1)
  on conflict (user_id, article_id) do update set value = excluded.value;
reset role;
set role anon;
select likes >= 1 as ok from article_stats where article_id = :'aid' \gset
reset role;
\if :ok
\echo OK  like compté dans les statistiques publiques
\else
\echo ÉCHEC  like
\endif
