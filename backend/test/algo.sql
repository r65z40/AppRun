-- Algorithme « Mon édition » : une édition de test (demain) avec 24 infos dans 6 rubriques, puis des lecteurs simulés.
\set QUIET on
\set ON_ERROR_STOP on
insert into editions (date, status) values (current_date + 1, 'published') on conflict (date) do update set status = 'published';
insert into articles (edition_date, rubric_id, status, importance, essential, title, key_sentence, facts, summary, published_at)
select current_date + 1, r, 'published', imp, imp >= 9, t, 'Phrase clé.', '[{"text":"Un fait","source":"AFP","url":"https://a.test"}]', '["a","b","c"]', now()
  from (values
    ('france', 10, 'Le gouvernement présente son budget'), ('france', 6, 'Grève à la SNCF ce jeudi'), ('france', 5, 'Réforme du lycée'), ('france', 4, 'Logement : les loyers montent'),
    ('monde', 9, 'Sommet à Bruxelles sur l''Ukraine'), ('monde', 6, 'Élection au Brésil'), ('monde', 5, 'Washington et Pékin discutent'), ('monde', 3, 'Visite au Sahel'),
    ('eco', 7, 'Le CAC 40 recule'), ('eco', 6, 'Le chômage baisse'), ('eco', 5, 'Une start-up rachetée'), ('eco', 4, 'Inflation : la BCE attend'),
    ('tech', 6, 'OpenAI dévoile une IA'), ('tech', 5, 'Intelligence artificielle à l''école'), ('tech', 4, 'Nouvel iPhone'), ('tech', 3, 'Une IA pour les médecins'),
    ('sport', 8, 'Le PSG en Ligue des champions'), ('sport', 5, 'Roland-Garros : le tirage'), ('sport', 4, 'Tour de France 2027'), ('sport', 3, 'Le XV de France'),
    ('culture', 5, 'Festival de Cannes : le jury'), ('culture', 4, 'Prix Goncourt'), ('culture', 3, 'Un concert géant'), ('culture', 2, 'Une série Netflix')
  ) v(r, imp, t);

\echo --- Algorithme « Mon édition »
select case when (select topics from article_topics t join articles a on a.id = t.article_id where a.title = 'OpenAI dévoile une IA') @> '{IA}'
        and (select topics from article_topics t join articles a on a.id = t.article_id where a.title = 'Le PSG en Ligue des champions') @> '{Football}'
  then 'OK  mots-clés repérés dans le texte, sans IA' else 'ÉCHEC  mots-clés' end;

-- Lecteur sans compte, sans historique : 2 sujets majeurs, 5 pour vous, 1 découverte hors de ses rubriques.
create temp table e1 as select * from compose_edition(null, 'appareil-neuf', '{france,monde,eco,tech}', 8);
select case when count(*) filter (where slot = 'ess') = 2 and count(*) filter (where slot = 'pv') = 5 and count(*) filter (where slot = 'dec') = 1
        and count(*) filter (where slot = 'more') = 16
        and (select a.rubric_id from e1 join articles a on a.id = e1.article_id where slot = 'dec') not in ('france', 'monde', 'eco', 'tech')
        and (select slot from e1 where pos = 0) = 'ess' and (select slot from e1 where pos = 1) = 'ess'
  then 'OK  édition de 8 : 2 majeurs en tête, 5 pour vous, 1 découverte hors rubriques, le reste pour « Charger plus »'
  else 'ÉCHEC  composition : ' || (select string_agg(slot || pos, ' ' order by pos) from e1) end from e1;
select case when count(*) filter (where slot = 'ess') = 4 and count(*) filter (where slot = 'dec') = 2 and count(*) filter (where slot = 'pv') = 10
  then 'OK  mêmes proportions pour 16 infos (4 / 10 / 2)' else 'ÉCHEC  proportions à 16' end from compose_edition(null, 'appareil-neuf', '{france,monde,eco,tech}', 16);

