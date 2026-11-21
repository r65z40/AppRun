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
DATABASE_URL="$DB" MOCK_AI=1 npx tsx src/run.ts --fixtures test/feeds
DATABASE_URL="$DB" MOCK_AI=1 npx tsx src/flash.ts --fixtures test/feeds
DATABASE_URL="$DB" MOCK_AI=1 npx tsx src/flash.ts --fixtures test/feeds
echo "--- Vérifications"
psql "$DB" -v ON_ERROR_STOP=1 -q -f test/checks.sql
