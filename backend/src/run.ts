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
 * --test (mode test du back office) : passage à blanc avec les réglages actuels. L'IA choisit les sujets et
 * écrit quelques cartes, visibles dans IA > Historique, mais rien n'est enregistré ni publié.
 *
 * Usage : npm run engine -- [--date 2026-11-22] [--fixtures test/feeds] [--per-rubric 8] [--update] [--force] [--test]
 */
import './settings.js'; // en premier : base à jour + réglages du back office
import { pool, q } from './db.js';
import { collect } from './collect.js';
import { nothingNew, startJournal, type Journal } from './journal.js';
import { findPhoto, pexelsOn } from './pexels.js';
import { AiStopped, budget, model, cardText, checkCard, doubtIssue, minorIssue, reviewText, type CardOut, selectStories, setRubricHints, writeCard, usage, type Item, type Story } from './ai.js';
import { dedupe, type Raw } from './dedupe.js';
import { cfg, snapshot } from './config.js';
import { sendTopicAlerts } from './alerts.js';
import { pauseMessage } from './pause.js';

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

const TEST = args.includes('--test');
/** Cartes écrites au plus en mode test (pour limiter le coût). */
const TEST_CARDS = 5;
let J: Journal;
const log = (...a: unknown[]) => J.log(...a);


