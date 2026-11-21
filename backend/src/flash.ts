/**
 * Dernière minute : tourne toutes les 20 minutes de 6 h à 23 h.
 * Lit les sources, garde les dépêches des deux dernières heures, l'IA retient les faits majeurs
 * confirmés par deux médias, publiés aussitôt (FLASH_AUTO_PUBLISH=0 pour les garder masqués jusqu'à validation).
 *
 * Usage : npm run flash -- [--fixtures test/feeds]
 */
import { pool, q } from './db.js';
import { collect } from './collect.js';
import { startJournal, type Journal } from './journal.js';
import { MODEL, checkFlash, selectFlashes, type Item } from './ai.js';

const args = process.argv.slice(2);
const fx = args.indexOf('--fixtures');
const FIXTURES = fx >= 0 ? args[fx + 1] : undefined;
const AUTO = process.env.FLASH_AUTO_PUBLISH !== '0';
let J: Journal;
const log = (...a: unknown[]) => J.log(...a);

type Raw = { id: string; title: string; description: string; link: string; published_at: Date | null; source: string };

async function main() {
  J = await startJournal('flash');
  try {
    await flash();
  } catch (e) {
    log(`Erreur : ${e instanceof Error ? e.message : e}`);
    await J.finish('error', `Échec : ${e instanceof Error ? e.message : e}`);
    throw e;
  }
}

async function flash() {
  const fetched = await collect(FIXTURES, log);
  const used = new Set((await q<{ id: string }>("select unnest(raw_item_ids)::text as id from flashes where created_at > now() - interval '24 hours'")).map((r) => r.id));
  const raws = (await q<Raw>(
    `select r.id, r.title, r.description, r.link, r.published_at, s.name as source
       from raw_items r join sources s on s.id = r.source_id
      where coalesce(r.published_at, r.fetched_at) > now() - interval '2 hours' ${FIXTURES ? "or true" : ''}
      order by coalesce(r.published_at, r.fetched_at) desc limit 250`,
  )).filter((r) => !used.has(r.id));
  log(`${fetched} titres lus, ${raws.length} dépêches des 2 dernières heures pas encore utilisées.`);
  if (raws.length < 2) return J.finish('ok', `${fetched} titres lus, rien de neuf depuis 2 heures.`, { fetched, items: raws.length, published: 0 });
  const items: Item[] = raws.map((r, k) => ({ n: k + 1, source: r.source, title: r.title, description: r.description, publishedAt: r.published_at?.toISOString() ?? null }));
  const today = (await q<{ title: string }>("select title from flashes where published_at > now() - interval '18 hours' order by published_at")).map((r) => r.title);

  const found = await selectFlashes(items, today);
  log(`L'IA propose ${found.length} info(s) majeure(s).`);
  const kept: { title: string; sources: string[]; rejected?: string }[] = (J.details.flashes = []) as never;
  let n = 0;
  for (const f of found) {
    const issues = checkFlash(f, items);
    if (issues.length) {
      log(`  écartée : ${f.title} (${issues.join(', ')})`);
      kept.push({ title: f.title, sources: f.item_numbers.map((k) => items[k - 1]?.source).filter(Boolean), rejected: issues.join(', ') });
      continue;
    }
    const its = f.item_numbers.map((k) => raws[k - 1]).filter(Boolean);
    const sources = [...new Map(its.map((r) => [r.source, { source: r.source, url: r.link }])).values()];
    await q(
      `insert into flashes (status, rubric_id, importance, title, sentence, sources, raw_item_ids, model)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [AUTO ? 'published' : 'hidden', f.rubric, Math.min(10, Math.max(8, f.importance)), f.title.slice(0, 90), f.sentence.slice(0, 220), JSON.stringify(sources), its.map((r) => r.id), MODEL],
    );
    n++;
    log(`  ⚡ ${f.title}`);
    kept.push({ title: f.title, sources: sources.map((x) => x.source) });
  }
  const summary = `${fetched} titres lus, ${items.length} dépêches récentes, ${n} info(s) publiée(s).`;
  log(`Dernière minute : ${summary}`);
  await J.finish('ok', summary, { fetched, items: items.length, proposed: found.length, published: n });
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => pool.end());