-- Il lit beaucoup d'infos sur l'IA (clic vers l'article, résumé lu jusqu'au bout) : l'IA remonte.
select track('appareil-ia-1', (select jsonb_agg(jsonb_build_object('a', id, 'k', k)) from articles, unnest('{click,summary_end,summary}'::text[]) k
                                 where edition_date = current_date + 1 and title in ('Une IA pour les médecins', 'Nouvel iPhone'))) ;
select track('appareil-ia-1', (select jsonb_agg(jsonb_build_object('a', id, 'k', 'view', 'ms', 900)) from articles where edition_date = current_date + 1 and rubric_id = 'france'));
create temp table e2 as select * from compose_edition(null, 'appareil-ia-1', '{france,monde,eco,tech}', 8);
select case when (select a.rubric_id from e2 join articles a on a.id = e2.article_id where pos = 2) = 'tech'
        and (select reason from e2 join articles a on a.id = e2.article_id where a.title = 'OpenAI dévoile une IA') = 'Vous lisez souvent : IA.'
        and (reader_taste(null, 'appareil-ia-1')->'rubrics'->>'france')::numeric < 0
  then 'OK  goûts appris : l''IA passe juste après les sujets majeurs, « Pourquoi : vous lisez souvent : IA », France passée trop vite = points négatifs'
  else 'ÉCHEC  goûts : ' || (select string_agg(a.rubric_id || ':' || e2.slot, ' ' order by pos) from e2 join articles a on a.id = e2.article_id) end;
select case when (select count(*) from e2 join articles a on a.id = e2.article_id where slot <> 'more' and a.rubric_id = 'tech') <= 4
  then 'OK  aucune rubrique ne dépasse la moitié de l''édition' else 'ÉCHEC  plafond par rubrique' end;

-- Les points s'effacent : un signal vieux de 21 jours compte moitié moins.
update reading_events set at = now() - interval '21 days' where device = 'appareil-ia-1';
select case when abs((reader_taste(null, 'appareil-ia-1')->'topics'->>'IA')::numeric * 2 - (3 + 2 + 1.5)) < 0.2
  then 'OK  oubli : demi-vie de 21 jours' else 'ÉCHEC  oubli : ' || (reader_taste(null, 'appareil-ia-1')->'topics')::text end;

-- « Moins de sujets comme ça » : l'info disparaît et ses mots-clés perdent des points.
select track('appareil-ia-1', jsonb_build_array(jsonb_build_object('a', (select id from articles where title = 'OpenAI dévoile une IA' and edition_date = current_date + 1), 'k', 'less')));
select case when not exists (select 1 from compose_edition(null, 'appareil-ia-1', '{tech}', 8) e join articles a on a.id = e.article_id where a.title = 'OpenAI dévoile une IA')
  then 'OK  « Moins de sujets comme ça » retire l''info' else 'ÉCHEC  « Moins de sujets comme ça »' end;

-- Inscription : les signaux de l'appareil passent sur le compte.
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000a1') on conflict do nothing;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select track('appareil-ia-1', '[]');
select case when (reader_taste('00000000-0000-0000-0000-0000000000a1', null)->>'n')::int > 0 then 'OK  inscription : les goûts de l''appareil suivent le compte' else 'ÉCHEC  fusion appareil → compte' end;
-- Remise à zéro par le lecteur.
select reset_taste('appareil-ia-1');
select case when (reader_taste('00000000-0000-0000-0000-0000000000a1', null)->>'n')::int = 0 then 'OK  « Remettre mes goûts à zéro »' else 'ÉCHEC  remise à zéro' end;
reset request.jwt.claim.sub;

