# Essayer TITRE en vrai (environ 15 minutes)

À la fin, le moteur lit les médias, écrit les cartes du jour et les infos « Dernière minute ». Vous les relisez dans le back office, et elles s'affichent dans l'app sur votre iPhone.

Il n'y a que **3 étapes**. Tout le reste (les clés Claude et Unsplash, le modèle, la publication automatique) se règle ensuite dans le back office, page **Réglages**.

Pour voir le back office **sans rien installer**, ouvrez-le simplement : sans Supabase, il démarre en mode démo, avec des données fictives.

---

## 1. Supabase : créer la base et noter 3 valeurs (5 min)

1. Sur [supabase.com](https://supabase.com), créez un projet. Choisissez la région **Paris (eu-west-3)**. Pour le mot de passe de la base, utilisez des lettres et des chiffres seulement (`@`, `#` ou `/` cassent l'adresse), et notez-le.
2. Cliquez sur le bouton **Connect**, tout en haut de la page du projet, et notez :
   - onglet **Framework** : la ligne `…SUPABASE_URL=https://xxxx.supabase.co` donne **l'adresse du projet**, et la ligne `…PUBLISHABLE_KEY=sb_publishable_…` donne **la clé publique** ;
   - onglet **Direct (Connection string)** : choisissez la méthode **Session pooler**. Copiez l'adresse, qui ressemble à
     `postgresql://postgres.abcdefgh:[YOUR-PASSWORD]@aws-0-eu-west-3.pooler.supabase.com:5432/postgres`
     et remplacez `[YOUR-PASSWORD]`, **crochets compris**, par le mot de passe de la base.

3. Pour les comptes lecteurs : ouvrez **Authentication > URL Configuration** et, dans **Site URL**, mettez `https://r65z40.github.io/AppRun/`, puis **Save**. C'est là que mène le lien de confirmation envoyé par e-mail à chaque nouveau lecteur.

Vous n'avez **rien à coller dans le SQL Editor** : les tables sont créées automatiquement à l'étape 2.

## 2. GitHub : ranger ces 3 valeurs et mettre en ligne (5 min)

Chaque lien ouvre directement le bon formulaire. Recopiez les noms exactement, en majuscules avec les tirets bas.

**Le secret (privé)** : ouvrez [Nouveau secret](https://github.com/r65z40/AppRun/settings/secrets/actions/new), puis remplissez :

| Name | Secret |
|---|---|
| `DATABASE_URL` | l'adresse `postgresql://…` de l'étape 1, avec votre mot de passe |

Cliquez sur **Add secret**.

**Les 2 variables (publiques)** : ouvrez [Nouvelle variable](https://github.com/r65z40/AppRun/settings/variables/actions/new) et ajoutez-les une par une, avec **Add variable** :

| Name | Value |
|---|---|
| `SUPABASE_URL` | l'adresse du projet (`https://xxxx.supabase.co`) |
| `SUPABASE_ANON_KEY` | la clé publique (`sb_publishable_…`) |

**Pages** : ouvrez [Settings > Pages](https://github.com/r65z40/AppRun/settings/pages). Dans *Source*, choisissez **GitHub Actions**. Si la page propose déjà « Use a suggested workflow », ne cliquez sur rien.

**Lancer l'installation** : ouvrez [Actions > Installer la base](https://github.com/r65z40/AppRun/actions/workflows/install.yml), cliquez sur **Run workflow**, puis sur le bouton vert. En une minute, il crée les tables, les droits d'accès, les rubriques et les 10 sources. Ensuite, ouvrez [Actions > Site en ligne](https://github.com/r65z40/AppRun/actions/workflows/site.yml) et faites de même.

Après environ deux minutes, deux adresses fonctionnent :
- `https://r65z40.github.io/AppRun/` : **l'app**, en version web de test ;
- `https://r65z40.github.io/AppRun/admin/` : **le back office**.

> **Vous aviez déjà une base installée ?** Rien à refaire : l'installation reconnaît ce qui existe et n'ajoute que ce qui manque. Elle se relance aussi seule à chaque mise à jour de la base.

## 3. Back office : votre compte et les réglages (5 min)

1. Ouvrez le back office. La première fois, il affiche **Créer le compte administrateur** : saisissez votre adresse et un mot de passe. Le premier compte créé devient administrateur. Si Supabase vous envoie un e-mail de confirmation, cliquez sur le lien, puis connectez-vous.
2. Ouvrez la page **Réglages** et collez vos clés :
   - **Clé Claude** : sur [console.anthropic.com](https://console.anthropic.com), ouvrez **API Keys > Create Key**, et ajoutez quelques euros de crédit dans **Billing**. Sans cette clé, le moteur ne peut pas écrire les cartes.
   - **Clé Unsplash** (gratuite, facultative) : sur [unsplash.com/developers](https://unsplash.com/developers), créez un compte développeur, puis ouvrez [New Application](https://unsplash.com/oauth/applications/new). Cochez les conditions, donnez un nom (par exemple TITRE), puis copiez l'**Access Key** (pas la *Secret Key*). Pour chaque article, Claude choisit des mots-clés et le moteur prend une vraie photo libre de droits, créditée à son auteur. La clé gratuite permet 50 recherches par heure, assez pour une édition. Pexels ne délivre plus de nouvelles clés.
3. Sur la même page, réglez l'IA comme vous voulez : modèle et niveau de réflexion, **consignes de la rédaction** et **sujets à écarter** (en texte libre), nombre de sujets par rubrique et de cartes au total, importance et nombre de médias minimum, autocorrection, publication automatique, et tous les seuils de la Dernière minute. Un interrupteur **Mettre le moteur en pause** arrête tout en cas de besoin.

Les clés sont rangées dans votre base Supabase et ne sont jamais réaffichées en entier : seuls les 4 derniers caractères apparaissent.

**C'est tout.** Le moteur tourne seul :
- l'édition, chaque matin à 5 h 30 ;
- la Dernière minute, toutes les 10 minutes de 6 h à 23 h.

Avec le pilote automatique, l'IA choisit les sujets, écrit les cartes et publie l'édition sans vous. Une carte qui échoue aux contrôles (trop longue, source manquante, phrase reprise d'un média) est réécrite une fois par l'IA ; si elle reste en défaut, elle attend dans l'onglet **À relire**. Vous supervisez quand vous voulez : la page **Moteur** montre ce que l'IA a lu, retenu et écrit, et chaque carte peut être corrigée, dépubliée ou rejetée dans **Édition**.

Pour un essai tout de suite, cliquez sur **Lancer le moteur** dans le back office (ou [Actions > Édition du jour](https://github.com/r65z40/AppRun/actions/workflows/edition.yml) > Run workflow). Comptez quelques minutes, puis rechargez l'app.

## Les lecteurs et la communauté

Dans l'app, un lecteur crée son compte (adresse, mot de passe, puis pseudo) quand il veut aimer une info ou commenter, ou depuis **Réglages > Compte**. La lecture reste possible sans compte.

Garde-fous automatiques : un pseudo est obligatoire pour commenter, 5 commentaires par minute au plus, et un commentaire signalé par 3 lecteurs est masqué tout seul. La page **Modération** du back office liste les signalements : vous remettez en ligne ou laissez masqué.

---

## L'app sur le téléphone

**Version web, le plus simple pour tester.** Ouvrez `https://r65z40.github.io/AppRun/` dans Safari ou Chrome, puis faites *Partager > Sur l'écran d'accueil*. L'app s'ouvre alors en plein écran, comme une vraie app. Envoyez le lien aux testeurs : ils n'ont rien à installer.

Sur le web, les vibrations, les notifications et l'achat Premium ne fonctionnent pas. Ces fonctions arriveront avec la version iPhone et Android.

**Version native, avec Expo Go.** Sur votre ordinateur, avec Node 22 :

```bash
cd app
cp .env.example .env      # collez l'adresse du projet et la clé publique
npm install
npx expo start
```

Installez **Expo Go** sur l'iPhone et scannez le QR code affiché.

---

### En cas de souci

- **« Installer la base » échoue** : utilisez l'adresse du *Session pooler*, pas *Direct connection*, et vérifiez le mot de passe dans le secret `DATABASE_URL`.
- **Le back office affiche « Mode démo »** : les variables `SUPABASE_URL` et `SUPABASE_ANON_KEY` étaient vides lors de la mise en ligne. Relancez « Site en ligne ».
- **Le moteur s'arrête avec « clé Claude manquante »** : collez la clé dans **Réglages**.
- **Une source est en erreur** : la page Sources affiche l'erreur. Désactivez la source ou remplacez l'adresse du flux.
- **Les anciens secrets `ANTHROPIC_API_KEY`, `UNSPLASH_ACCESS_KEY` et `PEXELS_API_KEY` dans GitHub** marchent toujours, mais la valeur saisie dans Réglages passe en priorité.
