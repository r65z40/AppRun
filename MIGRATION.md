# Passer sur un serveur à soi (plus tard)

But : dépendre le moins possible de services extérieurs et payer moins, sans rien changer pour les lecteurs.
Rien n'est à faire aujourd'hui. Ce guide dit ce qui est prêt, ce qu'il faudra faire le jour venu, et ce qui restera lié.

## Ce qui est déjà prêt

- **Aucune adresse de service n'est écrite en dur dans l'app ni dans le back office.** L'adresse de la base et sa clé publique passent par des variables (`EXPO_PUBLIC_SUPABASE_URL`, `VITE_SUPABASE_URL`, etc., voir les fichiers `.env.example` de `app/`, `admin/` et `backend/`). Changer d'hébergeur = changer ces valeurs et refaire les builds.
- **Le moteur ne dépend pas de GitHub.** Il lui faut seulement l'adresse de la base (`DATABASE_URL`) ; les clés (Claude, Unsplash…) sont lues dans la base, réglées dans le back office.
- **Script pour le lancer sans GitHub Actions** : `backend/scripts/cron.sh edition|update|flash|sources`. Il fait la même chose que les workflows : rattrapage 10 minutes plus tard en cas de panne, un seul passage à la fois, limite de durée.

## Le serveur visé

Un seul serveur loué (VPS) chez **Hetzner** ou **OVH**, avec : la base Supabase auto-hébergée, le moteur (lancé par `cron`), l'app web et le back office (fichiers statiques).
Taille conseillée : 4 cœurs, 8 Go de mémoire, 80 Go de disque (Supabase auto-hébergé demande au moins 4 Go).

## Étapes, le jour venu

1. **Louer le serveur et un nom de domaine**, par exemple `titre.fr` avec `api.titre.fr` (la base), `app.titre.fr` (app web) et `admin.titre.fr` (back office).
2. **Installer Supabase auto-hébergé** avec Docker en suivant le guide officiel : https://supabase.com/docs/guides/self-hosting/docker. Il contient tout ce que l'app utilise : base, comptes, stockage des photos, fonctions (pg_cron, pg_net).
3. **Déménager les données** : copier la base actuelle (comptes compris) avec `pg_dump` puis `pg_restore`, et les photos du stockage « photos ». Guide : https://supabase.com/docs/guides/self-hosting (rubrique migration).
4. **Copier la fonction RevenueCat** (`backend/supabase/functions/revenuecat`) dans le dossier `volumes/functions` de Supabase, avec ses secrets `REVENUECAT_WEBHOOK_SECRET` et la nouvelle adresse dans RevenueCat.
5. **E-mails des comptes** (confirmation, mot de passe oublié) : sur Supabase auto-hébergé, l'expéditeur (SMTP) et les modèles se règlent dans le fichier `.env` de Supabase, pas par le back office. Le script `cron.sh` saute alors cette synchronisation tout seul.
6. **Installer le moteur** :
   ```bash
   git clone https://github.com/r65z40/AppRun /opt/titre && cd /opt/titre/backend
   npm ci && cp .env.example .env   # puis mettre DATABASE_URL du nouveau serveur
   sudo timedatectl set-timezone Europe/Paris   # les heures ci-dessous sont celles de Paris, été comme hiver
   crontab -e                                   # coller le bloc ci-dessous
   ```
   ```cron
   MAILTO=votre@adresse.fr
   45 4 * * *      /opt/titre/backend/scripts/cron.sh sources
   30 5,6 * * *    /opt/titre/backend/scripts/cron.sh edition
   45 9-22 * * *   /opt/titre/backend/scripts/cron.sh update
   */20 6-23 * * * /opt/titre/backend/scripts/cron.sh flash
   ```
   Le passage de 6 h 30 est un rattrapage : il s'arrête seul si l'édition est déjà faite. Si un passage échoue, `cron` envoie un e-mail (il remplace le ticket GitHub).
7. **Mettre l'app web et le back office en ligne** : sur son ordinateur, `npx expo export --platform web` dans `app/` et `npm run build` dans `admin/` (avec les nouvelles adresses), puis copier les dossiers sur le serveur, servis par Caddy (HTTPS automatique et gratuit).
8. **Faire les builds de l'app sur son ordinateur** : `eas build --local` (gratuit, demande un Mac pour iPhone). Mettre la nouvelle adresse de la base dans `EXPO_PUBLIC_SUPABASE_URL`.
9. **Arrêter l'ancien** : vider `GITHUB_DISPATCH_KEY` dans le back office (IA > Clés), désactiver les workflows Édition, Dernière minute et Vérifier les sources sur GitHub.

**Point d'attention :** l'adresse de la base est gravée dans l'app installée sur les téléphones. Il faut publier la nouvelle version sur les stores **avant** de basculer, et garder l'ancien Supabase allumé quelques semaines, le temps que la plupart des lecteurs fassent la mise à jour.

## Ce qui ne marchera plus pareil

- **Le bouton « Lancer le moteur » du back office** passe aujourd'hui par GitHub. Sur le serveur, il faudra soit lancer `cron.sh` à la main en SSH, soit l'adapter (petit chantier à prévoir au moment de la migration).
- **Les tickets GitHub automatiques en cas de panne** sont remplacés par l'e-mail de `cron`. Le journal des passages dans le back office ne change pas.

## Coûts estimés par mois (ordre de grandeur, prix à vérifier le jour venu)

| Poste | Aujourd'hui | Sur serveur à soi |
|---|---|---|
| Base (Supabase) | 0 € (gratuit) à ~25 $ (offre Pro, dès qu'il y a du monde) | inclus dans le serveur |
| Serveur (Hetzner/OVH, 8 Go) | — | ~8 à 15 € |
| Sauvegardes du serveur | incluses chez Supabase Pro | ~2 à 3 € (option de l'hébergeur) |
| Nom de domaine | — | ~1 € (10 à 15 € par an) |
| Moteur (GitHub Actions) | 0 € si dépôt public ; peut devenir payant en privé (passages toutes les 20 min) | inclus |
| Site (GitHub Pages) | 0 € | inclus |
| Builds (EAS) | 0 € (offre gratuite, file d'attente) | 0 € (builds sur son ordinateur) |
| Claude (IA) | selon l'usage (~2 € par édition + ~1 € par jour de Dernière minute) | **inchangé** |
| Apple / Google | 99 $ par an / 25 $ une fois | **inchangé** |
| RevenueCat | 0 € jusqu'à ~2 500 $ de revenus mensuels, puis ~1 % | **inchangé** |

Le gain principal n'est pas tant l'argent au départ que le prix **fixe** : le serveur coûte pareil avec 100 ou 50 000 lecteurs, là où Supabase et GitHub facturent à l'usage. Contrepartie : les mises à jour de sécurité et les sauvegardes deviennent votre affaire (ou celle d'un prestataire).

## Ce qui restera lié (et pourquoi)

- **Apple et Google** : obligatoires pour être sur les stores et encaisser dans l'app.
- **Claude** : c'est lui qui écrit. Le budget se règle dans le back office (IA > Pilotage).
- **Notifications** : passent par le service gratuit d'Expo, lui-même relié à Apple et Google. Remplaçable plus tard par un envoi direct, sans intérêt tant que c'est gratuit.
- **Photos Unsplash** : gratuit. Remplaçable par sa propre banque de photos.
- **RevenueCat** : gratuit sous le seuil. Remplaçable plus tard par une vérification maison des achats, mais c'est un gros travail pour peu de gain.
- **GitHub** : garde le code. Pas indispensable au fonctionnement une fois le serveur en place.
