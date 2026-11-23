/**
 * Dernière minute : tourne toutes les 10 minutes de 6 h à 23 h.
 * Lit les sources, garde les dépêches des deux dernières heures, l'IA retient les faits majeurs
 * confirmés par deux médias, publiés aussitôt (FLASH_AUTO_PUBLISH=0 pour les garder masqués jusqu'à validation).
 *
 * --test (mode test du back office) : l'IA propose comme d'habitude, rien n'est publié.
 *
 * Usage : npm run flash -- [--fixtures test/feeds] [--test]
 */
import './settings.js'; // en premier : base à jour + réglages du back office
import { pool, q } from './db.js';
import { collect } from './collect.js';
import { startJournal, type Journal } from './journal.js';
import { AiStopped, budget, model, checkFlash, selectFlashes, setRubricHints, usage, type Item } from './ai.js';
import { dedupe, type Raw } from './dedupe.js';
import { cfg, snapshot } from './config.js';
import { moderate } from './moderate.js';
import { sendTopicAlerts } from './alerts.js';
import { pauseMessage } from './pause.js';

const args = process.argv.slice(2);
const fx = args.indexOf('--fixtures');
const FIXTURES = fx >= 0 ? args[fx + 1] : undefined;
const AUTO = cfg.flashAutoPublish();
const TEST = args.includes('--test');
let J: Journal;
const log = (...a: unknown[]) => J.log(...a);


async function main() {
  J = await startJournal('flash');
  try {
    await flash();
    if (!TEST) await alerts();
  } catch (e) {
    if (e instanceof AiStopped) { log(e.message); await alerts(); return J.finish('ok', e.message, { model: model(), ai: { ...usage } }); }
    log(`Erreur : ${e instanceof Error ? e.message : e}`);
    await J.finish('error', `Échec : ${e instanceof Error ? e.message : e}`);
    throw e;
  }
}

// Alertes des sujets suivis (infos de la journée et Dernière minute). Une panne ici n'arrête rien.
async function alerts() {
  await sendTopicAlerts().catch((e) => console.error(`Alertes sujets impossibles : ${e instanceof Error ? e.message : e}`));
}

