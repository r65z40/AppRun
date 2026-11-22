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

echo "--- Installation automatique sur une base vide"
psql "$ADMIN" -qc "drop database if exists titre_vide" -c "create database titre_vide"
VIDE=${DB/titre_test/titre_vide}
psql "$VIDE" -v ON_ERROR_STOP=1 -q -f test/supabase-stub.sql
DATABASE_URL="$VIDE" npx tsx src/install.ts
DATABASE_URL="$VIDE" npx tsx src/install.ts
psql "$VIDE" -tAc "select case when count(*) = 9 then 'OK  base vide installée toute seule (8 migrations + sources)' else 'ÉCHEC  installation automatique' end from _titre_migrations"
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
