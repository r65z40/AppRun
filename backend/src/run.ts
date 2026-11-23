/**
 * Moteur quotidien TITRE.
 *   1. récupère les flux RSS des sources actives (titre + chapô uniquement) ;
 *   2. l'IA choisit et regroupe les sujets du jour, par rubrique ;
 *   3. l'IA écrit une carte TITRE par sujet (titre, phrase clé, 3 faits sourcés, résumé en 3 blocs) ;
 *   4. contrôles automatiques ; une carte qui échoue est réécrite une fois par l'IA avec la liste des problèmes.
 *   5. publication automatique (réglage par défaut, AUTO_PUBLISH=0 pour tout relire avant) ;
 *      les cartes encore en défaut restent « À relire » dans le back office.
 *
 * --update (passages de la journée) : ajoute à l'édition déjà en ligne les sujets nouveaux et importants
 * des 4 dernières heures, sans reprendre ceux déjà traités. Sans édition du jour, la construit en entier.
 *
 * Usage : npm run engine -- [--date 2026-11-22] [--fixtures test/feeds] [--per-rubric 8] [--update]
 */
import './settings.js'; // en premier : base à jour + réglages du back office
import { pool, q } from './db.js';
import { collect } from './collect.js';
import { startJournal, type Journal } from './journal.js';
import { findPhoto, pexelsOn } from './pexels.js';
import { model, checkCard, selectStories, writeCard, usage, type Item, type Story } from './ai.js';
import { cfg, snapshot } from './config.js';

const args = process.argv.slice(2);
const arg = (k: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const DATE = arg('date') ?? new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());
const FIXTURES = arg('fixtures');
const PER_RUBRIC = arg('per-rubric') ? Number(arg('per-rubric')) : cfg.perRubric();
const AUTO_PUBLISH = cfg.autoPublish();
const WINDOW_H = cfg.windowHours();
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 4);

let J: Journal;
const log = (...a: unknown[]) => J.log(...a);

type Raw = { id: string; title: string; description: string; link: string; published_at: Date | null; source: string };

async function main() {
  J = await startJournal('edition');
  try {
    await edition();
  } catch (e) {
    log(`Erreur : ${e instanceof Error ? e.message : e}`);
    await J.finish('error', `Échec : ${e instanceof Error ? e.message : e}`);
    throw e;
  }
}

