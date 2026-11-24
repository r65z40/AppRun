#!/usr/bin/env bash
# Lance le moteur sans GitHub Actions (sur un serveur à soi). Même travail que les workflows .github/workflows/*.yml.
# Usage : scripts/cron.sh edition | update | flash | sources
# Les clés sont lues dans backend/.env (voir .env.example). Exemple de crontab : MIGRATION.md à la racine du dépôt.
# Code de sortie différent de 0 si le passage échoue : cron envoie alors un e-mail (ligne MAILTO de la crontab).
set -uo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] && { set -a; . ./.env; set +a; }

job="${1:-}"
# Un seul passage à la fois par file, comme « concurrency » dans GitHub (édition et mise à jour partagent la même).
lock="edition"; [ "$job" = flash ] && lock=flash; [ "$job" = sources ] && lock=sources
exec 9>"/tmp/titre-$lock.lock"
flock -n 9 || { echo "Passage $lock déjà en cours, on laisse faire."; exit 0; }

# Panne passagère (API saturée, média injoignable…) : un nouvel essai 10 minutes plus tard.
twice() { timeout 50m npm run -s "$@" || { sleep 600; timeout 50m npm run -s "$@"; }; }

case "$job" in
  edition) twice engine -- --once ;;
  update)  twice engine -- --update ;;
  flash)
    timeout 10m npm run -s flash || exit 1
    # Modèles d'e-mails : seulement avec Supabase hébergé par Supabase (API de gestion). Auto-hébergé : voir MIGRATION.md.
    if [ -n "${SUPABASE_ACCESS_TOKEN:-}" ]; then timeout 2m npm run -s mail; fi ;;
  sources) timeout 10m npm run -s sources ;;
  *) echo "Usage : $0 edition|update|flash|sources" >&2; exit 2 ;;
esac
