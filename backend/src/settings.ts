// À importer en premier : installe la base si besoin, puis charge les réglages saisis dans le back office.
// Un réglage du back office passe avant la variable d'environnement du même nom.
import { q } from './db.js';
import { migrate } from './migrate.js';

await migrate();
try {
  const rows = await q<{ key: string; value: string }>('select key, value from public.app_settings');
  for (const r of rows) process.env[r.key] = r.value;
} catch {
  // table absente : on garde les variables d'environnement
}
