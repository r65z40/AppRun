/**
 * Moteur quotidien TITRE.
 *   1. récupère les flux RSS des sources actives (titre + chapô uniquement) ;
 *   2. l'IA choisit et regroupe les sujets du jour, par rubrique ;
 *   3. l'IA écrit une carte TITRE par sujet (titre, phrase clé, 3 faits sourcés, résumé en 3 blocs) ;
 *   4. contrôles automatiques, puis enregistrement en brouillon (ou publication si AUTO_PUBLISH=1).
 *
 * Usage : npm run engine -- [--date 2026-11-22] [--fixtures test/feeds] [--per-rubric 8]
 */
import { pool, q } from './db.js';
import { collect } from './collect.js';
import { MODEL, checkCard, selectStories, writeCard, type Item, type Story } from './ai.js';

const args = process.argv.slice(2);
const arg = (k: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const DATE = arg('date') ?? new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());
const FIXTURES = arg('fixtures');
const PER_RUBRIC = Number(arg('per-rubric') ?? process.env.PER_RUBRIC ?? 8);
const AUTO_PUBLISH = process.env.AUTO_PUBLISH === '1';
const WINDOW_H = Number(process.env.WINDOW_HOURS ?? 30);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 4);

const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

type Raw = { id: string; title: string; description: string; link: string; published_at: Date | null; source: string };

async function main() {
  log(`Édition du ${DATE} · modèle ${MODEL}${process.env.MOCK_AI === '1' ? ' (mode test, sans IA)' : ''}`);

  const ed = await q<{ status: string }>('select status from editions where date = $1', [DATE]);
  if (ed[0]?.status === 'published' && !args.includes('--force')) {
    log('Édition déjà publiée : rien à faire (ajoutez --force pour compléter).');
    return;
  }
  await q(`insert into editions (date) values ($1) on conflict (date) do nothing`, [DATE]);

  log('1/4 Récupération des sources');
  const fetched = await collect(FIXTURES, log);

  // Fenêtre : les dernières heures avant la fin de la journée demandée.
  const until = new Date(`${DATE}T06:00:00+01:00`);
  const end = until > new Date() ? new Date() : until;
  const raws = await q<Raw>(
    `select r.id, r.title, r.description, r.link, r.published_at, s.name as source
       from raw_items r join sources s on s.id = r.source_id
      where coalesce(r.published_at, r.fetched_at) between $1 and $2
      order by coalesce(r.published_at, r.fetched_at) desc limit 400`,
    [new Date(end.getTime() - WINDOW_H * 3600e3), FIXTURES ? new Date('2100-01-01') : end],
  );
  // Ne pas réécrire un sujet déjà traité dans cette édition.
  const done = new Set((await q<{ id: string }>('select unnest(raw_item_ids)::text as id from articles where edition_date = $1 and status <> $2', [DATE, 'rejected'])).map((r) => r.id));
  const fresh = raws.filter((r) => !done.has(r.id));
  log(`   ${fetched} titres lus, ${fresh.length} nouveaux dans la fenêtre`);
  if (!fresh.length) return;

  const items: Item[] = fresh.map((r, k) => ({
    n: k + 1,
    source: r.source,
    title: r.title,
    description: r.description,
    publishedAt: r.published_at ? r.published_at.toISOString() : null,
  }));

  log('2/4 Choix des sujets');
  const stories = await selectStories(items, PER_RUBRIC);
  log(`   ${stories.length} sujets retenus`);

  log('3/4 Écriture des cartes');
  const ranks: Record<string, number> = {};
  const existing = await q<{ rubric_id: string; n: number }>('select rubric_id, count(*)::int as n from articles where edition_date = $1 group by rubric_id', [DATE]);
  existing.forEach((e) => (ranks[e.rubric_id] = e.n));
  const sorted = [...stories].sort((a, b) => Number(b.essential) - Number(a.essential) || b.importance - a.importance);
  let written = 0, flagged = 0, failed = 0;

  const work = async (s: Story) => {
    const its = s.item_numbers.map((n) => items[n - 1]);
    try {
      const card = await writeCard(s, its);
      const issues = checkCard(card, its);
      const facts = card.facts.map((f) => {
        const r = fresh[f.item_number - 1] ?? fresh[its[0].n - 1];
        return { text: f.text, source: r.source, url: r.link };
      });
      const publish = AUTO_PUBLISH && issues.length === 0;
      await q(
        `insert into articles (edition_date, rubric_id, status, rank, importance, essential, title, key_sentence, facts, summary,
                               photo_tag, raw_item_ids, review_notes, model, published_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          DATE, s.rubric, publish ? 'published' : 'draft', (ranks[s.rubric] = (ranks[s.rubric] ?? 0) + 1) - 1,
          s.importance, s.essential, card.title.slice(0, 90), card.key_sentence, JSON.stringify(facts),
          JSON.stringify([card.summary.context, card.summary.change, card.summary.next]), card.photo_tag,
          its.map((i) => fresh[i.n - 1].id), issues, MODEL, publish ? new Date() : null,
        ],
      );
      written++;
      if (issues.length) flagged++;
      log(`   ✓ [${s.rubric}] ${card.title}${issues.length ? `  ⚠ ${issues.join(', ')}` : ''}`);
    } catch (e) {
      failed++;
      log(`   ✗ [${s.rubric}] ${s.label} : ${e instanceof Error ? e.message : e}`);
    }
  };
  // Quelques cartes en parallèle, pas plus.
  const queue = [...sorted];
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length) await work(queue.shift()!);
  }));

  log('4/4 Édition');
  const stats = { fetched, items: items.length, stories: stories.length, written, flagged, failed, model: MODEL };
  await q(
    `update editions set status = $2, stats = $3, published_at = case when $2 = 'published' then now() else published_at end where date = $1`,
    [DATE, AUTO_PUBLISH ? 'published' : 'ready', JSON.stringify(stats)],
  );
  log(`Terminé : ${written} cartes (${flagged} à relire, ${failed} échecs). ${AUTO_PUBLISH ? 'Publiées automatiquement.' : 'En attente de validation dans le back office.'}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
