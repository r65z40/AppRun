# Moteur de contenu TITRE

Chaque matin à 5 h 30, le moteur :
1. lit les flux RSS des médias (titre et chapô seulement, jamais l'article complet) ;
2. demande à l'IA (Claude) de repérer les sujets du jour, de les regrouper et de les classer par rubrique ;
3. fait écrire une carte TITRE par sujet : titre, phrase clé, 3 faits avec leur source, résumé en 3 blocs, photo d'ambiance ;
4. vérifie chaque carte (longueurs, sources, pas de phrase recopiée d'un média) ;
5. enregistre les cartes en **brouillon**. La rédaction les valide dans le back office, puis l'app les affiche.

## Dernière minute
Toutes les 20 minutes de 6 h à 23 h (workflow « Dernière minute »), le moteur relit les deux dernières heures de dépêches.
L'IA ne retient que les faits majeurs, nouveaux et annoncés par au moins deux médias. Le code vérifie ensuite ces règles avant de publier
(table `flashes`). La rédaction peut retirer, corriger ou ajouter une info depuis le back office.
`FLASH_AUTO_PUBLISH=0` (variable GitHub) : les infos arrivent masquées et attendent la validation.
Coût estimé : environ 1 € par jour.

## À brancher (une fois)
Le guide pas à pas est dans [`ESSAYER.md`](../ESSAYER.md). En résumé :
1. **Supabase** : créez un projet (région Paris) et notez l'adresse *Session pooler* (`DATABASE_URL`), l'adresse du projet et la clé publique.
2. **GitHub** : secret `DATABASE_URL`, variables `SUPABASE_URL` et `SUPABASE_ANON_KEY`, puis **Actions > Installer la base**.
   Les tables sont créées automatiquement (`npm run install-db`, table `_titre_migrations`), y compris sur une base déjà installée à la main.
   Le moteur et la Dernière minute appliquent aussi les migrations manquantes à chaque lancement.
3. **Back office > Réglages** : clé Claude, clé Pexels, modèle, `AUTO_PUBLISH`, `FLASH_AUTO_PUBLISH`, `FLASH_ENABLED`, `PER_RUBRIC`.
   Ces réglages sont rangés dans la table `app_settings` (lisible seulement par les fonctions `admin_settings` et `set_setting`) et passent avant les secrets et variables GitHub.

Coût estimé avec le modèle par défaut (Claude Opus 5.5) : environ 4 centimes par carte, soit 2 € environ par édition de 50 cartes.

## En local
```bash
cd backend
npm install
cp .env.example .env   # puis remplir
npm run engine                      # édition du jour
npm run engine -- --date 2026-11-22 # une autre date
npm test                            # test complet sans IA sur des flux d'exemple (Postgres local requis)
```

## Ce qui reste ouvert
- **Droits des médias** : on n'utilise que les titres et chapôs diffusés publiquement en RSS, on réécrit avec nos mots et on renvoie vers l'article. C'est l'usage courant des agrégateurs, mais certains médias l'interdisent dans leurs conditions : à vérifier source par source avant le lancement public (voir `supabase/seed.sql`).
- Les adresses des flux de départ sont à confirmer : le moteur note l'erreur de chaque source dans la table `sources` et continue avec les autres.
