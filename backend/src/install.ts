// npm run install-db : installe ou met à jour la base, sans rien lancer d'autre.
import { pool } from './db.js';
import { migrate } from './migrate.js';

migrate()
  .then((a) => console.log(a.length ? `Base à jour (${a.length} étape(s) appliquée(s)).` : 'Base déjà à jour.'))
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => pool.end());
