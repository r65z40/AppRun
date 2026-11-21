# Essayer TITRE en vrai (environ 20 minutes)

À la fin, le moteur lit les médias, écrit les cartes du jour et les infos « Dernière minute ». Vous les relisez dans le back office, et elles s'affichent dans l'app sur votre iPhone.

Pour voir le back office **sans rien installer**, ouvrez-le simplement : sans Supabase, il démarre en mode démo, avec des données fictives. Le bouton « Lancer le moteur » y montre une simulation du processus.

---

## 1. La base de données (Supabase, 5 min)

1. Sur [supabase.com](https://supabase.com), créez un projet. Choisissez la région **Paris (eu-west-3)** et notez le mot de passe de la base.
2. Ouvrez **SQL Editor**, puis **New query**. Collez tout le fichier [`backend/supabase/setup.sql`](backend/supabase/setup.sql) et cliquez sur **Run**. Cela crée les tables, les droits d'accès, les rubriques et les 10 sources.
3. Ouvrez **Authentication > Users > Add user** et créez votre compte (adresse et mot de passe).
4. De retour dans le SQL Editor, lancez cette commande avec votre adresse pour devenir administrateur :
   ```sql
   update public.profiles set role = 'admin'
    where id = (select id from auth.users where email = 'vous@exemple.fr');
   ```
5. Notez trois valeurs :
   - **Project Settings > API** : la *Project URL* et la clé *anon public* ;
   - **Connect** (en haut), onglet *Session pooler* : l'adresse `postgresql://…`, avec votre mot de passe à la place de `[YOUR-PASSWORD]`.

## 2. La clé Claude (2 min)

Sur [console.anthropic.com](https://console.anthropic.com), ouvrez **API Keys > Create Key**, puis ajoutez quelques euros de crédit dans **Billing**.

## 3. GitHub (5 min)

Dans le dépôt, ouvrez **Settings > Secrets and variables > Actions**.

- Onglet **Secrets** :
  - `DATABASE_URL` : l'adresse `postgresql://…` de l'étape 1 ;
  - `ANTHROPIC_API_KEY` : la clé de l'étape 2.
- Onglet **Variables** :
  - `SUPABASE_URL` : la Project URL ;
  - `SUPABASE_ANON_KEY` : la clé anon public ;
  - `AUTO_PUBLISH` (facultatif) : `1` pour publier les cartes sans relecture. Laissez cette variable vide pendant les essais.

Ouvrez ensuite **Settings > Pages**. Dans *Source*, choisissez **GitHub Actions**.

## 4. Mettre l'app web et le back office en ligne

Ouvrez **Actions > Site en ligne > Run workflow**. Ensuite, la mise en ligne se refait seule à chaque modification. Après environ deux minutes, deux adresses fonctionnent :
- `https://r65z40.github.io/AppRun/` : **l'app**, en version web de test ;
- `https://r65z40.github.io/AppRun/admin/` : **le back office**. Connectez-vous avec le compte créé à l'étape 1.

## 5. Lancer le moteur

Il y a deux façons de le lancer :
- dans le back office, le bouton **Lancer le moteur** ouvre la bonne page GitHub ;
- ou ouvrez directement **Actions > Édition du jour > Run workflow**.

Comptez quelques minutes. Rechargez ensuite la page Édition : les cartes arrivent en **brouillon**, et celles qui portent une alerte sont dans l'onglet **À relire**.

Le processus suit ces étapes :
1. **Lecture des sources.** Le moteur lit le titre et le chapô de chaque flux RSS, jamais l'article entier.
2. **Choix des sujets.** Claude regroupe les titres qui parlent du même sujet et garde les plus importants de chaque rubrique.
3. **Écriture.** Pour chaque sujet, Claude écrit le titre, la phrase clé, 3 faits sourcés et le résumé « Lire · 1 min ».
4. **Contrôles automatiques.** Le moteur vérifie les longueurs, la présence d'au moins une source par fait et l'absence de copie mot pour mot. Les cartes qui posent un problème sont marquées « À relire ».
5. **Votre relecture.** Vous pouvez modifier, réordonner, publier ou rejeter une carte. Le bouton **Nouvel article** permet d'ajouter un sujet à la main. Pour finir, cliquez sur **Mettre l'édition en ligne**.

Le moteur tourne seul ensuite :
- l'édition, chaque matin à 5 h 30 ;
- la Dernière minute, toutes les 20 minutes de 6 h à 23 h. Vous pouvez aussi la lancer à la main avec **Actions > Dernière minute > Run workflow**.

## 6. L'app sur le téléphone

**Version web, le plus simple pour tester.** Ouvrez `https://r65z40.github.io/AppRun/` dans Safari ou Chrome, puis faites *Partager > Sur l'écran d'accueil*. L'app s'ouvre alors en plein écran, comme une vraie app. Envoyez le lien aux testeurs : ils n'ont rien à installer.

Sur le web, les vibrations, les notifications et l'achat Premium ne fonctionnent pas. Ces fonctions arriveront avec la version iPhone et Android.

**Version native, avec Expo Go.** Sur votre ordinateur, avec Node 22 :

```bash
cd app
cp .env.example .env      # collez la Project URL et la clé anon public
npm install
npx expo start
```

Installez **Expo Go** sur l'iPhone et scannez le QR code affiché. L'app charge l'édition mise en ligne et la Dernière minute.

---

### En cas de souci

- **Le workflow échoue à la connexion à la base** : utilisez l'adresse du *Session pooler*, pas *Direct connection*, et vérifiez le mot de passe.
- **Le back office affiche « Mode démo »** : les variables `SUPABASE_URL` et `SUPABASE_ANON_KEY` étaient vides lors de la mise en ligne. Relancez « Site en ligne ».
- **Une source est en erreur** : la page Sources affiche l'erreur. Désactivez la source ou remplacez l'adresse du flux.
- **Vous voulez lancer le moteur depuis votre ordinateur** : allez dans `backend/`, lancez `npm install`, puis `DATABASE_URL=… ANTHROPIC_API_KEY=… npm run engine`.
