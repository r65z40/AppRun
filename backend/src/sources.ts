/**
 * Vérification des sources : lit tous les flux, même désactivés, et note pour chacun dans la base
 * le nombre de titres, la date de la dernière dépêche ou l'erreur. Le résultat s'affiche dans IA > Sources.
 * Fait aussi le ménage des vieilles dépêches (réglage RAW_RETENTION_DAYS), et regarde si chaque média refuse
 * la fouille de ses textes par l'IA (tdm.ts) : une source qui refuse est désactivée, sauf si l'équipe l'a réactivée exprès.
 *
 * Usage : npm run sources
 */
import './settings.js'; // en premier : base à jour + réglages du back office
import { pool, q } from './db.js';
import { collectAll } from './collect.js';
import { cfg } from './config.js';
import { aiRefusal } from './tdm.js';

const r = await collectAll(undefined, console.log, { all: true }).finally(async () => {
  for (const s of await q<{ id: string; name: string; url: string }>('select id, name, url from sources order by name').catch(() => [])) {
    const refusal = await aiRefusal(s.url).catch(() => null);
    const [x] = await q<{ off: boolean }>(
      `update sources set ai_refusal = $2, ai_checked_at = now(),
              active = active and ($2::text is null or ai_accepted),
              disabled_reason = case when active and $2::text is not null and not ai_accepted then 'Le média refuse la fouille par l''IA : ' || $2 else disabled_reason end
        where id = $1 returning (active is false and $2::text is not null and not ai_accepted) as off`,
      [s.id, refusal],
    ).catch(() => [{ off: false }]);
    if (refusal) console.log(`  ${s.name} : refus de la fouille par l'IA (${refusal})${x?.off ? ' · source désactivée' : ''}`);
  }
  const purged = await q<{ n: number }>('select public.purge_raw_items($1) as n', [cfg.rawRetentionDays()]).catch(() => [{ n: 0 }]);
  if (purged[0]?.n) console.log(`Ménage : ${purged[0].n} dépêches de plus de ${cfg.rawRetentionDays()} jours supprimées.`);
  await pool.end();
});
console.log(`Sources vérifiées : ${r.total} titres lus, ${r.failed} source(s) en erreur.`);
