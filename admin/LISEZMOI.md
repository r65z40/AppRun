# Back office TITRE

Pour la rédaction : valider l'édition du jour, gérer les sources, modérer les commentaires, gérer l'équipe.

## Ce qu'on y fait
Le menu est rangé en quatre groupes : **Contenu** (Articles, Dernière minute, IA), **Lecteurs**, **Revenus** et **Administration**.
- **Articles** : les cartes écrites par le moteur arrivent en brouillon, rangées par rubrique. Les cartes avec une alerte (texte trop proche d'un média, source manquante…) sont dans « À relire ». On peut modifier chaque carte avec un aperçu téléphone, la publier, la rejeter, changer l'ordre, la marquer « Essentiel ». Puis « Mettre l'édition en ligne » : l'app l'affiche.
- **IA** : tout ce qui pilote le moteur, en onglets : Pilotage (pause, pilote automatique, modèle, consignes), Édition, Dernière minute, Sources (flux RSS), Historique (chaque passage du moteur) et Clés.
- **Réglages** : réactions et modération des lecteurs.
- **Modération** : commentaires signalés (masquer ou laisser) et derniers commentaires.
- **Équipe** (administrateurs) : donner ou retirer l'accès à la rédaction.

## Mettre en ligne (gratuit, GitHub Pages)
1. Dépôt GitHub > **Settings > Pages** > Source : **GitHub Actions**.
2. Le back office se publie à chaque modification de `admin/` sur `main` (workflow « Site en ligne »), à l'adresse `…/admin/`.
3. Tant que Supabase n'est pas branché, il s'ouvre en **mode démo** (données fictives).
4. Pour le brancher : **Settings > Secrets and variables > Actions > Variables** : `SUPABASE_URL` et `SUPABASE_ANON_KEY`, puis relancer le workflow.

## Premier accès
1. Ouvrez le back office : la première fois, il propose **Créer le compte administrateur**. Le premier compte créé devient administrateur.
2. Page **IA** (réglages réservés aux administrateurs) : clés Claude et Unsplash (ou Pexels, ancienne), modèle, sujets par rubrique, publication sans relecture, Dernière minute. Les clés sont masquées (4 derniers caractères).
3. Ajoutez ensuite la rédaction depuis la page Équipe.

## En local
```bash
cd admin
npm install
npm run dev   # http://localhost:5173, mode démo sans fichier .env
```
