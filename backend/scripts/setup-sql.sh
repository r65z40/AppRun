#!/usr/bin/env bash
# Regroupe les migrations et les sources dans supabase/setup.sql, à coller en une fois dans Supabase.
set -euo pipefail
cd "$(dirname "$0")/.."
{
  echo "-- TITRE : mise en route en une fois (généré par npm run setup-sql, ne pas modifier à la main)."
  echo "-- Supabase > SQL Editor > New query > coller tout ce fichier > Run."
  for f in supabase/migrations/*.sql supabase/seed.sql; do echo; echo "-- ===== $f"; cat "$f"; done
  cat <<'SQL'

-- ===== Dernière étape : devenir administrateur
-- 1. Créez votre compte : Authentication > Users > Add user (adresse + mot de passe).
-- 2. Remplacez l'adresse ci-dessous, sélectionnez ces deux lignes et cliquez sur Run.
-- update public.profiles set role = 'admin'
--  where id = (select id from auth.users where email = 'vous@exemple.fr');
SQL
} > supabase/setup.sql
echo "supabase/setup.sql à jour"