async function flash() {
  J.details.config = snapshot('flash');
  // Abonnements Premium arrivés à échéance (même moteur en pause : c'est de l'argent, pas du contenu).
  const ended = await q<{ n: number }>('select public.expire_premium() as n').catch(() => [{ n: 0 }]);
  if (ended[0]?.n) log(`Premium : ${ended[0].n} abonnement(s) arrivé(s) à échéance`);
  await q('select public.ad_purge()').catch(() => {}); // détail des affichages pub de plus de 35 jours (les totaux restent)
  if (TEST) { J.details.test = true; log('Mode test : rien n’est publié.'); }
  if (cfg.paused() && !TEST) { const msg = await pauseMessage(); log(msg); return J.finish('ok', msg, { paused: true }); }
  await budget.check(); // IA coupée ou budget atteint : arrêt propre (voir main), ni modération ni Dernière minute
  const mod = TEST ? null : await moderate(log).catch((e) => { log(`Modération impossible : ${e instanceof Error ? e.message : e}`); return null; });
  if (mod?.ai) { J.details.moderation = mod.done; J.details.moderation_ai = mod.ai; }
  if (!cfg.flashEnabled()) return J.finish('ok', 'Dernière minute désactivée dans les réglages.');
  const todayCount = (await q<{ n: number }>("select count(*)::int as n from flashes where published_at > date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris'"))[0].n;
  if (todayCount >= cfg.flashMaxPerDay() && !TEST) return J.finish('ok', `Plafond atteint : ${todayCount} infos aujourd'hui (réglage : ${cfg.flashMaxPerDay()}).`);
  const fetched = await collect(FIXTURES, log);
  const used = new Set((await q<{ id: string }>("select unnest(raw_item_ids)::text as id from flashes where created_at > now() - interval '24 hours'")).map((r) => r.id));
  const H = cfg.flashWindowHours();
  const raws = dedupe((await q<Raw>(
    `select r.id, r.title, r.description, r.link, r.published_at, s.name as source, s.rubric_hint as hint
       from raw_items r join sources s on s.id = r.source_id
      where coalesce(r.published_at, r.fetched_at) > now() - make_interval(hours => $1) ${FIXTURES ? "or true" : ''}
      order by coalesce(r.published_at, r.fetched_at) desc limit 400`, [H],
  )).filter((r) => !used.has(r.id))).slice(0, 250);
  log(`${fetched} titres lus, ${raws.length} dépêches des ${H} dernières heures pas encore utilisées.`);
  if (raws.length < 2) return J.finish('ok', `${fetched} titres lus, rien de neuf depuis ${H} h.`, { fetched, items: raws.length, published: 0 });
  setRubricHints(await q<{ id: string; name: string; ai_hint: string | null }>('select id, name, ai_hint from rubrics').catch(() => []));
  const items: Item[] = raws.map((r, k) => ({ n: k + 1, source: r.source, title: r.title, description: r.description, publishedAt: r.published_at?.toISOString() ?? null, hint: r.hint }));
  const today = (await q<{ title: string }>("select title from flashes where published_at > now() - interval '18 hours' order by published_at")).map((r) => r.title);

  // Minimum par jour : sur 6 h-23 h, combien d'infos la journée devrait-elle déjà compter ? En retard = seuil abaissé.
  const parts = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) + Number(parts.find((p) => p.type === 'minute')?.value ?? 0) / 60;
  const minDay = Math.min(cfg.flashMinPerDay(), cfg.flashMaxPerDay());
  const due = minDay ? Math.min(minDay, Math.ceil(minDay * Math.min(1, Math.max(0, (hour - 6) / 17)))) : 0;
  const behind = Math.max(0, due - todayCount);
  const normal = cfg.flashMinImportance();
  const relaxed = Math.min(normal, cfg.flashRelaxImportance());
  const catchUp = behind > 0 && relaxed < normal;
  if (catchUp) log(`Rythme : ${todayCount} info(s) aujourd'hui pour ${due} attendue(s) à cette heure (minimum ${minDay} par jour) : importance ${relaxed} acceptée pour ${behind} info(s).`);
  J.details.rythme = { aujourdhui: todayCount, attendues: due, minimum: minDay, seuil: catchUp ? relaxed : normal };

  const found = (await selectFlashes(items, today, catchUp ? relaxed : normal, catchUp)).sort((a, b) => b.importance - a.importance);
  log(`L'IA propose ${found.length} info(s)${catchUp ? '' : ' majeure(s)'}.`);
  let extra = 0; // infos publiées grâce au seuil abaissé
  const kept: { title: string; sources: string[]; rejected?: string }[] = (J.details.flashes = []) as never;
  let n = 0;
  for (const f of found) {
    const issues = checkFlash(f, items, catchUp ? relaxed : normal);
    const isExtra = f.importance < normal;
    if (isExtra && extra >= behind) issues.push('minimum du jour déjà rattrapé');
    if (todayCount + n >= cfg.flashMaxPerDay()) issues.push(`plafond de ${cfg.flashMaxPerDay()} infos par jour atteint`);
    if (issues.length) {
      log(`  écartée : ${f.title} (${issues.join(', ')})`);
      kept.push({ title: f.title, sources: f.item_numbers.map((k) => items[k - 1]?.source).filter(Boolean), rejected: issues.join(', ') });
      continue;
    }
    const its = f.item_numbers.map((k) => raws[k - 1]).filter(Boolean);
    if (TEST) { n++; log(`  ⚡ (test) ${f.title} — ${f.sentence}`); kept.push({ title: `${f.title} — ${f.sentence}`, sources: [...new Set(its.map((r) => r.source))] }); continue; }
    const sources = [...new Map(its.map((r) => [r.source, { source: r.source, url: r.link }])).values()];
    await q(
      `insert into flashes (status, rubric_id, importance, title, sentence, sources, raw_item_ids, model, sensitive)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [AUTO ? 'published' : 'hidden', f.rubric, Math.min(10, Math.max(1, f.importance)), f.title.slice(0, 90), f.sentence.slice(0, 220), JSON.stringify(sources), its.flatMap((r) => [r.id, ...(r.dups ?? [])]), model(),
       // Sujet sensible : jamais d'alerte aux lecteurs qui suivent ce sujet (IA, et mots qui ne trompent pas en filet).
       !!f.sensitive || /\bmorts?\b|attentat|tué|décès/i.test(f.title + ' ' + f.sentence)],
    );
    n++;
    if (isExtra) extra++;
    log(`  ⚡ ${f.title}${isExtra ? ` (importance ${f.importance}, pour tenir le minimum du jour)` : ''}`);
    kept.push({ title: f.title, sources: sources.map((x) => x.source) });
  }
  const summary = TEST ? `Test (rien publié) : ${items.length} dépêches récentes, ${n} info(s) que l'IA aurait publiée(s).` : `${fetched} titres lus, ${items.length} dépêches récentes, ${n} info(s) publiée(s).`;
  log(`Dernière minute : ${summary}`);
  await J.finish('ok', summary, { fetched, items: items.length, proposed: found.length, published: n, model: model(), ai: { ...usage } });
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => pool.end());