-- Sécurité : le journal de lecture est fermé, l'app passe seulement par track et my_edition.
select case when not has_table_privilege('anon', 'reading_events', 'select') and not has_table_privilege('authenticated', 'reading_events', 'select')
        and not has_function_privilege('anon', 'reader_taste(uuid, text)', 'execute') and not has_function_privilege('anon', 'compose_edition(uuid, text, text[], int, boolean)', 'execute')
        and has_function_privilege('anon', 'my_edition(text, text[], int, boolean)', 'execute')
  then 'OK  journal de lecture et profils fermés au public' else 'ÉCHEC  droits' end;
set role anon;
select count(*) as n_anon from my_edition('appareil-neuf', '{france}', 8) \gset
reset role;
select case when :n_anon = 24 then 'OK  l''app obtient son édition sans compte' else 'ÉCHEC  my_edition anonyme' end;

-- Back office : réglages et mots-clés.
insert into app_settings (key, value) values ('ALGO', '{"share_discovery": 0, "signals": {"click": 5}}');
select case when not exists (select 1 from compose_edition(null, 'appareil-neuf', '{france}', 8) where slot = 'dec')
        and (algo_conf()->'signals'->>'click')::int = 5 and (algo_conf()->'signals'->>'like')::int = 2
  then 'OK  réglages du back office appliqués (découverte coupée, poids d''un signal changé, autres poids gardés)' else 'ÉCHEC  réglages ALGO' end;
update app_settings set value = 'pas du json' where key = 'ALGO';
select case when (algo_conf()->>'w_importance')::int = 45 then 'OK  réglage abîmé ignoré' else 'ÉCHEC  réglage abîmé' end;
delete from app_settings where key = 'ALGO';
-- Sujet sensible : très ouvert par les lecteurs, mais jamais poussé pour ça.
insert into app_settings (key, value) values ('ALGO', '{"min_views": 1}');
select track('lecteur-' || n, (select jsonb_agg(jsonb_build_object('a', id, 'k', k, 'ms', 5000)) from articles, unnest('{view,summary,share}'::text[]) k
                                 where edition_date = current_date + 1 and title = 'Grève à la SNCF ce jeudi'))
  from generate_series(1, 3) n;
select track('lecteur-' || n, (select jsonb_agg(jsonb_build_object('a', id, 'k', 'view', 'ms', 5000)) from articles
                                 where edition_date = current_date + 1 and title = 'Réforme du lycée'))
  from generate_series(1, 3) n;
select score as s_avant from compose_edition(null, 'appareil-neuf', '{france}', 8) e join articles a on a.id = e.article_id where a.title = 'Grève à la SNCF ce jeudi' \gset
update articles set sensitive = true where title = 'Grève à la SNCF ce jeudi';
select score as s_apres from compose_edition(null, 'appareil-neuf', '{france}', 8) e join articles a on a.id = e.article_id where a.title = 'Grève à la SNCF ce jeudi' \gset
select case when :s_apres < :s_avant then 'OK  sujet sensible : pas de bonus parce qu''il attire les clics (score ' || :s_avant || ' → ' || :s_apres || ')' else 'ÉCHEC  sujet sensible boosté' end;
delete from app_settings where key = 'ALGO';
insert into algo_keywords (label, words) values ('Lycée', '{lycée,lycéens}');
select case when (select topics from article_topics t join articles a on a.id = t.article_id where a.title = 'Réforme du lycée') @> '{Lycée}'
  then 'OK  nouveau mot-clé : infos récentes réétiquetées aussitôt' else 'ÉCHEC  réétiquetage' end;
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a1';
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select case when algo_stats() ? 'events_7' and jsonb_array_length(algo_stats()->'topics') > 0
        and jsonb_array_length(admin_reader_algo('00000000-0000-0000-0000-0000000000a1')->'edition') > 0
  then 'OK  back office : statistiques et aperçu de l''édition d''un lecteur' else 'ÉCHEC  statistiques' end;
reset request.jwt.claim.sub;
-- Nettoyage : l'édition de test ne doit pas gêner la suite.
delete from editions where date = current_date + 1;
