#!/usr/bin/env bash
# Test complet en local : base Postgres neuve, schéma, sources, moteur en mode test (sans IA) sur des flux d'exemple.
set -euo pipefail
cd "$(dirname "$0")/.."
# setup.sql doit être à jour avec les migrations (sinon : npm run setup-sql).
cp supabase/setup.sql /tmp/titre-setup.sql && bash scripts/setup-sql.sh >/dev/null && cmp -s supabase/setup.sql /tmp/titre-setup.sql || { echo "supabase/setup.sql n’est pas à jour : lancez npm run setup-sql"; exit 1; }
DB=${TEST_DB:-postgresql://postgres@/titre_test?host=/var/tmp&port=54329}
ADMIN=${DB/titre_test/postgres}
psql "$ADMIN" -qc "drop database if exists titre_test" -c "create database titre_test"
psql "$DB" -v ON_ERROR_STOP=1 -q -f test/supabase-stub.sql -f supabase/setup.sql
DATABASE_URL="$DB" MOCK_AI=1 AUTO_PUBLISH=0 npx tsx src/run.ts --fixtures test/feeds
DATABASE_URL="$DB" MOCK_AI=1 npx tsx src/flash.ts --fixtures test/feeds
DATABASE_URL="$DB" MOCK_AI=1 npx tsx src/flash.ts --fixtures test/feeds
echo "--- Vérifications"
psql "$DB" -v ON_ERROR_STOP=1 -q -f test/checks.sql
echo "--- Premium et abonnements"
psql "$DB" -v ON_ERROR_STOP=1 -q -f test/premium.sql | grep -E "^(OK|ÉCHEC|f$)" | sed "s/^f$/ÉCHEC  vérification intermédiaire de test\/premium.sql/"

echo "--- Modération autonome : l'IA tranche les signalements restants"
psql "$DB" -qc "insert into reports (comment_id, user_id) select id, '00000000-0000-0000-0000-000000000001' from comments where text = 'c1'" \
  -c "update comments set text = 'Quel idiot' where text = 'c1'"
DATABASE_URL="$DB" MOCK_AI=1 npx tsx src/flash.ts --fixtures test/feeds >/dev/null
psql "$DB" -tAc "select case when not exists (select 1 from reports where not resolved)
  and (select status from comments where text = 'À suivre de près') = 'visible' and (select status from comments where text = 'Quel idiot') = 'hidden'
  and (select count(*) from audit_log where actor is null and detail like 'IA :%') = 2
  then 'OK  signalements tranchés par l''IA (un gardé, un masqué), décisions au journal' else 'ÉCHEC  modération autonome' end"
psql "$DB" -tAc "select case when (details->'moderation_ai') ? 'input' and jsonb_array_length(details->'moderation') = 2 then 'OK  jetons de la modération comptés à part' else 'ÉCHEC  jetons de la modération' end from engine_runs where kind = 'flash' order by started_at desc limit 1"
psql "$DB" -tAc "select case when count(*) filter (where action = 'Lecteur banni') = 1 and count(*) filter (where action = 'Réglage modifié' and detail = 'clé remplacée') >= 1 then 'OK  journal : bannissement et réglages tracés, clés jamais écrites' else 'ÉCHEC  journal' end from audit_log"

echo "--- Installation automatique sur une base vide"
psql "$ADMIN" -qc "drop database if exists titre_vide" -c "create database titre_vide"
VIDE=${DB/titre_test/titre_vide}
psql "$VIDE" -v ON_ERROR_STOP=1 -q -f test/supabase-stub.sql
DATABASE_URL="$VIDE" npx tsx src/install.ts
DATABASE_URL="$VIDE" npx tsx src/install.ts
psql "$VIDE" -tAc "select case when count(*) = 17 then 'OK  base vide installée toute seule (16 migrations + sources)' else 'ÉCHEC  installation automatique' end from _titre_migrations"
psql "$VIDE" -tAc "select case when count(*) >= 10 then 'OK  sources de départ présentes' else 'ÉCHEC  sources absentes' end from sources"

echo "--- Pilote automatique (réglage par défaut) : l'édition se publie seule"
DATABASE_URL="$VIDE" MOCK_AI=1 npx tsx src/run.ts --fixtures test/feeds >/dev/null
psql "$VIDE" -tAc "select case when (select status from editions limit 1) = 'published' and count(*) filter (where status = 'published') > 0 then 'OK  édition et cartes publiées sans intervention (' || count(*) filter (where status = 'published') || ' cartes)' else 'ÉCHEC  publication autonome' end from articles"

echo "--- Réglages de la rédaction appliqués par le moteur"
psql "$VIDE" -qc "insert into app_settings (key, value) values ('MAX_CARDS', '3'), ('AUTO_PUBLISH', '0'), ('AI_GUIDELINES', 'Ton sobre')" 
psql "$VIDE" -qc "delete from articles; delete from editions; delete from engine_runs"
DATABASE_URL="$VIDE" MOCK_AI=1 npx tsx src/run.ts --fixtures test/feeds >/dev/null
psql "$VIDE" -tAc "select case when count(*) = 3 and bool_and(status = 'draft') then 'OK  plafond de 3 cartes et pilote coupé respectés' else 'ÉCHEC  réglages ignorés (' || count(*) || ' cartes)' end from articles"
psql "$VIDE" -tAc "select case when details->'config'->>'consignes' = 'Ton sobre' and (details->'config'->>'cartes_max')::int = 3 and jsonb_array_length(details->'dropped') > 0 and stats ? 'ai' then 'OK  journal : réglages utilisés, sujets écartés et consommation de l’IA' else 'ÉCHEC  journal des réglages' end from engine_runs where kind = 'edition'"
psql "$VIDE" -qc "insert into app_settings (key, value) values ('ENGINE_PAUSED', '1')"
DATABASE_URL="$VIDE" MOCK_AI=1 npx tsx src/flash.ts --fixtures test/feeds >/dev/null
psql "$VIDE" -tAc "select case when summary like '%pause%' then 'OK  pause générale respectée par la Dernière minute' else 'ÉCHEC  pause ignorée' end from engine_runs where kind = 'flash' order by started_at desc limit 1"

echo "--- Rattrapages automatiques : une seule édition par jour"
psql "$VIDE" -qc "delete from app_settings where key = 'ENGINE_PAUSED'"
DATABASE_URL="$VIDE" MOCK_AI=1 npx tsx src/run.ts --fixtures test/feeds --once >/dev/null
psql "$VIDE" -tAc "select case when summary = 'Édition du jour déjà faite.' then 'OK  rattrapage ignoré quand l’édition du jour existe' else 'ÉCHEC  rattrapage : ' || coalesce(summary, '?') end from engine_runs where kind = 'edition' order by started_at desc limit 1"

echo "--- Mises à jour au fil de la journée"
# Le plafond de 3 cartes ci-dessus a laissé des dépêches de côté : la mise à jour n'en prend que les importantes (1 carte au plus, un quart du plafond).
DATABASE_URL="$VIDE" MOCK_AI=1 npx tsx src/run.ts --fixtures test/feeds --update >/dev/null
psql "$VIDE" -tAc "select case when (select summary from engine_runs where kind = 'edition' order by started_at desc limit 1) like 'Mise à jour : %' and count(*) = 4
  and not exists (select r from articles, unnest(raw_item_ids) r group by r having count(*) > 1)
  then 'OK  mise à jour : une carte importante ajoutée, aucun sujet repris' else 'ÉCHEC  mise à jour (' || count(*) || ' cartes)' end from articles"
psql "$VIDE" -qc "insert into app_settings (key, value) values ('LIVE_MIN_IMPORTANCE', '10')"
DATABASE_URL="$VIDE" MOCK_AI=1 npx tsx src/run.ts --fixtures test/feeds --update >/dev/null
psql "$VIDE" -tAc "select case when count(*) = 4 then 'OK  seuil d''importance des mises à jour respecté' else 'ÉCHEC  seuil ignoré (' || count(*) || ' cartes)' end from articles"
psql "$VIDE" -qc "insert into app_settings (key, value) values ('LIVE_UPDATES', '0')"
DATABASE_URL="$VIDE" MOCK_AI=1 npx tsx src/run.ts --fixtures test/feeds --update >/dev/null
psql "$VIDE" -tAc "select case when summary like '%coupées%' then 'OK  mises à jour coupées dans les réglages' else 'ÉCHEC  réglage LIVE_UPDATES ignoré' end from engine_runs where kind = 'edition' order by started_at desc limit 1"

echo "--- App lecteur : rubriques, emoji, messages, badge Premium"
psql "$VIDE" -tAc "select case when count(*) >= 10 and bool_or(id = 'ecologie') and bool_or(id = 'people') then 'OK  ' || count(*) || ' rubriques, dont Écologie et People' else 'ÉCHEC  rubriques' end from rubrics"
psql "$VIDE" -tAc "select case when public.app_config()->>'comments_mode' = 'comments' then 'OK  commentaires ouverts par défaut' else 'ÉCHEC  app_config' end"
psql "$VIDE" -qc "insert into app_settings (key, value) values ('COMMENTS_MODE', 'emoji')"
psql "$VIDE" -tAc "select case when public.app_config()->>'comments_mode' = 'emoji' then 'OK  mode emoji transmis à l''app' else 'ÉCHEC  mode emoji' end"
psql "$VIDE" -tAc "select case when exists (select 1 from information_schema.routines r join information_schema.parameters p on p.specific_name = r.specific_name where r.routine_name = 'article_comments' and p.parameter_name = 'premium') then 'OK  badge Premium renvoyé avec les commentaires' else 'ÉCHEC  badge Premium' end"
psql "$VIDE" -qc "insert into app_messages (title, audience) values ('Bienvenue', 'premium'), ('Ancien', 'all')" -c "update app_messages set active = false where title = 'Ancien'"
psql "$VIDE" -qtAc "set role anon; select case when count(*) = 1 then 'OK  messages d''accueil : seuls les actifs sont publics' else 'ÉCHEC  messages d''accueil' end from app_messages"

echo "--- Régie publicitaire"
psql "$VIDE" -qc "insert into ad_campaigns (name, advertiser, title, url, price) values ('A', 'Lumen', 'Pub A', 'https://a.test', 8), ('B', 'Rayon', 'Pub B', 'https://b.test', 8)" \
  -c "insert into ad_campaigns (name, advertiser, title, url, ends_on, starts_on) values ('Finie', 'Vieux', 'Pub C', 'https://c.test', current_date - 1, current_date - 5)"
psql "$VIDE" -qtAc "set role anon; select case when (select count(*) from public.live_ads()) = 2 then 'OK  pubs : seules les campagnes en cours partent dans l''app' else 'ÉCHEC  live_ads' end"
psql "$VIDE" -tAc "select case when not has_table_privilege('anon', 'ad_campaigns', 'select') and not has_table_privilege('anon', 'ad_stats', 'select') then 'OK  pubs : prix et statistiques fermés au public' else 'ÉCHEC  campagnes visibles' end"
psql "$VIDE" -qc "insert into ad_campaigns (name, advertiser, title, url, exclusive, pricing, price) values ('Sponsor', 'Horizon', 'Pub S', 'https://s.test', true, 'flat', 1500)"
psql "$VIDE" -qtAc "set role anon; select case when (select string_agg(advertiser, ',') from public.live_ads()) = 'Horizon' then 'OK  sponsor exclusif : seul annonceur visible' else 'ÉCHEC  sponsor exclusif' end"
psql "$VIDE" -qtAc "set role anon; select public.ad_hit((select id from public.live_ads() limit 1)); select public.ad_hit((select id from public.live_ads() limit 1), true);" >/dev/null
psql "$VIDE" -qc "update ad_campaigns set max_views = 1 where name = 'Sponsor'"
psql "$VIDE" -tAc "select case when (select views || '/' || clicks from ad_stats) = '1/1' and (select count(*) from public.live_ads()) = 2 then 'OK  affichages et clics comptés, plafond atteint : les autres campagnes reprennent' else 'ÉCHEC  comptage ou plafond' end"

psql "$VIDE" -v ON_ERROR_STOP=1 -qtA -f test/algo.sql | grep -v '^$'
