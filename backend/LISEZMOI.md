# Moteur de contenu TITRE

Chaque matin à 5 h 30, le moteur :
1. lit les flux RSS des médias (titre et chapô seulement, jamais l'article complet) ;
2. demande à l'IA (Claude) de repérer les sujets du jour, de les regrouper et de les classer par rubrique ;
3. fait écrire une carte TITRE par sujet : titre, phrase clé, 3 faits avec leur source, résumé en 3 blocs, photo d'ambiance ;
4. vérifie chaque carte (longueurs, sources, pas de phrase recopiée d'un média) ;
5. enregistre les cartes en **brouillon**. La rédaction les valide dans le back office, puis l'app les affiche.

## À brancher (une fois)

### 1. Supabase (base de données, gratuit pour commencer)
1. Créez un projet sur https://supabase.com (région Europe, Paris ou Francfort).
2. Menu **SQL Editor** : collez et exécutez `supabase/migrations/0001_init.sql`, puis `supabase/seed.sql` (les sources de départ).
3. Notez dans **Project Settings** :
   - *Database > Connection string > Session pooler* : c'est `DATABASE_URL` (secret, pour le moteur) ;
   - *API > Project URL* et clé *anon public* : pour l'app (fichier `app/.env`, voir `app/.env.example`).

### 2. Clé IA
Créez une clé sur https://console.anthropic.com : c'est `ANTHROPIC_API_KEY` (secret).
Coût estimé avec le modèle par défaut (Claude Opus 5.5) : environ 4 centimes par carte, soit 2 € environ par édition de 50 cartes (60 € par mois).

### 3. GitHub (lancement automatique)
Dans le dépôt : **Settings > Secrets and variables > Actions**
- *Secrets* : `DATABASE_URL` et `ANTHROPIC_API_KEY` ;
- *Variables* (facultatif) : `AUTO_PUBLISH` = `1` pour publier sans relecture (déconseillé au début), `TITRE_MODEL` pour changer de modèle.

Le workflow « Édition du jour » tourne tous les matins ; on peut aussi le lancer à la main (onglet **Actions > Édition du jour > Run workflow**).

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
