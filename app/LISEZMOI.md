# TITRE : essayer l'app sur iPhone

Prototype 0.1 (Expo SDK 58). Contenu fictif, aucune donnée envoyée nulle part.

## Ce qu'il faut
- Un ordinateur (Mac ou PC) avec **Node.js 20 ou plus** : https://nodejs.org (version « LTS »).
- Sur l'iPhone : l'app gratuite **Expo Go** (App Store).
- L'ordinateur et l'iPhone sur le **même Wi-Fi**.

## Lancer (5 minutes la première fois)
1. Ouvrez un terminal dans le dossier `app` du projet
   (Mac : clic droit sur le dossier `app` > Services > Nouveau terminal au dossier).
2. Tapez `npm install` puis Entrée (1 à 3 minutes, une seule fois).
3. Tapez `npx expo start` puis Entrée. Un QR code s'affiche.
4. Sur l'iPhone, ouvrez l'appareil photo et visez le QR code, puis touchez « Ouvrir dans Expo Go ».

Si le QR code ne marche pas (Wi-Fi d'entreprise, partage de connexion…), relancez avec
`npx expo start --tunnel`.

## À essayer
- Première ouverture : rubriques, quota 8/16/32, notification, pubs.
- Glisser vers le haut : info suivante. Glisser à droite/gauche : rubrique suivante.
- Toucher un des trois faits : sa source apparaît.
- Incliner le téléphone : la photo de fond bouge (désactivable dans les réglages).
- « Lire · 1 min » : le résumé en 3 blocs. Bulle : les commentaires (70 caractères).
- Au bout du quota : Bravo, temps gagné, série de jours, puis « C'est tout pour aujourd'hui. À demain. »
- Roue crantée : réglages (rubriques, quota, sons, vibrations, Premium sans pub).

Les sons sont coupés quand l'iPhone est en mode silencieux.

## Le widget « Titre du jour » (écran d'accueil)
Le widget affiche l'info principale du jour (jamais un sujet sensible) et se met à jour
chaque fois que l'app est ouverte. **Il ne marche pas dans Expo Go** : il faut une vraie
version de l'app, fabriquée par Expo (service EAS, gratuit pour quelques versions par mois).

Le plus simple : sur GitHub, Actions > « App native à essayer » > Run workflow (android ou iphone).
Ce qu'il faut créer avant est écrit en haut de `.github/workflows/app-native.yml`.
À la main sinon :

1. Créez un compte gratuit sur https://expo.dev.
2. Dans le dossier `app`, tapez `npx eas-cli login`, puis
   `npx eas-cli build --profile preview --platform android` (ou `--platform ios`).
   Pour le vrai contenu, ajoutez d'abord `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   dans expo.dev > votre projet > Environment variables (environnement « preview »).
3. Au bout de 15 à 30 minutes, Expo donne un lien : ouvrez-le sur le téléphone pour installer l'app.
   - Android : rien d'autre à prévoir.
   - iPhone : il faut un compte Apple Developer (99 €/an) ; la commande demande vos identifiants
     Apple et enregistre l'iPhone.
4. Ouvrez l'app une fois, puis appui long sur l'écran d'accueil > Widgets > TITRE.

## La vraie app sur iPhone sans payer (7 jours)
Il faut un **Mac** et un câble. Pas de widget ni d'alertes push dans cette version.

1. Sur le Mac : installez **Xcode** (App Store du Mac, gratuit, long à télécharger) et **Node.js LTS** (https://nodejs.org).
2. Ouvrez Xcode une fois. Dans Xcode > Réglages > Comptes : « + » > Apple ID, connectez-vous avec votre identifiant Apple habituel.
   Puis « Manage Certificates… » > « + » > « Apple Development ».
3. Téléchargez le code : sur GitHub, bouton vert « Code » > « Download ZIP », puis double-cliquez le fichier pour le décompresser.
4. Pour le vrai contenu : dans le dossier `app`, créez un fichier texte nommé `.env` avec ces deux lignes
   (valeurs dans GitHub > Settings > Secrets and variables > Actions > onglet Variables) :
   `EXPO_PUBLIC_SUPABASE_URL=...` et `EXPO_PUBLIC_SUPABASE_ANON_KEY=...`
5. Branchez l'iPhone au Mac, déverrouillez-le et touchez « Se fier à cet ordinateur ».
   Sur l'iPhone : Réglages > Confidentialité et sécurité > Mode développeur > activer (l'iPhone redémarre).
6. Ouvrez un terminal dans le dossier `app` (clic droit > Services > Nouveau terminal au dossier) et tapez :
   `npm install` puis `npm run iphone-gratuit`. Choisissez votre iPhone et votre compte si on vous le demande (10 à 20 minutes la première fois).
7. Si l'iPhone refuse d'ouvrir l'app : Réglages > Général > VPN et gestion de l'appareil > votre identifiant > « Faire confiance ».

Au bout de 7 jours, l'app ne s'ouvre plus : rebranchez l'iPhone et relancez `npm run iphone-gratuit`.

## La vraie app sur iPhone sans payer et sans Mac (7 jours)
GitHub fabrique l'app, Sideloadly (gratuit, PC Windows ou Mac) l'installe par câble avec votre identifiant Apple.

1. GitHub > Actions > « App native à essayer » > Run workflow > **iphone-gratuit**. Attendre la coche verte (20 à 40 minutes).
2. Ouvrir ce passage, en bas « Artifacts » > **TITRE-iphone** : télécharger et décompresser, on obtient `TITRE.ipa`.
3. PC Windows : installer **iTunes** et **iCloud** depuis le site d'Apple (pas la version Microsoft Store), puis **Sideloadly** (https://sideloadly.io).
4. Brancher l'iPhone, « Se fier à cet ordinateur ». Glisser `TITRE.ipa` dans Sideloadly, taper son identifiant Apple, Start.
   (Le mot de passe va à Apple via Sideloadly, jamais dans le chat.)
5. Sur l'iPhone : Réglages > Général > VPN et gestion de l'appareil > votre identifiant > Faire confiance,
   puis Réglages > Confidentialité et sécurité > Mode développeur > activer.

Au bout de 7 jours : relancer Sideloadly avec le même fichier.
