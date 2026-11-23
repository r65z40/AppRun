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
-- L'info déjà commentée plus haut par « lecteur ».
select article_id as aid from comments where text = 'Très clair, merci' \gset
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

-- Clé Unsplash : acceptée et masquée comme les autres clés.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000ad';
select public.set_setting('UNSPLASH_ACCESS_KEY', 'abcdEFGH9876');
select value = '••••9876' as ok from public.admin_settings() where key = 'UNSPLASH_ACCESS_KEY' \gset
reset role;
\if :ok
\echo OK  clé Unsplash enregistrée et masquée
\else
\echo ÉCHEC  clé Unsplash
\endif

-- Filtre d'insultes : insulte refusée (même déguisée), phrases proches acceptées.
set request.jwt.claim.sub = '';
update profiles set pseudo = 'paul' where id = '00000000-0000-0000-0000-000000000004';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
\set ON_ERROR_STOP off
insert into comments (article_id, user_id, text) values (:'aid', '00000000-0000-0000-0000-000000000004', 'Quel C0NNNARD ce ministre');
\set ON_ERROR_STOP on
insert into comments (article_id, user_id, text) values (:'aid', '00000000-0000-0000-0000-000000000004', 'Bonne connaissance du sujet');
reset role;
select count(*) filter (where text like 'Quel%') = 0 and count(*) filter (where text like 'Bonne%') = 1
   and not public.has_insult('pique-nique, TGV, salopette, ordures ménagères, technique')
   and public.has_insult('f1ls de PUTE') and public.has_insult('ta gueule !') as ok from comments \gset
\if :ok
\echo OK  insultes refusées (même déguisées), mots proches acceptés
\else
\echo ÉCHEC  filtre d’insultes
\endif
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000ad';
select public.set_setting('BANNED_WORDS', 'brocoli, navet');
reset role;
select public.has_insult('Espèce de navet') as ok \gset
\if :ok
\echo OK  mots interdits ajoutés dans les réglages
\else
\echo ÉCHEC  mots interdits des réglages
\endif
-- Modération « IA seulement » : le filtre de mots-clés se met en retrait.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000ad';
select public.set_setting('MODERATION', 'ai');
reset role;
select not public.has_insult('Quel connard') as ok \gset
set role authenticated;
select public.set_setting('MODERATION', '');
reset role;
select :'ok'::boolean and public.has_insult('Quel connard') as ok \gset
\if :ok
\echo OK  mode « IA seulement » : mots-clés désactivés, rétablis ensuite
\else
\echo ÉCHEC  choix du mode de modération
\endif
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
\set ON_ERROR_STOP off
update profiles set pseudo = 'gros_connard' where id = '00000000-0000-0000-0000-000000000004';
\set ON_ERROR_STOP on
reset role;
select pseudo = 'paul' as ok from profiles where id = '00000000-0000-0000-0000-000000000004' \gset
\if :ok
\echo OK  pseudo insultant refusé
\else
\echo ÉCHEC  pseudo insultant
\endif

-- Blocage : paul bloque l'auteur d'un commentaire et ne le voit plus (les autres si).
select id as lcid from comments where user_id = '00000000-0000-0000-0000-000000000001' and status = 'visible' and article_id = :'aid' limit 1 \gset
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
select public.block_author(:'lcid');
select count(*) filter (where pseudo = 'lecteur') = 0 and count(*) filter (where pseudo = 'paul') = 1 as ok from article_comments(:'aid') \gset
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
select count(*) filter (where pseudo = 'lecteur') = 1 as ok2 from article_comments(:'aid') \gset
reset role;
\if :ok
\if :ok2
\echo OK  un lecteur bloqué disparaît pour celui qui bloque, pas pour les autres
\else
\echo ÉCHEC  blocage visible par tous
\endif
\else
\echo ÉCHEC  blocage
\endif

