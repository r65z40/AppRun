/**
 * Vérification des sources : lit tous les flux, même désactivés, et note pour chacun dans la base
 * le nombre de titres, la date de la dernière dépêche ou l'erreur. Le résultat s'affiche dans IA > Sources.
 * Fait aussi le ménage des vieilles dépêches (réglage RAW_RETENTION_DAYS).
 *
 * Usage : npm run sources
 */
import './settings.js'; // en premier : base à jour + réglages du back office
import { pool, q } from './db.js';
import { collectAll } from './collect.js';
import { cfg } from './config.js';

const r = await collectAll(undefined, console.log, { all: true }).finally(async () => {
  const purged = await q<{ n: number }>('select public.purge_raw_items($1) as n', [cfg.rawRetentionDays()]).catch(() => [{ n: 0 }]);
  if (purged[0]?.n) console.log(`Ménage : ${purged[0].n} dépêches de plus de ${cfg.rawRetentionDays()} jours supprimées.`);
  await pool.end();
});
console.log(`Sources vérifiées : ${r.total} titres lus, ${r.failed} source(s) en erreur.`);
