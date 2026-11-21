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
psql "$VIDE" -tAc "select case when count(*) = 7 then 'OK  base vide installée toute seule (6 migrations + sources)' else 'ÉCHEC  installation automatique' end from _titre_migrations"
psql "$VIDE" -tAc "select case when count(*) >= 10 then 'OK  sources de départ présentes' else 'ÉCHEC  sources absentes' end from sources"

echo "--- Pilote automatique (réglage par défaut) : l'édition se publie seule"
DATABASE_URL="$VIDE" MOCK_AI=1 npx tsx src/run.ts --fixtures test/feeds >/dev/null
psql "$VIDE" -tAc "select case when (select status from editions limit 1) = 'published' and count(*) filter (where status = 'published') > 0 then 'OK  édition et cartes publiées sans intervention (' || count(*) filter (where status = 'published') || ' cartes)' else 'ÉCHEC  publication autonome' end from articles"