-- Rôle Modération : modère et bannit, mais ne touche pas aux infos ; un banni ne commente plus.
set request.jwt.claim.sub = '';
update profiles set role = 'moderator', pseudo = 'modo' where id = '00000000-0000-0000-0000-000000000005';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000005';
update articles set title = 'modifié par la modération';
select public.set_banned('00000000-0000-0000-0000-000000000004', true);
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
\set ON_ERROR_STOP off
insert into comments (article_id, user_id, text) values (:'aid', '00000000-0000-0000-0000-000000000004', 'Je reviens');
update profiles set banned = false where id = '00000000-0000-0000-0000-000000000004';
\set ON_ERROR_STOP on
reset role;
select (select count(*) = 0 from articles where title = 'modifié par la modération')
   and (select banned from profiles where id = '00000000-0000-0000-0000-000000000004')
   and (select count(*) = 0 from comments where user_id = '00000000-0000-0000-0000-000000000004' and (status = 'visible' or text = 'Je reviens')) as ok \gset
\if :ok
\echo OK  modération : bannissement sans accès aux infos, le banni ne commente plus et ne se débannit pas
\else
\echo ÉCHEC  rôle Modération ou bannissement
\endif

-- Tableau de bord : un appareil compté une fois par jour, coût de l'IA calculé, réservé à l'équipe.
set role anon;
select public.ping('appareil-test-1'), public.ping('appareil-test-1'), public.ping('appareil-test-2');
reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select (d->>'active_today')::int = 2 and (d->>'ai_30')::numeric >= 0 and jsonb_array_length(d->'last_runs') = 2 and (d->>'banned')::int = 1 as ok from public.dashboard() d \gset
reset role;
select round(public.run_cost('{"model":"claude-opus-5-5","ai":{"input":1000000,"output":100000}}'), 2) = 6.00 as ok2 \gset
\if :ok
\if :ok2
\echo OK  tableau de bord : lecteurs actifs, bannis, derniers passages et coût de l’IA
\else
\echo ÉCHEC  calcul du coût de l’IA
\endif
\else
\echo ÉCHEC  tableau de bord
\endif
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
\set ON_ERROR_STOP off
select public.dashboard() is null as leak \gset
\set ON_ERROR_STOP on
reset role;
\if :{?leak}
\echo ÉCHEC  tableau de bord lisible par un lecteur
\else
\echo OK  tableau de bord refusé aux lecteurs
\endif

-- Lecteurs : liste et suppression réservées aux administrateurs, jamais un administrateur supprimé.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000ad';
select count(*) >= 6 and count(*) filter (where pseudo = 'paul' and banned) = 1 as ok from public.admin_users('') \gset
reset role;
insert into auth.users (id) values ('00000000-0000-0000-0000-000000000009');
set role authenticated;
select public.delete_user('00000000-0000-0000-0000-000000000009');
\set ON_ERROR_STOP off
select public.delete_user('00000000-0000-0000-0000-0000000000ad');
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select count(*) as leak2 from public.admin_users('') \gset
\set ON_ERROR_STOP on
reset role;
select :'ok'::boolean and not exists (select 1 from auth.users where id = '00000000-0000-0000-0000-000000000009')
   and exists (select 1 from auth.users where id = '00000000-0000-0000-0000-0000000000ad') as ok \gset
\if :ok
\if :{?leak2}
\echo ÉCHEC  liste des lecteurs visible par la rédaction
\else
\echo OK  lecteurs : liste et suppression réservées aux admins, admin jamais supprimé
\endif
\else
\echo ÉCHEC  page Lecteurs
\endif

