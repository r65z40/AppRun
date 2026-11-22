// Modération autonome : à chaque passage de la Dernière minute, l'IA tranche les commentaires signalés.
// Masqué ou gardé, le signalement est classé et la décision part au journal (page Journal du back office).
// En cas de doute, l'IA laisse le signalement à l'équipe.
import { q } from './db.js';
import { cfg } from './config.js';
import { judgeComments } from './ai.js';

type Row = { id: string; text: string; article: string; reports: number };

export async function moderate(log: (...a: unknown[]) => void) {
  if (!cfg.aiModeration()) return [];
  const rows = await q<Row>(
    `select c.id, c.text, a.title as article, count(r.id)::int as reports
       from comments c join reports r on r.comment_id = c.id and not r.resolved join articles a on a.id = c.article_id
      group by c.id, a.title order by min(r.created_at) limit 40`,
  );
  if (!rows.length) return [];
  const verdicts = await judgeComments(rows.map((r, k) => ({ n: k + 1, text: r.text, article: r.article, reports: r.reports })));
  const done: { text: string; decision: string; reason: string }[] = [];
  for (const v of verdicts) {
    const c = rows[v.n - 1];
    if (!c || v.decision === 'unsure') continue;
    const why = `IA : ${v.reason}`.slice(0, 300);
    // set_config(…, true) ne vaut que pour cette requête : la raison suit le changement jusqu'au journal.
    await q(
      `with s as (select set_config('titre.reason', $3, true)) update comments set status = $2 from s where id = $1 and status <> $2`,
      [c.id, v.decision === 'hide' ? 'hidden' : 'visible', why],
    );
    await q('update reports set resolved = true where comment_id = $1', [c.id]);
    done.push({ text: c.text, decision: v.decision, reason: v.reason });
    log(`  ${v.decision === 'hide' ? '🚫 masqué' : '✓ gardé'} : « ${c.text} » (${v.reason})`);
  }
  log(`Modération : ${rows.length} commentaire(s) signalé(s), ${done.length} tranché(s) par l'IA, ${rows.length - done.length} laissé(s) à l'équipe.`);
  return done;
}
