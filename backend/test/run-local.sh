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
psql "$VIDE" -tAc "select case when count(*) = 21 then 'OK  base vide installée toute seule (20 migrations + sources)' else 'ÉCHEC  installation automatique' end from _titre_migrations"
psql "$VIDE" -tAc "select case when count(*) >= 10 then 'OK  sources de départ présentes' else 'ÉCHEC  sources absentes' end from sources"

echo "--- Pilote automatique (réglage par défaut) : l'édition se publie seule"
DATABASE_URL="$VIDE" MOCK_AI=1 npx tsx src/run.ts --fixtures test/feeds >/dev/null
psql "$VIDE" -tAc "select case when (select status from editions limit 1) = 'published' and count(*) filter (where status = 'published') > 0 then 'OK  édition et cartes publiées sans intervention (' || count(*) filter (where status = 'published') || ' cartes)' else 'ÉCHEC  publication autonome' end from articles"

echo "--- Cœur des infos : doublons, sources, ménage"
psql "$VIDE" -tAc "select case when exists (select 1 from articles a where (select count(distinct r.source_id) from raw_items r where r.id = any (a.raw_item_ids)) > 1
  and (select count(distinct r.link) from raw_items r where r.id = any (a.raw_item_ids)) = 1) then 'OK  même article dans plusieurs flux d''un média : une seule dépêche pour l''IA, doublons rangés avec elle' else 'ÉCHEC  doublons' end"
psql "$VIDE" -tAc "select case when count(*) filter (where last_count > 0) >= 4 and count(*) filter (where fail_count = 0) = count(*) then 'OK  sources : titres lus et état notés' else 'ÉCHEC  suivi des sources' end from sources where last_fetch_at is not null"
psql "$VIDE" -qc "update sources set active = false" \
  -c "insert into sources (name, url) values ('Morte', 'http://127.0.0.1:9/rss')"
for i in 1 2; do DATABASE_URL="$VIDE" SOURCE_MAX_FAILS=2 npx tsx -e "import('./src/collect.ts').then((m) => m.collect(undefined, () => {})).then(() => process.exit(0))"; done
psql "$VIDE" -tAc "select case when not active and fail_count = 2 and disabled_reason like 'Mise à l''écart automatique%' then 'OK  source morte mise à l''écart après 2 échecs d''affilée' else 'ÉCHEC  mise à l''écart : ' || active || ' ' || fail_count end from sources where name = 'Morte'"
psql "$VIDE" -qc "delete from sources where name = 'Morte'" -c "update sources set active = true"
psql "$VIDE" -qc "insert into raw_items (source_id, guid, title, link, fetched_at) select id, 'vieux', 'Vieux', 'https://x.test/v', now() - interval '40 days' from sources limit 1"
psql "$VIDE" -tAc "select case when public.purge_raw_items(14) = 1 and (select count(*) from public.source_stats()) = 0 then 'OK  ménage des vieilles dépêches ; statistiques des sources réservées à l''équipe' else 'ÉCHEC  ménage ou statistiques' end"

echo "--- Réglages de la rédaction appliqués par le moteur"
psql "$VIDE" -qc "insert into app_settings (key, value) values ('MAX_CARDS', '3'), ('AUTO_PUBLISH', '0'), ('AI_GUIDELINES', 'Ton sobre')" 
psql "$VIDE" -qc "delete from articles; delete from editions; delete from engine_runs"
DATABASE_URL="$VIDE" MOCK_AI=1 npx tsx src/run.ts --fixtures test/feeds >/dev/null
psql "$VIDE" -tAc "select case when count(*) = 3 and bool_and(status = 'draft') then 'OK  plafond de 3 cartes et pilote coupé respectés' else 'ÉCHEC  réglages ignorés (' || count(*) || ' cartes)' end from articles"
psql "$VIDE" -tAc "select case when details->'config'->>'consignes' = 'Ton sobre' and (details->'config'->>'cartes_max')::int = 3 and jsonb_array_length(details->'dropped') > 0 and stats ? 'ai' then 'OK  journal : réglages utilisés, sujets écartés et consommation de l’IA' else 'ÉCHEC  journal des réglages' end from engine_runs where kind = 'edition'"
psql "$VIDE" -qc "insert into app_settings (key, value) values ('ENGINE_PAUSED', '1')"
DATABASE_URL="$VIDE" MOCK_AI=1 npx tsx src/flash.ts --fixtures test/feeds >/dev/null
psql "$VIDE" -tAc "select case when summary like '%pause%' then 'OK  pause générale respectée par la Dernière minute' else 'ÉCHEC  pause ignorée' end from engine_runs where kind = 'flash' order by started_at desc limit 1"