async function main() {
  J = await startJournal('edition');
  budget.log = log;
  try {
    await edition();
    // Alertes des sujets suivis (les infos publiées la nuit n'en déclenchent pas : voir le back office).
    if (!TEST) await sendTopicAlerts().catch((e) => console.error(`Alertes sujets impossibles : ${e instanceof Error ? e.message : e}`));
  } catch (e) {
    // IA coupée ou budget atteint pendant le choix des sujets : arrêt voulu, pas une panne.
    if (e instanceof AiStopped) { log(e.message); return J.finish('ok', e.message, { model: model(), ai: { ...usage } }); }
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
  await q('select purge_raw_items($1)', [cfg.rawRetentionDays()]).catch(() => {});
  setRubricHints(await q<{ id: string; name: string; ai_hint: string | null }>('select id, name, ai_hint from rubrics').catch(() => []));
  if (TEST) { J.details.test = true; log('Mode test : l’IA choisit et écrit comme d’habitude, mais rien n’est enregistré ni publié.'); }
  if (cfg.paused() && !TEST) {
    const msg = await pauseMessage();
    log(msg);
    return J.finish('ok', msg, { paused: true });
  }

  const ed = await q<{ status: string }>('select status from editions where date = $1', [DATE]);
  // Mise à jour de la journée : seulement si l'édition du jour existe déjà, sinon on la construit (rattrapage).
  const UPDATE = !TEST && args.includes('--update') && !!ed[0] && ed[0].status !== 'building';
  if (UPDATE && !cfg.liveUpdates()) {
    log('Mises à jour de la journée coupées (Réglages).');
    return J.finish('ok', 'Mises à jour de la journée coupées dans les réglages.');
  }
  if (UPDATE) log(`Mise à jour de la journée : sujets nouveaux d'importance ${cfg.liveMinImportance()}/10 au moins.`);
  // --once (passages automatiques) : une seule édition par jour, même si GitHub lance plusieurs rattrapages.
  if (!TEST && args.includes('--once') && ed[0] && ed[0].status !== 'building') {
    log('Édition du jour déjà faite : rattrapage inutile.');
    return J.finish('ok', 'Édition du jour déjà faite.');
  }
  if (ed[0]?.status === 'published' && !args.includes('--force') && !UPDATE && !TEST) {
    log('Édition déjà publiée : rien à faire (ajoutez --force pour compléter).');
    return J.finish('ok', 'Édition déjà publiée, rien à faire.');
  }
  // IA coupée ou budget déjà atteint : on s'arrête avant même de lire les sources.
  try { await budget.check(); } catch (e) {
    if (!(e instanceof AiStopped)) throw e;
    log(e.message);
    return J.finish('ok', e.message);
  }
  if (!TEST) await q(`insert into editions (date) values ($1) on conflict (date) do nothing`, [DATE]);

  log('1/4 Récupération des sources');
  const fetched = await collect(FIXTURES, log);
  // Mise à jour de la journée sans aucune dépêche nouvelle depuis la précédente : pas d'appel à l'IA.
  if (UPDATE && await nothingNew('edition', J.id)) return J.finish('ok', `Mise à jour : ${fetched} titres lus, aucune dépêche nouvelle depuis le dernier passage, IA non appelée (économie).`, { fetched });
  J.details.seen = new Date().toISOString();

  // Fenêtre : les WINDOW_H dernières heures, jusqu'à maintenant (ou jusqu'au lendemain 6 h pour une date passée).
  const until = new Date(new Date(`${DATE}T06:00:00+01:00`).getTime() + 86400e3);
  const end = until > new Date() ? new Date() : until;
  const hours = UPDATE ? cfg.updateWindowHours() : WINDOW_H;
  const raws = await q<Raw>(
    `select r.id, r.title, r.description, r.link, r.published_at, s.name as source, s.rubric_hint as hint
       from raw_items r join sources s on s.id = r.source_id
      where coalesce(r.published_at, r.fetched_at) between $1 and $2
      order by coalesce(r.published_at, r.fetched_at) desc limit ${cfg.maxItems() * 2}`,
    [FIXTURES ? new Date(0) : new Date(end.getTime() - hours * 3600e3), FIXTURES ? new Date('2100-01-01') : end], // flux d'exemple : dates figées
  );
  // Ne pas réécrire un sujet déjà traité dans cette édition.
  const done = TEST ? new Set<string>() : new Set((await q<{ id: string }>('select unnest(raw_item_ids)::text as id from articles where edition_date = $1 and status <> $2', [DATE, 'rejected'])).map((r) => r.id));
  // Même article dans deux flux d'un média (Une + rubrique) ou repris mot pour mot : une seule dépêche pour l'IA.
  const pending = raws.filter((r) => !done.has(r.id));
  const fresh = dedupe(pending).slice(0, cfg.maxItems());
  const dups = pending.length - fresh.length;
  log(`   ${fetched} titres lus, ${raws.length} publiés dans les ${hours} dernières heures, dont ${fresh.length} pas encore traités${dups > 0 ? ` (${dups} doublons ou au-delà de ${cfg.maxItems()} écartés)` : ''}`);
  if (!fresh.length) return J.finish('ok', `${fetched} titres lus, rien de nouveau à traiter.`, { fetched, window: raws.length, items: 0 });

  const items: Item[] = fresh.map((r, k) => ({
    n: k + 1,
    source: r.source,
    title: r.title,
    description: r.description,
    publishedAt: r.published_at ? r.published_at.toISOString() : null,
    hint: r.hint,
  }));

  log('2/4 Choix des sujets');
  const already = UPDATE ? await q<{ title: string; essential: boolean }>('select title, essential from articles where edition_date = $1 and status <> $2', [DATE, 'rejected']) : [];
  const proposed = await selectStories(items, PER_RUBRIC, already.map((a) => a.title));
  // Mise à jour : plus exigeante (importance minimale), et pas plus d'un quart du plafond de cartes par passage.
  const minImp = UPDATE ? Math.max(cfg.minImportance(), cfg.liveMinImportance()) : cfg.minImportance();
  const cap = UPDATE ? cfg.liveMaxCards() || Math.max(1, Math.ceil(cfg.maxCards() / 4)) : cfg.maxCards();
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
  // Mise à jour de la journée : au moins LIVE_MIN_CARDS cartes s'il y a du neuf, même sous le seuil d'importance
  // des mises à jour (les plus importantes d'abord, toujours au-dessus des minimums de l'édition).
  const minCards = UPDATE ? Math.min(cfg.liveMinCards(), cap) : 0;
  if (stories.length < minCards) {
    const kept = new Set(stories.map((s) => s.label));
    const extra = proposed
      .filter((s) => !kept.has(s.label) && s.importance >= cfg.minImportance() && mediaCount(s) >= cfg.minSources())
      .sort((a, b) => b.importance - a.importance)
      .slice(0, minCards - stories.length);
    for (const s of extra) {
      stories.push({ ...s, essential: false });
      const k = dropped.findIndex((d) => d.label === s.label);
      if (k >= 0) dropped.splice(k, 1);
    }
    if (extra.length) log(`   ${extra.length} sujet(s) ajouté(s) sous le seuil pour garantir ${minCards} carte(s) par mise à jour`);
  }
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
  // Limite de publications automatiques par jour (heure de Paris), toutes éditions et mises à jour comprises.
  let pubToday = (await q<{ n: number }>(`select count(*)::int as n from articles where status = 'published' and published_at >= date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris'`))[0].n;
  let stopped = '';

  const work = async (s: Story) => {
    const its = s.item_numbers.map((n) => items[n - 1]);
    try {
      // Contrôles automatiques, puis seconde lecture par l'IA si la carte partirait en ligne sans relecture humaine.
      const check = async (c: CardOut) => {
        const found = checkCard(c, its);
        if ((AUTO_PUBLISH || TEST) && found.every((i) => minorIssue(i) || doubtIssue(i)))
          found.push(...await reviewText(cardText(c), its).catch((e) => [`relecture IA impossible (${e instanceof Error ? e.message : e})`]));
        return found;
      };
      let card = await writeCard(s, its);
      let issues = await check(card);
      if (issues.length && cfg.autoFix()) {
        // Autocorrection : l'IA réécrit la carte en sachant ce qui n'allait pas (ton, chiffres, relecture comprises).
        log(`   ↻ [${s.rubric}] réécriture : ${issues.join(', ')}`);
        const again = await writeCard(s, its, issues).catch(() => null);
        const left = again ? await check(again) : issues;
        if (again && left.length < issues.length) { card = again; issues = left; fixed++; }
      }
      const facts = card.facts.map((f) => {
        const r = fresh[f.item_number - 1] ?? fresh[its[0].n - 1];
        return { text: f.text, source: r.source, url: r.link };
      });
      if (TEST) {
        // Mode test : la carte complète va dans le journal, rien dans la base.
        written++;
        if (issues.length) flagged++;
        log(`   ✓ [${s.rubric}] ${card.title}${issues.length ? `  ⚠ ${issues.join(', ')}` : ''}`);
        cards.push({ rubric: s.rubric, title: card.title, issues, key_sentence: card.key_sentence, facts: facts.map((f) => `${f.text} (${f.source})`), importance: s.importance } as never);
        return;
      }
      const photo = pexelsOn() ? await findPhoto(card.photo_query).catch((e) => { log(`   photo introuvable (${e instanceof Error ? e.message : e})`); return null; }) : null;
      // Une reprise mot pour mot d'un média ne part jamais seule, même avec « Publier aussi les cartes avec alerte ».
      let publish = AUTO_PUBLISH && (issues.every(minorIssue) || (!cfg.guardHold() && issues.every((i) => minorIssue(i) || doubtIssue(i))) || (cfg.publishFlagged() && !issues.some((i) => i.startsWith('reprise')))) && s.importance >= cfg.publishMinImportance();
      if (publish && cfg.publishMaxPerDay() && pubToday >= cfg.publishMaxPerDay()) { publish = false; issues.push(`limite de ${cfg.publishMaxPerDay()} publications par jour atteinte`); }
      if (publish) pubToday++;
      await q(
        `insert into articles (edition_date, rubric_id, status, rank, importance, essential, title, key_sentence, facts, summary,
                               photo_tag, raw_item_ids, review_notes, model, published_at, photo_url, photo_credit, sensitive, run_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [
          DATE, s.rubric, publish ? 'published' : 'draft', (ranks[s.rubric] = (ranks[s.rubric] ?? 0) + 1) - 1,
          s.importance, s.essential, card.title.slice(0, 90), card.key_sentence, JSON.stringify(facts),
          JSON.stringify([card.summary.context, card.summary.change, card.summary.next]), card.photo_tag,
          its.flatMap((i) => [fresh[i.n - 1].id, ...(fresh[i.n - 1].dups ?? [])]), issues, model(), publish ? new Date() : null, photo?.url ?? null, photo?.credit ?? null,
          !!s.sensitive, J.id,
        ],
      );
      written++;
      if (issues.length) flagged++;
      log(`   ✓ [${s.rubric}] ${card.title}${issues.length ? `  ⚠ ${issues.join(', ')}` : ''}`);
      cards.push({ rubric: s.rubric, title: card.title, issues, photo: photo ? `${card.photo_query} → ${photo.credit}` : pexelsOn() ? `${card.photo_query} → aucune photo` : undefined } as never);
    } catch (e) {
      if (e instanceof AiStopped) {
        // Plafond atteint en cours d'écriture : les cartes déjà écrites restent, les autres attendent le prochain passage.
        if (!stopped) log(`   ■ ${(stopped = e.message)}`);
        queue.length = 0;
        return;
      }
      failed++;
      log(`   ✗ [${s.rubric}] ${s.label} : ${e instanceof Error ? e.message : e}`);
      cards.push({ rubric: s.rubric, title: s.label, issues: [], error: e instanceof Error ? e.message : String(e) });
    }
  };
  // Quelques cartes en parallèle, pas plus.
  const queue = TEST ? sorted.slice(0, TEST_CARDS) : [...sorted];
  if (TEST && sorted.length > TEST_CARDS) log(`   Mode test : ${TEST_CARDS} cartes écrites sur ${sorted.length} sujets retenus, pour limiter le coût.`);
  await Promise.all(Array.from({ length: Math.min(cfg.aiConcurrency(), queue.length) }, async () => {
    while (queue.length) await work(queue.shift()!);
  }));

  log('4/4 Édition');
  const stats = { fetched, window: raws.length, items: items.length, proposed: proposed.length, stories: stories.length, written, flagged, fixed, failed, model: model(), ai: { ...usage } };
  const summary = `${UPDATE ? 'Mise à jour : ' : ''}${fetched} titres lus, ${items.length} à traiter, ${stories.length} sujets retenus, ${written} cartes écrites (${fixed} corrigées par l'IA, ${flagged} à relire, ${failed} échecs).${stopped ? ` Arrêt : ${stopped}` : ''}`;
  if (TEST) {
    const msg = `Test (rien publié) : ${items.length} dépêches lues, ${stories.length} sujets retenus, ${written} cartes d'essai écrites (${flagged} avec alerte).`;
    log(`Terminé : ${msg}`);
    return J.finish('ok', msg, stats);
  }
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
    [DATE, live ? 'published' : !written && (failed || stopped) ? 'building' : 'ready', JSON.stringify(stats)], // tout a échoué : le prochain essai refera l'édition
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