async function edition() {
  log(`Édition du ${DATE} · modèle ${model()}${process.env.MOCK_AI === '1' ? ' (mode test, sans IA)' : ''}`);
  J.details.config = snapshot('edition');
  // Journal de lecture de l'algorithme : rien n'est gardé au-delà de la durée de conservation (90 jours par défaut).
  await q('select purge_reading_events()').catch(() => {});
  if (cfg.paused()) {
    log('Moteur en pause (Réglages) : aucun passage.');
    return J.finish('ok', 'Moteur en pause dans les réglages : rien fait.');
  }

  const ed = await q<{ status: string }>('select status from editions where date = $1', [DATE]);
  // Mise à jour de la journée : seulement si l'édition du jour existe déjà, sinon on la construit (rattrapage).
  const UPDATE = args.includes('--update') && !!ed[0] && ed[0].status !== 'building';
  if (UPDATE && !cfg.liveUpdates()) {
    log('Mises à jour de la journée coupées (Réglages).');
    return J.finish('ok', 'Mises à jour de la journée coupées dans les réglages.');
  }
  if (UPDATE) log(`Mise à jour de la journée : sujets nouveaux d'importance ${cfg.liveMinImportance()}/10 au moins.`);
  // --once (passages automatiques) : une seule édition par jour, même si GitHub lance plusieurs rattrapages.
  if (args.includes('--once') && ed[0] && ed[0].status !== 'building') {
    log('Édition du jour déjà faite : rattrapage inutile.');
    return J.finish('ok', 'Édition du jour déjà faite.');
  }
  if (ed[0]?.status === 'published' && !args.includes('--force') && !UPDATE) {
    log('Édition déjà publiée : rien à faire (ajoutez --force pour compléter).');
    return J.finish('ok', 'Édition déjà publiée, rien à faire.');
  }
  await q(`insert into editions (date) values ($1) on conflict (date) do nothing`, [DATE]);

  log('1/4 Récupération des sources');
  const fetched = await collect(FIXTURES, log);

  // Fenêtre : les WINDOW_H dernières heures, jusqu'à maintenant (ou jusqu'au lendemain 6 h pour une date passée).
  const until = new Date(new Date(`${DATE}T06:00:00+01:00`).getTime() + 86400e3);
  const end = until > new Date() ? new Date() : until;
  const hours = UPDATE ? 4 : WINDOW_H;
  const raws = await q<Raw>(
    `select r.id, r.title, r.description, r.link, r.published_at, s.name as source
       from raw_items r join sources s on s.id = r.source_id
      where coalesce(r.published_at, r.fetched_at) between $1 and $2
      order by coalesce(r.published_at, r.fetched_at) desc limit 400`,
    [FIXTURES ? new Date(0) : new Date(end.getTime() - hours * 3600e3), FIXTURES ? new Date('2100-01-01') : end], // flux d'exemple : dates figées
  );
  // Ne pas réécrire un sujet déjà traité dans cette édition.
  const done = new Set((await q<{ id: string }>('select unnest(raw_item_ids)::text as id from articles where edition_date = $1 and status <> $2', [DATE, 'rejected'])).map((r) => r.id));
  const fresh = raws.filter((r) => !done.has(r.id));
  log(`   ${fetched} titres lus, ${raws.length} publiés dans les ${hours} dernières heures, dont ${fresh.length} pas encore traités`);
  if (!fresh.length) return J.finish('ok', `${fetched} titres lus, rien de nouveau à traiter.`, { fetched, window: raws.length, items: 0 });

  const items: Item[] = fresh.map((r, k) => ({
    n: k + 1,
    source: r.source,
    title: r.title,
    description: r.description,
    publishedAt: r.published_at ? r.published_at.toISOString() : null,
  }));

  log('2/4 Choix des sujets');
  const already = UPDATE ? await q<{ title: string; essential: boolean }>('select title, essential from articles where edition_date = $1 and status <> $2', [DATE, 'rejected']) : [];
  const proposed = await selectStories(items, PER_RUBRIC, already.map((a) => a.title));
  // Mise à jour : plus exigeante (importance minimale), et pas plus d'un quart du plafond de cartes par passage.
  const minImp = UPDATE ? Math.max(cfg.minImportance(), cfg.liveMinImportance()) : cfg.minImportance();
  const cap = UPDATE ? Math.max(1, Math.ceil(cfg.maxCards() / 4)) : cfg.maxCards();
  // Réglages de la rédaction : importance et nombre de médias minimum, essentiels et total plafonnés.
  const mediaCount = (s: Story) => new Set(s.item_numbers.map((n) => items[n - 1]?.source).filter(Boolean)).size;
  const dropped: { label: string; why: string }[] = [];
  let ess = already.filter((a) => a.essential).length;
  const stories = proposed
    .filter((s) => {
      if (s.importance < minImp) return dropped.push({ label: s.label, why: `importance ${s.importance} < ${minImp}` }), false;
      if (mediaCount(s) < cfg.minSources()) return dropped.push({ label: s.label, why: `${mediaCount(s)} média(s) < ${cfg.minSources()}` }), false;
      return true;
    })
    .sort((a, b) => Number(b.essential) - Number(a.essential) || b.importance - a.importance)
    .map((s) => (s.essential && ++ess > cfg.maxEssential() ? { ...s, essential: false } : s))
    .filter((s, k) => (k < cap ? true : (dropped.push({ label: s.label, why: `plafond de ${cap} cartes` }), false)));
  J.details.dropped = dropped;
  log(`   ${proposed.length} sujets proposés par l'IA, ${stories.length} gardés selon les réglages, sur ${items.length} titres`);
  J.details.stories = stories.map((s) => ({
    label: s.label, rubric: s.rubric, importance: s.importance, essential: s.essential, sensitive: !!s.sensitive,
    items: s.item_numbers.map((n) => items[n - 1]).filter(Boolean).map((i) => ({ source: i.source, title: i.title })),
  }));
  const usedN = new Set(stories.flatMap((s) => s.item_numbers));
  J.details.left = items.filter((i) => !usedN.has(i.n)).slice(0, 150).map((i) => ({ source: i.source, title: i.title }));
  const cards: { rubric: string; title: string; issues: string[]; error?: string }[] = (J.details.cards = []) as never;

  log('3/4 Écriture des cartes');
  const ranks: Record<string, number> = {};
  const existing = await q<{ rubric_id: string; n: number }>('select rubric_id, count(*)::int as n from articles where edition_date = $1 group by rubric_id', [DATE]);
  existing.forEach((e) => (ranks[e.rubric_id] = e.n));
  const sorted = [...stories].sort((a, b) => Number(b.essential) - Number(a.essential) || b.importance - a.importance);
  let written = 0, flagged = 0, failed = 0, fixed = 0;

  const work = async (s: Story) => {
    const its = s.item_numbers.map((n) => items[n - 1]);
    try {
      let card = await writeCard(s, its);
      let issues = checkCard(card, its);
      if (issues.length && cfg.autoFix()) {
        // Autocorrection : l'IA réécrit la carte en sachant ce qui n'allait pas.
        log(`   ↻ [${s.rubric}] réécriture : ${issues.join(', ')}`);
        const again = await writeCard(s, its, issues).catch(() => null);
        const left = again ? checkCard(again, its) : issues;
        if (again && left.length < issues.length) { card = again; issues = left; fixed++; }
      }
      const facts = card.facts.map((f) => {
        const r = fresh[f.item_number - 1] ?? fresh[its[0].n - 1];
        return { text: f.text, source: r.source, url: r.link };
      });
      const photo = pexelsOn() ? await findPhoto(card.photo_query).catch((e) => { log(`   photo introuvable (${e instanceof Error ? e.message : e})`); return null; }) : null;
      const publish = AUTO_PUBLISH && (issues.length === 0 || cfg.publishFlagged()) && s.importance >= cfg.publishMinImportance();
      await q(
        `insert into articles (edition_date, rubric_id, status, rank, importance, essential, title, key_sentence, facts, summary,
                               photo_tag, raw_item_ids, review_notes, model, published_at, photo_url, photo_credit, sensitive)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
        [
          DATE, s.rubric, publish ? 'published' : 'draft', (ranks[s.rubric] = (ranks[s.rubric] ?? 0) + 1) - 1,
          s.importance, s.essential, card.title.slice(0, 90), card.key_sentence, JSON.stringify(facts),
          JSON.stringify([card.summary.context, card.summary.change, card.summary.next]), card.photo_tag,
          its.map((i) => fresh[i.n - 1].id), issues, model(), publish ? new Date() : null, photo?.url ?? null, photo?.credit ?? null,
          !!s.sensitive,
        ],
      );
      written++;
      if (issues.length) flagged++;
      log(`   ✓ [${s.rubric}] ${card.title}${issues.length ? `  ⚠ ${issues.join(', ')}` : ''}`);
      cards.push({ rubric: s.rubric, title: card.title, issues, photo: photo ? `${card.photo_query} → ${photo.credit}` : pexelsOn() ? `${card.photo_query} → aucune photo` : undefined } as never);
    } catch (e) {
      failed++;
      log(`   ✗ [${s.rubric}] ${s.label} : ${e instanceof Error ? e.message : e}`);
      cards.push({ rubric: s.rubric, title: s.label, issues: [], error: e instanceof Error ? e.message : String(e) });
    }
  };
  // Quelques cartes en parallèle, pas plus.
  const queue = [...sorted];
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length) await work(queue.shift()!);
  }));

  log('4/4 Édition');
  const stats = { fetched, window: raws.length, items: items.length, proposed: proposed.length, stories: stories.length, written, flagged, fixed, failed, model: model(), ai: { ...usage } };
  const summary = `${UPDATE ? 'Mise à jour : ' : ''}${fetched} titres lus, ${items.length} à traiter, ${stories.length} sujets retenus, ${written} cartes écrites (${fixed} corrigées par l'IA, ${flagged} à relire, ${failed} échecs).`;
  if (UPDATE) {
    // L'édition reste telle quelle (statut et statistiques du matin) : seules les nouvelles cartes s'ajoutent.
    log(`Terminé : ${summary}`);
    if (failed && !written) process.exitCode = 1;
    return J.finish(failed && !written ? 'error' : 'ok', summary, stats);
  }
  // L'édition passe en ligne dès qu'au moins une carte l'est (sinon elle attend la relecture).
  const live = AUTO_PUBLISH && (await q<{ n: number }>(`select count(*)::int as n from articles where edition_date = $1 and status = 'published'`, [DATE]))[0].n > 0;
  await q(
    `update editions set status = $2, stats = $3, published_at = case when $2 = 'published' then now() else published_at end where date = $1`,
    [DATE, live ? 'published' : failed && !written ? 'building' : 'ready', JSON.stringify(stats)], // tout a échoué : le prochain essai refera l'édition
  );
  log(`Terminé : ${summary} ${live ? 'Édition publiée automatiquement.' : 'En attente de validation dans le back office.'}`);
  await J.finish(failed && !written ? 'error' : 'ok', summary, stats);
  if (failed && !written) process.exitCode = 1; // le workflow GitHub échoue et prévient l'équipe
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