echo "--- Budget de l'IA"
psql "$VIDE" -qc "delete from app_settings where key = 'ENGINE_PAUSED'" -c "insert into app_settings (key, value) values ('AI_OFF', '1')"
DATABASE_URL="$VIDE" MOCK_AI=1 npx tsx src/run.ts --fixtures test/feeds --date 2030-01-01 >/dev/null
psql "$VIDE" -tAc "select case when summary like 'IA coupée%' and not exists (select 1 from articles where edition_date = '2030-01-01') then 'OK  IA coupée : aucune carte, aucun appel' else 'ÉCHEC  IA coupée : ' || coalesce(summary, '?') end from engine_runs where kind = 'edition' order by started_at desc limit 1"
psql "$VIDE" -qc "delete from app_settings where key = 'AI_OFF'" -c "insert into app_settings (key, value) values ('AI_BUDGET_DAY', '1')" \
  -c "insert into engine_runs (kind, status, stats) values ('flash', 'ok', '{\"model\": \"claude-opus-5-5\", \"ai\": {\"input\": 200000, \"output\": 20000}}')"
DATABASE_URL="$VIDE" MOCK_AI=1 npx tsx src/flash.ts --fixtures test/feeds >/dev/null
psql "$VIDE" -tAc "select case when summary like 'Budget du jour atteint : 1.20 \$ sur 1 \$%' and status = 'ok' then 'OK  budget du jour atteint : arrêt propre, sans ticket de panne' else 'ÉCHEC  budget : ' || coalesce(summary, '?') end from engine_runs where kind = 'flash' order by started_at desc limit 1"
psql "$VIDE" -qc "delete from app_settings where key = 'AI_BUDGET_DAY'" -c "delete from engine_runs where stats->'ai'->>'input' = '200000'"
psql "$VIDE" -tAc "select case when not has_function_privilege('anon', 'public.ai_spend()', 'execute') then 'OK  dépense de l''IA fermée au public' else 'ÉCHEC  ai_spend public' end"

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

echo "--- Personnalisation : identité, textes, notification transmis à l'app"
psql "$VIDE" -tAc "select case when public.app_config() ? 'brand' and public.app_config()->'brand' = 'null'::jsonb then 'OK  sans réglage, l''app garde son identité d''origine' else 'ÉCHEC  identité par défaut' end"
psql "$VIDE" -qc "insert into app_settings (key, value) values ('BRAND', '{\"name\":\"Brief\",\"colors\":{\"violet\":\"#E0457B\"}}'), ('NOTIFICATIONS', 'pas du json')"
psql "$VIDE" -tAc "select case when public.app_config()->'brand'->>'name' = 'Brief' and public.app_config()->'notifications' = 'null'::jsonb then 'OK  identité transmise, réglage abîmé ignoré sans casser l''app' else 'ÉCHEC  app_config personnalisation' end"
psql "$VIDE" -qc "insert into app_settings (key, value) values ('SMTP_PASS_KEY', 'secret-smtp')"
psql "$VIDE" -tAc "select case when public.app_config()::text not like '%secret-smtp%' and (select count(*) from setting_keys where key in ('BRAND','APP_TEXTS','NOTIFICATIONS','SMTP_PASS_KEY','MAIL_CONFIRM_BODY')) = 5 then 'OK  réglages d''e-mails acceptés, mot de passe jamais envoyé à l''app' else 'ÉCHEC  clés de personnalisation' end"
npx tsx test/mail.ts

echo "--- Règles de l'app réglables dans le back office"
psql "$VIDE" -qc "insert into app_settings (key, value) values ('APP_RULES', '{\"default_quota\":16,\"ad_every\":8}'), ('NUDGES', '{\"premium\":{\"enabled\":false}}')"
psql "$VIDE" -tAc "select case when (public.app_config()->'rules'->>'ad_every')::int = 8 and (public.app_config()->'nudges'->'premium'->>'enabled') = 'false' then 'OK  règles de l''app et rappels compte / Premium transmis à l''app' else 'ÉCHEC  règles de l''app' end"
psql "$VIDE" -tAc "select case when public.setting_int('COMMENT_RATE', 5, 1, 60) = 5 and public.setting_int('REPORTS_TO_HIDE', 3, 0, 50) = 3 then 'OK  garde-fous des commentaires : 5 par minute et masquage au 3e signalement par défaut' else 'ÉCHEC  garde-fous par défaut' end"
psql "$VIDE" -qc "insert into app_settings (key, value) values ('COMMENT_RATE', '500'), ('REPORTS_TO_HIDE', 'abc')"
psql "$VIDE" -tAc "select case when public.setting_int('COMMENT_RATE', 5, 1, 60) = 60 and public.setting_int('REPORTS_TO_HIDE', 3, 0, 50) = 3 then 'OK  garde-fous réglés : valeur trop grande bornée, valeur abîmée ignorée' else 'ÉCHEC  garde-fous réglés' end"
