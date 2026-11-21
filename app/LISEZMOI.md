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
