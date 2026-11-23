# Règles pour Claude sur TITRE

Ces règles valent pour toute session de Claude sur ce dépôt (fils du projet, Claude Code sur un ordinateur, GitHub). Elles sont voulues par fen et passent avant les habitudes par défaut.

## 1. Toujours le skill « ponytail »

Pour tout travail de code (écrire, corriger, réorganiser, relire, choisir une dépendance), charge et applique le skill **ponytail** dès le début, sans attendre qu'on le demande. S'il n'est pas disponible dans la session, applique quand même ses principes :

- la plus petite modification qui règle entièrement le problème ;
- pas de couche, d'option ou de dépendance « au cas où » ;
- réutiliser ce qui existe dans le dépôt avant d'ajouter quoi que ce soit ;
- une réponse qu'une personne pressée et non développeuse comprend en une lecture.

## 2. Toujours la carte Graphify

La carte du code est dans `graphify-out/` : `GRAPH_REPORT.md` (résumé lisible) et `graph.json` (le graphe).

**Avant de modifier du code :**
1. Lis `graphify-out/GRAPH_REPORT.md`, et vérifie qu'il est à jour (ligne « Built from commit » comparée à `git rev-parse HEAD`).
2. Pour ce que tu vas toucher, interroge la carte :
   - `graphify explain "nom"` : ce qu'est un fichier ou une fonction, et ce qui y est relié ;
   - `graphify affected "nom"` : ce qui risque de casser si tu le modifies ;
   - `graphify query "question"` : trouver où se trouve quelque chose.

**Après un gros changement** (nouveau fichier, nouvelle fonction partagée, migration, réorganisation) : relance `graphify update . --force` pour travailler sur une carte juste. Ne mets pas `graphify-out/` dans tes commits : GitHub refait la carte après chaque fusion dans `main` (workflow « Carte du code »), ce qui évite les conflits entre fils.

Graphify s'installe avec `pip install "graphifyy[sql]"`. Le hook de début de session (`.claude/settings.json`) l'installe tout seul s'il manque.

## 3. Rappels du projet

- Langue : français, ton simple. fen n'est pas développeur.
- Migrations : prendre le prochain numéro libre dans `backend/supabase/migrations/`, puis `npm run setup-sql` dans `backend/`.
- Tests : `npm test` dans `backend/` ; vérification des types dans `admin/` et `app/`.