-- Suspensions : 3 commentaires masqués en 30 jours = 7 jours sans commenter ; le suspendu ne se lève pas lui-même.
reset role;
set request.jwt.claim.sub = '';
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000006', 'rec@exemple.fr');
update profiles set pseudo = 'recidiviste' where id = '00000000-0000-0000-0000-000000000006';
insert into comments (article_id, user_id, text) select :'aid', '00000000-0000-0000-0000-000000000006', t from unnest(array['un', 'deux', 'trois']) t;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000005';
update comments set status = 'hidden' where user_id = '00000000-0000-0000-0000-000000000006' and text in ('un', 'deux');
select suspended_until is null as ok1 from profiles where id = '00000000-0000-0000-0000-000000000006' \gset
update comments set status = 'hidden' where user_id = '00000000-0000-0000-0000-000000000006' and text = 'trois';
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000006';
\set ON_ERROR_STOP off
insert into comments (article_id, user_id, text) values (:'aid', '00000000-0000-0000-0000-000000000006', 'Me revoilà');
update profiles set suspended_until = null where id = '00000000-0000-0000-0000-000000000006';
\set ON_ERROR_STOP on
reset role;
select :'ok1'::boolean and suspended_until > now() + interval '6 days' and ban_reason like '3 commentaires%'
   and not exists (select 1 from comments where text = 'Me revoilà')
   and exists (select 1 from audit_log where action like 'Lecteur suspendu%' and detail like 'suspension automatique%') as ok
  from profiles where id = '00000000-0000-0000-0000-000000000006' \gset
\if :ok
\echo OK  suspension automatique au 3e commentaire masqué, le suspendu ne commente plus et ne se lève pas
\else
\echo ÉCHEC  suspension automatique
\endif

-- Suspension manuelle et levée par la modération, refusée sur un membre de l'équipe.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000005';
select public.suspend_user('00000000-0000-0000-0000-000000000006', 0);
select public.suspend_user('00000000-0000-0000-0000-000000000003', 1, 'Hors sujet répété');
\set ON_ERROR_STOP off
select public.suspend_user('00000000-0000-0000-0000-000000000002', 7) as leak \gset
\set ON_ERROR_STOP on
reset role;
select (select suspended_until is null from profiles where id = '00000000-0000-0000-0000-000000000006')
   and (select suspended_until between now() + interval '23 hours' and now() + interval '25 hours' and ban_reason = 'Hors sujet répété' from profiles where id = '00000000-0000-0000-0000-000000000003')
   and exists (select 1 from audit_log where action = 'Suspension levée') as ok \gset
\if :ok
\if :{?leak}
\echo ÉCHEC  équipe suspendue
\else
\echo OK  suspension d’un jour avec motif, levée en un clic, équipe protégée
\endif
\else
\echo ÉCHEC  suspension manuelle
\endif

-- Fiche lecteur, filtres de la liste, export RGPD et pseudo réinitialisé.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000ad';
select count(*) = 1 and bool_and(pseudo = 'marie.l') as ok1 from public.admin_users('', 'suspended') \gset
select count(*) >= 1 and bool_and(role <> 'reader') as ok2 from public.admin_users('', 'team') \gset
select (select jsonb_array_length(d->'comments') = 3 and jsonb_array_length(d->'history') >= 2 from public.admin_user_detail('00000000-0000-0000-0000-000000000006') d)
   and (select e->'compte'->>'email' = 'rec@exemple.fr' and jsonb_array_length(e->'commentaires') = 3 from public.admin_user_export('00000000-0000-0000-0000-000000000006') e)
   and public.reset_pseudo('00000000-0000-0000-0000-000000000006') like 'lecteur%' as ok3 \gset
reset role;
select :'ok1'::boolean and :'ok2'::boolean and :'ok3'::boolean
   and exists (select 1 from audit_log where action = 'Données exportées (RGPD)')
   and exists (select 1 from audit_log where action like 'Pseudo réinitialisé (ancien : recidiviste)') as ok \gset
\if :ok
\echo OK  lecteurs : filtres, fiche détaillée, export RGPD et pseudo réinitialisé tracés
\else
\echo ÉCHEC  fiche ou filtres des lecteurs
\endif
