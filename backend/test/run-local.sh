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

echo "--- Modération autonome : l'IA tranche les signalements restants"
psql "$DB" -qc "insert into reports (comment_id, user_id) select id, '00000000-0000-0000-0000-000000000001' from comments where text = 'c1'" \
  -c "update comments set text = 'Quel idiot' where text = 'c1'"
DATABASE_URL="$DB" MOCK_AI=1 npx tsx src/flash.ts --fixtures test/feeds >/dev/null
psql "$DB" -tAc "select case when not exists (select 1 from reports where not resolved)
  and (select status from comments where text = 'À suivre de près') = 'visible' and (select status from comments where text = 'Quel idiot') = 'hidden'
  and (select count(*) from audit_log where actor is null and detail like 'IA :%') = 2
  then 'OK  signalements tranchés par l''IA (un gardé, un masqué), décisions au journal' else 'ÉCHEC  modération autonome' end"
psql "$DB" -tAc "select case when count(*) filter (where action = 'Lecteur banni') = 1 and count(*) filter (where action = 'Réglage modifié' and detail = 'clé remplacée') >= 1 then 'OK  journal : bannissement et réglages tracés, clés jamais écrites' else 'ÉCHEC  journal' end from audit_log"

echo "--- Installation automatique sur une base vide"
psql "$ADMIN" -qc "drop database if exists titre_vide" -c "create database titre_vide"
VIDE=${DB/titre_test/titre_vide}
psql "$VIDE" -v ON_ERROR_STOP=1 -q -f test/supabase-stub.sql
DATABASE_URL="$VIDE" npx tsx src/install.ts
DATABASE_URL="$VIDE" npx tsx src/install.ts
psql "$VIDE" -tAc "select case when count(*) = 10 then 'OK  base vide installée toute seule (9 migrations + sources)' else 'ÉCHEC  installation automatique' end from _titre_migrations"
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
