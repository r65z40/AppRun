# Back office TITRE

Pour la rédaction : valider l'édition du jour, gérer les sources, modérer les commentaires, gérer l'équipe.

## Ce qu'on y fait
- **Édition** : les cartes écrites par le moteur arrivent en brouillon, rangées par rubrique. Les cartes avec une alerte (texte trop proche d'un média, source manquante…) sont dans « À relire ». On peut modifier chaque carte avec un aperçu téléphone, la publier, la rejeter, changer l'ordre, la marquer « Essentiel ». Puis « Mettre l'édition en ligne » : l'app l'affiche.
- **Sources** : les flux RSS lus chaque matin, leur état (erreur éventuelle), en ajouter, en couper.
- **Modération** : commentaires signalés (masquer ou laisser) et derniers commentaires.
- **Équipe** (administrateurs) : donner ou retirer l'accès à la rédaction.

## Mettre en ligne (gratuit, GitHub Pages)
1. Dépôt GitHub > **Settings > Pages** > Source : **GitHub Actions**.
2. Le back office se publie à chaque modification de `admin/` sur `main` (workflow « Site en ligne »), à l'adresse `…/admin/`.
3. Tant que Supabase n'est pas branché, il s'ouvre en **mode démo** (données fictives).
4. Pour le brancher : **Settings > Secrets and variables > Actions > Variables** : `SUPABASE_URL` et `SUPABASE_ANON_KEY`, puis relancer le workflow.

## Premier accès
1. Supabase > **Authentication > Users > Add user** : créez votre compte (e-mail + mot de passe).
2. Supabase > **SQL Editor** :
   `update public.profiles set role = 'admin', pseudo = 'fen' where id = (select id from auth.users where email = 'votre@email.fr');`
3. Connectez-vous au back office. Ajoutez ensuite la rédaction depuis la page Équipe.

## En local
```bash
cd admin
npm install
npm run dev   # http://localhost:5173, mode démo sans fichier .env
```
