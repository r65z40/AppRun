// Données fictives : le back office fonctionne sans Supabase pour qu'on puisse l'essayer.
import { RUBRICS, type Api, type AppMessage, type Article, type AuditEntry, type Dashboard, type EngineStatus, type Comment, type EngineRun, type Setting, type Edition, type Flash, type Profile, type Report, type RubricHint, type Source } from './data';

const today = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());
const yday = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date(Date.now() - 86400e3));
const iso = (h: number) => new Date(Date.now() - h * 3600e3).toISOString();

let n = 0;
const art = (rubric_id: string, title: string, key_sentence: string, facts: [string, string][], summary: string[], extra: Partial<Article> = {}): Article => ({
  id: `a${++n}`, edition_date: today, rubric_id, status: 'draft', rank: 0, importance: 5, essential: false, title, key_sentence,
  facts: facts.map(([text, source]) => ({ text, source, url: `https://exemple.test/${source.toLowerCase().replace(/\W+/g, '-')}/${n}` })),
  summary, photo_tag: 'facade', photo_url: null, review_notes: [], model: 'claude-opus-5-5', published_at: null, created_at: iso(3), ...extra,
});

let articles: Article[] = [
  art('france', 'Grève SNCF : un TGV sur deux lundi', 'Les contrôleurs protestent contre la réforme de leurs primes ; le trafic sera très perturbé lundi.', [
    ['<b>1 TGV sur 2</b> circulera lundi selon la SNCF', 'franceinfo'], ['Aucun accord trouvé lors de la réunion de <b>vendredi</b>', 'Le Monde'], ['Les TER sont touchés dans <b>7 régions</b>', 'franceinfo'],
  ], ['Les syndicats contestent depuis octobre la réforme des primes des contrôleurs.', 'Lundi, un TGV sur deux et une partie des TER seront supprimés.', 'Une nouvelle réunion est prévue mardi au ministère.'], { essential: true, importance: 9, photo_tag: 'train' }),
  art('france', 'Budget 2027 adopté en première lecture', 'Les députés ont voté le projet de loi de finances dans la nuit de vendredi à samedi.', [
    ['Adopté par <b>289 voix</b> contre 260', 'franceinfo'], ['Le déficit visé est de <b>4,6 %</b> du PIB', 'Les Echos'], ['Le texte part au Sénat le <b>25 novembre</b>', 'Le Monde'],
  ], ['Le gouvernement veut réduire le déficit public.', 'Le budget prévoit 30 milliards d’euros d’économies.', 'Le Sénat l’examine à partir du 25 novembre.'], { importance: 8, rank: 1 }),
  art('france', 'Neige : 12 départements en vigilance orange', 'Météo-France annonce jusqu’à 15 cm de neige en plaine dès dimanche soir.', [
    ['<b>12 départements</b> en vigilance orange', 'franceinfo'], ['Jusqu’à <b>15 cm</b> en plaine', 'franceinfo'], ['Poids lourds interdits sur l’<b>A7</b> dimanche', 'Ouest-France'],
  ], ['Une masse d’air froid arrive du nord.', 'La circulation sera difficile dimanche soir et lundi matin.', 'Le redoux est attendu mercredi.'], { rank: 2, photo_tag: 'neige', review_notes: ['reprise mot pour mot d’un média'] }),
  art('monde', 'Ukraine : nouvelles négociations à Genève', 'Les délégations se retrouvent mardi sous l’égide de l’ONU pour discuter d’un cessez-le-feu.', [
    ['Rencontre prévue <b>mardi</b> à Genève', 'Le Monde'], ['Médiation de l’<b>ONU</b>', 'RFI'], ['Premier échange direct depuis <b>mars</b>', 'France 24'],
  ], ['Les discussions étaient gelées depuis le printemps.', 'Un cessez-le-feu partiel sera au menu.', 'Une déclaration commune est espérée vendredi.'], { essential: true, importance: 9, photo_tag: 'fjord' }),
  art('eco', 'Inflation à 1,4 % sur un an', 'L’Insee confirme le ralentissement des prix, porté par la baisse de l’énergie.', [
    ['<b>1,4 %</b> sur un an en octobre', 'Les Echos'], ['L’énergie recule de <b>3,2 %</b>', 'Les Echos'], ['L’alimentation progresse de <b>1,1 %</b>', 'franceinfo'],
  ], ['Les prix avaient fortement augmenté en 2022 et 2023.', 'Le pouvoir d’achat progresse légèrement.', 'La BCE se réunit le 11 décembre.'], { photo_tag: 'batiment', status: 'published', published_at: iso(1) }),
  art('tech', 'IA médicale : une start-up lyonnaise lève 120 M€', 'Son logiciel aide les radiologues à repérer plus tôt certains cancers.', [
    ['<b>120 millions d’euros</b> levés', 'Les Echos'], ['Déjà utilisé dans <b>40 hôpitaux</b>', 'Numerama'], ['<b>200 embauches</b> prévues', 'Les Echos'],
  ], ['L’imagerie médicale est un terrain clé de l’IA.', 'L’argent servira à se lancer aux États-Unis.', 'Une autorisation américaine est attendue en 2027.'], { photo_tag: 'lampe' }),
  art('sport', 'Ligue des champions : le PSG gagne 3-1 à Munich', 'Les Parisiens prennent une option sur la qualification grâce à un doublé en seconde période.', [
    ['Victoire <b>3-1</b> à Munich', 'L’Équipe'], ['Doublé en <b>seconde période</b>', 'L’Équipe'], ['Match retour le <b>3 décembre</b>', 'L’Équipe'],
  ], ['Le PSG restait sur deux défaites en Europe.', 'Il prend la tête de son groupe.', 'Le retour se joue au Parc des Princes.'], { photo_tag: 'sommet', review_notes: ['fait 2 sans source valable'] }),
];
const editions: Edition[] = [
  { date: today, status: 'ready', published_at: null, stats: { fetched: 412, items: 318, stories: 7, written: 7, flagged: 2, failed: 0, model: 'claude-opus-5-5' } },
  { date: yday, status: 'published', published_at: iso(30), stats: { fetched: 398, items: 301, stories: 42, written: 41, flagged: 5, failed: 1 } },
];
let sources: Source[] = [
  ['franceinfo', 'https://www.francetvinfo.fr/titres.rss', null, null], ['Le Monde', 'https://www.lemonde.fr/rss/une.xml', null, null],
  ['Les Echos', 'https://syndication.lesechos.fr/rss/rss_une.xml', 'eco', null], ['Numerama', 'https://www.numerama.com/feed/', 'tech', null],
  ['L’Équipe', 'https://dwh.lequipe.fr/api/edito/rss?path=/', 'sport', null], ['RFI', 'https://www.rfi.fr/fr/rss', 'monde', 'HTTP 404'],
].map(([name, url, rubric_hint, last_error], i) => ({ id: `s${i}`, name: name!, url: url!, rubric_hint, active: true, last_fetch_at: iso(4), last_error,
  last_count: last_error ? null : 20 + i * 7, last_item_at: last_error ? null : iso(1 + i), fail_count: last_error ? 3 : 0, items_24h: last_error ? 0 : 18 + i * 5, cards_7d: last_error ? 0 : 4 + i * 3 }));
let rubricHints: RubricHint[] | null = null; // rempli à la première lecture (RUBRICS vient de data.ts, chargé après ce fichier)
let comments: Comment[] = [
  ['Enfin une info claire, sans titre racoleur.', 'Camille_R', 'a1', 'visible'], ['Les sources en un tap, c’est vraiment pratique.', 'nico.dlt', 'a5', 'visible'],
  ['Encore une grève, ils exagèrent vraiment tous ces…', 'anonyme42', 'a1', 'visible'], ['Lu dans le métro en 30 secondes, parfait.', 'Inès', 'a4', 'visible'],
].map(([text, pseudo, article_id, status], i) => ({ id: `c${i}`, article_id: article_id!, user_id: `u${i}`, text: text!, status: status as Comment['status'], created_at: iso(i + 1), pseudo, article_title: articles.find((a) => a.id === article_id)?.title }));
let reports: Report[] = [{ id: 'r1', comment_id: 'c2', reason: 'Propos agressifs', resolved: false, created_at: iso(1) }];
let team: Profile[] = [
  { id: 'u-admin', pseudo: 'fen', email: 'admin@exemple.fr', role: 'admin', premium: true, created_at: iso(200) },
  { id: 'u-ed', pseudo: 'redaction_matin', email: 'redaction@exemple.fr', role: 'editor', premium: false, created_at: iso(100) },
];
const fl = (min: number, title: string, sentence: string, srcs: string[], extra: Partial<Flash> = {}): Flash => ({
  id: `f${min}`, status: 'published', rubric_id: 'monde', importance: 8, title, sentence, manual: false, model: 'claude-opus-5-5',
  sources: srcs.map((s) => ({ source: s, url: `https://exemple.test/${s.toLowerCase().replace(/\W+/g, '-')}` })),
  published_at: new Date(Date.now() - min * 60000).toISOString(), created_at: new Date(Date.now() - min * 60000).toISOString(), ...extra,
});
let messages: AppMessage[] = [
  { id: 'm1', title: 'Nouveau : réagissez avec un emoji', body: 'Touchez le visage sous une info pour choisir votre réaction.', audience: 'all', active: false, ends_at: null, created_at: new Date(Date.now() - 86400e3).toISOString() },
];
let flashes: Flash[] = [
  fl(12, 'Séisme de magnitude 6,1 au large de la Grèce', 'La secousse a été ressentie jusqu’à Athènes. Aucune victime signalée pour l’instant selon les autorités grecques.', ['franceinfo', 'RFI']),
  fl(74, 'La BCE baisse ses taux de 0,25 point', 'Le principal taux directeur passe à 1,75 %. C’est la troisième baisse depuis l’été.', ['Les Echos', 'Le Monde'], { rubric_id: 'eco', importance: 9 }),
  fl(185, 'Accord trouvé sur le budget au Sénat', 'Sénateurs et députés se sont entendus sur une version commune du texte, votée définitivement mardi.', ['Le Monde', '20 Minutes'], { rubric_id: 'france' }),
  fl(260, 'Un joueur du PSG transféré pour 90 M€', 'Information non confirmée par le club à cette heure.', ['L’Équipe', 'RMC Sport'], { rubric_id: 'sport', status: 'hidden' }),
  fl(320, 'Tempête : 80 000 foyers privés d’électricité', 'Les rafales ont dépassé 130 km/h en Bretagne. Enedis prévoit un retour à la normale d’ici demain soir.', ['Ouest-France', 'franceinfo'], { rubric_id: 'france', manual: true, model: null }),
];
// Ce que le moteur « écrit » quand on le lance dans la démo.
const SIMULATED: Article[] = [
  art('tech', 'L’Europe impose le chargeur universel aux PC', 'Dès 2027, tous les ordinateurs portables vendus dans l’UE devront se charger en USB-C.', [
    ['Obligation à partir du <b>28 avril 2027</b>', 'Numerama'], ['Concerne aussi les <b>tablettes et liseuses</b>', 'Le Monde'], ['Bruxelles vise <b>11 000 tonnes</b> de déchets en moins', 'franceinfo'],
  ], ['Les smartphones sont déjà concernés depuis 2024.', 'Les fabricants de PC doivent adapter leurs prises.', 'Des contrôles seront menés par chaque pays.'], { importance: 6, photo_tag: 'lampe', created_at: new Date().toISOString() }),
  art('culture', 'Le Louvre ouvre une nouvelle entrée', 'Un accès par la Colonnade doit désengorger la pyramide, saturée aux heures de pointe.', [
    ['Ouverture prévue en <b>2031</b>', 'Le Monde'], ['Coût estimé : <b>700 M€</b>', 'Les Echos'], ['<b>8,7 millions</b> de visiteurs en 2025', 'franceinfo'],
  ], ['La pyramide a été conçue pour 4 millions de visiteurs.', 'Une seconde entrée et de nouvelles salles.', 'Un concours d’architectes sera lancé l’an prochain.'], { importance: 5, photo_tag: 'batiment', created_at: new Date().toISOString() }),
  art('monde', 'Élections au Chili : second tour serré', 'Les deux candidats sont au coude-à-coude selon les derniers sondages, publiés vendredi.', [
    ['Écart de <b>2 points</b> dans les sondages', 'RFI'], ['Participation attendue au-dessus de <b>80 %</b>', 'Le Monde'], ['Résultats attendus <b>dimanche soir</b>', 'franceinfo'],
  ], ['Le vote est obligatoire au Chili depuis 2022.', 'Le nouveau président entrera en fonction en mars.', 'Le Parlement reste divisé.'], { importance: 6, photo_tag: 'sommet', review_notes: ['fait 2 : vérifier le chiffre'], created_at: new Date().toISOString() }),
];
const at = (min: number) => new Date(Date.now() - min * 60000).toISOString();
let runs: EngineRun[] = [
  { id: 'r3', kind: 'flash', status: 'ok', started_at: at(9), finished_at: at(8), summary: '226 titres lus, 41 dépêches récentes, 1 info(s) publiée(s).', stats: {},
    log: ['20:11:02 226 titres lus, 41 dépêches des 2 dernières heures pas encore utilisées.', "20:11:09 L'IA propose 2 info(s) majeure(s).", '20:11:09   ⚡ Séisme de magnitude 6,1 au large de la Grèce', '20:11:09   écartée : Un joueur du PSG transféré pour 90 M€ (une seule source)'],
    details: { flashes: [{ title: 'Séisme de magnitude 6,1 au large de la Grèce', sources: ['franceinfo', 'RFI'] }, { title: 'Un joueur du PSG transféré pour 90 M€', sources: ['L’Équipe'], rejected: 'une seule source' }] } },
  { id: 'r2', kind: 'flash', status: 'ok', started_at: at(29), finished_at: at(28), summary: '224 titres lus, 37 dépêches récentes, 0 info(s) publiée(s).', stats: {}, log: ['19:51:03 224 titres lus, 37 dépêches des 2 dernières heures pas encore utilisées.', "19:51:08 L'IA propose 0 info(s) majeure(s)."], details: { flashes: [] } },
  { id: 'r1', kind: 'edition', status: 'ok', started_at: at(15 * 60), finished_at: at(15 * 60 - 6), summary: '412 titres lus, 318 à traiter, 7 sujets retenus, 7 cartes écrites (2 à relire, 0 échecs).', stats: {},
    log: ['05:30:04 Édition du jour · modèle claude-opus-5-5', '05:30:05 1/4 Récupération des sources', '05:30:06   franceinfo : 30 titres', '05:30:07   Les Echos : échec (HTTP 503)', '05:30:20    412 titres lus, 318 publiés dans les 30 dernières heures, dont 318 pas encore traités', '05:30:20 2/4 Choix des sujets', '05:30:41    7 sujets retenus sur 318 titres', '05:30:41 3/4 Écriture des cartes', '05:31:02    ✓ [france] Grève SNCF : un TGV sur deux lundi', '05:31:40 Terminé : 7 cartes écrites (2 à relire, 0 échecs).'],
    details: {
      stories: [
        { label: 'Grève SNCF lundi', rubric: 'france', importance: 9, essential: true, items: [{ source: 'franceinfo', title: 'Grève à la SNCF : un TGV sur deux lundi' }, { source: 'Le Monde', title: 'Les contrôleurs appelés à la grève' }] },
        { label: 'Budget 2027 à l’Assemblée', rubric: 'france', importance: 8, essential: false, items: [{ source: 'franceinfo', title: 'Le budget adopté en première lecture' }] },
      ],
      left: [{ source: 'L’Équipe', title: 'Les notes du match' }, { source: 'Numerama', title: 'Le meilleur forfait mobile du moment' }],
      cards: [{ rubric: 'france', title: 'Grève SNCF : un TGV sur deux lundi', issues: [] }, { rubric: 'sport', title: 'Le PSG s’impose à Munich', issues: ['fait 2 sans source valable'] }],
    } },
];
let settings: Setting[] = [{ key: 'ANTHROPIC_API_KEY', value: '••••x7Qa', is_set: true, updated_at: new Date().toISOString() }, { key: 'TITRE_MODEL', value: 'claude-opus-5-5', is_set: true, updated_at: new Date().toISOString() }];
const readers: Profile[] = [{ id: 'u0', pseudo: 'Camille_R', role: 'reader', premium: false, created_at: iso(50) }];

const wait = <T>(v: T) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), 120));
let signed = false;
const audit: AuditEntry[] = [
  { at: at(7), who: 'IA / moteur', action: 'Commentaire masqué', target: '« Encore une grève, ils exagèrent vraiment tous ces… »', detail: 'IA : propos généralisant et agressif envers un groupe.' },
  { at: at(7), who: 'IA / moteur', action: 'Commentaire rétabli', target: '« Les sources en un tap, c’est vraiment pratique. »', detail: 'IA : avis positif, aucun problème.' },
  { at: at(95), who: 'redaction_matin', action: 'Info publiée', target: 'Inflation à 1,4 % sur un an', detail: null },
  { at: at(300), who: 'fen', action: 'Réglage modifié', target: 'AUTO_PUBLISH', detail: '1' },
];

export function demoApi(): Api {
  return {
    demo: true,
    me: () => wait(signed ? { id: 'u-admin', email: 'demo@titre.app', role: 'admin' as const } : null),
    async signIn() { signed = true; return null; },
    async needsAdmin() { return false; },
    async signUp() { signed = true; return null; },
    async resetPassword() { return null; },
    async resendConfirm() { return null; },
    async updatePassword() { return null; },
    settings: () => wait(settings),
    async setSetting(key, value) {
      settings = settings.filter((s) => s.key !== key);
      if (value.trim()) settings.push({ key, value: key.endsWith('_KEY') ? '••••' + value.trim().slice(-4) : value.trim(), is_set: true, updated_at: new Date().toISOString() });
    },
    async signOut() { signed = false; },
    editions: () => wait(editions),
    articles: (date) => wait(articles.filter((a) => a.edition_date === date)),
    async saveArticle(id, patch) { articles = articles.map((a) => (a.id === id ? { ...a, ...patch } : a)); },
    async saveArticles(ps) { ps.forEach((p) => (articles = articles.map((a) => (a.id === p.id ? { ...a, ...p.patch } : a)))); },
    async setEdition(date, status) { const e = editions.find((x) => x.date === date); if (e) { e.status = status; e.published_at = status === 'published' ? new Date().toISOString() : null; } },
    async createArticle(a) {
      if (!editions.some((e) => e.date === a.edition_date)) editions.unshift({ date: a.edition_date, status: 'building', published_at: null, stats: {} });
      const rank = articles.filter((x) => x.edition_date === a.edition_date && x.rubric_id === a.rubric_id).length;
      articles = [...articles, { ...art(a.rubric_id, '', '', [], []), model: null, photo_tag: null, ...a, rank }];
    },
    async runEngine(onStep) {
      const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const fresh = SIMULATED.filter((s) => !articles.some((a) => a.title === s.title));
      onStep('Lecture des 10 sources (titres et chapôs)…'); await pause(900);
      onStep(`${180 + fresh.length * 17} titres lus. Choix des sujets…`); await pause(1100);
      if (!fresh.length) { onStep('Rien de nouveau depuis le dernier passage.'); return; }
      for (const [i, s] of fresh.entries()) { onStep(`Écriture ${i + 1}/${fresh.length} : ${s.title}`); await pause(700); }
      onStep('Contrôles : longueur, sources, copie mot pour mot…'); await pause(700);
      const e = editions.find((x) => x.date === today);
      fresh.forEach((s) => { articles = [...articles, { ...s, rank: articles.filter((x) => x.edition_date === today && x.rubric_id === s.rubric_id).length }]; });
      if (e) e.stats = { ...e.stats, stories: Number(e.stats.stories ?? 0) + fresh.length, written: Number(e.stats.written ?? 0) + fresh.length };
      const flagged = fresh.filter((s) => s.review_notes.length).length;
      onStep(`Terminé : ${fresh.length} brouillons ajoutés${flagged ? `, dont ${flagged} à relire` : ''}.`);
    },
    runs: () => wait(runs),
    messages: () => wait(messages),
    async saveMessage(m) {
      if (m.id) messages = messages.map((x) => (x.id === m.id ? { ...x, ...m } : x));
      else messages = [{ id: `m${Date.now()}`, title: '', body: '', audience: 'all', active: true, ends_at: null, created_at: new Date().toISOString(), ...m }, ...messages];
    },
    async deleteMessage(id) { messages = messages.filter((x) => x.id !== id); },
    flashes: () => wait(flashes),
    async saveFlash(f) {
      if (f.id) flashes = flashes.map((x) => (x.id === f.id ? { ...x, ...f } : x));
      else flashes = [fl(0, '', '', [], { manual: true, model: null, id: `f${Date.now()}`, ...f }), ...flashes];
    },
    sources: () => wait(sources),
    async deleteSource(id) { sources = sources.filter((x) => x.id !== id); },
    aiSpend: () => wait({ today: 1.84, month: 37.5 }),
    aiSpendHistory: () => wait(Array.from({ length: 14 }, (_, k) => ({ day: new Date(Date.now() - k * 86400e3).toISOString().slice(0, 10), edition: k ? 1.1 + (k % 3) * 0.3 : 1.2, flash: k ? 0.6 + (k % 2) * 0.2 : 0.64, runs: k ? 120 : 64 }))),
    unpublishRun: () => wait({ articles: 12, flashes: 1 }),
    dispatchStatus: () => wait({ cron: true, token: false, last: null }),
    rubrics: () => wait((rubricHints ??= Object.entries(RUBRICS).map(([id, name]) => ({ id, name, ai_hint: null })))),
    async saveRubricHint(id, ai_hint) { rubricHints = (rubricHints ?? []).map((r) => (r.id === id ? { ...r, ai_hint: ai_hint.trim() || null } : r)); },
    async saveSource(s) { sources = s.id ? sources.map((x) => (x.id === s.id ? { ...x, ...s } : x)) : [...sources, { id: `s${Date.now()}`, name: '', url: '', rubric_hint: null, active: true, last_fetch_at: null, last_error: null, ...s }]; },
    reports: () => wait(reports.filter((r) => !r.resolved).map((r) => ({ ...r, comment: comments.find((c) => c.id === r.comment_id) }))),
    async resolveReport(r, hide) { if (hide) comments = comments.map((c) => (c.id === r.comment_id ? { ...c, status: 'hidden' } : c)); reports = reports.map((x) => (x.comment_id === r.comment_id ? { ...x, resolved: true } : x)); },
    comments: () => wait(comments),
    async setComment(id, status) { comments = comments.map((c) => (c.id === id ? { ...c, status } : c)); },
    async setBanned(id, ban, reason) {
      const p = readers.find((x) => x.id === id) ?? { id, pseudo: comments.find((c) => c.user_id === id)?.pseudo ?? null, role: 'reader' as const, premium: false, created_at: iso(20) };
      if (!readers.includes(p)) readers.push(p);
      p.banned = ban; p.suspended_until = null; p.ban_reason = ban ? reason ?? null : null;
      if (ban) comments = comments.map((c) => (c.user_id === id ? { ...c, status: 'hidden' } : c));
    },
    async suspend(id, days, reason) {
      await this.setBanned(id, false);
      const p = readers.find((x) => x.id === id)!;
      p.suspended_until = days ? new Date(Date.now() + days * 864e5).toISOString() : null; p.ban_reason = days ? reason ?? null : null;
    },
    banned: () => wait(readers.filter((p) => p.banned || (p.suspended_until ?? '') > new Date().toISOString())),
    dashboard: () => wait<Dashboard>({
      active_today: 1284, active_7: 4610, active_30: 9873, accounts: 742, accounts_7: 96, premium: 0, comments_7: 318, likes_7: 2240,
      reports_open: reports.filter((r) => !r.resolved).length, banned: readers.filter((p) => p.banned).length, ai_today: 1.84, ai_7: 12.9, ai_30: 51.3,
      last_runs: [{ kind: 'edition', status: 'ok', started_at: at(15 * 60), finished_at: at(15 * 60 - 6), summary: runs[2].summary }, { kind: 'flash', status: 'error', started_at: at(9), finished_at: at(8), summary: 'Échec : clé Claude refusée (exemple de panne)' }],
    }),
    launchEngine: () => wait({ ok: true }),
    engineStatus: () => {
      const v = settings.find((x) => x.key === 'ENGINE_PAUSED');
      const paused = !!v && (v.value === '1' || new Date(v.value).getTime() > Date.now());
      return wait<EngineStatus>({
        paused, paused_until: paused && v!.value !== '1' ? v!.value : null, paused_at: paused ? v!.updated_at : null, paused_by: paused ? 'vous@exemple.fr' : null,
        ai_off: settings.some((x) => x.key === 'AI_OFF' && x.value === '1'), articles_today: 24, flashes_today: 2, last_published: at(12),
        failing_sources: [{ name: '20 Minutes', error: 'HTTP 403 (le média bloque les robots)', fails: 3 }],
        budget_day_pct: 92, budget_month_pct: 38, budget_alert: 80,
      });
    },
    uploadPhoto: async (file) => URL.createObjectURL(file),
    moderationCost: () => wait({ judged: 64, input: 182_400, output: 21_300, cost: 1.16 }),
    topArticles: () => wait(articles.slice(0, 4).map((a, i) => ({ title: a.title, rubric_id: a.rubric_id, likes: 412 - i * 87, comments: 38 - i * 9 }))),
    readers: (search, filter = 'all') => wait([...team, ...readers, ...comments.map((c) => ({ id: c.user_id, pseudo: c.pseudo ?? null, role: 'reader' as const, premium: false, created_at: iso(40) } as Profile))]
      .filter((p, i, all) => all.findIndex((x) => x.id === p.id) === i && (!search || p.pseudo?.toLowerCase().includes(search.toLowerCase())))
      .filter((p) => filter === 'all' || filter === 'reported' || (filter === 'banned' ? p.banned : filter === 'suspended' ? (p.suspended_until ?? '') > new Date().toISOString() : filter === 'team' ? p.role !== 'reader' : p.premium))
      .map((p, _, all) => ({ ...p, total: all.length, banned: !!p.banned, suspended_until: p.suspended_until ?? null, ban_reason: p.ban_reason ?? null, email: `${(p.pseudo ?? 'lecteur').toLowerCase()}@exemple.fr`, last_seen: today, comments: comments.filter((c) => c.user_id === p.id).length, hidden: comments.filter((c) => c.user_id === p.id && c.status === 'hidden').length, reports: reports.filter((r) => comments.find((c) => c.id === r.comment_id)?.user_id === p.id).length })).filter((p) => filter !== 'reported' || p.reports > 0)),
    readerDetail: (id) => wait({
      likes: 23, reports_made: 1, blocked_by: 0, days_30: 17,
      comments: comments.filter((c) => c.user_id === id).map((c) => ({ id: c.id, text: c.text, status: c.status, created_at: c.created_at, article: c.article_title ?? '…', reports: reports.filter((r) => r.comment_id === c.id).length })),
      history: audit.filter((e) => e.target === readers.find((p) => p.id === id)?.pseudo).map((e) => ({ at: e.at, action: e.action, detail: e.detail })),
    }),
    exportReader: (id) => wait({ exporte_le: new Date().toISOString(), compte: readers.find((p) => p.id === id) ?? { id }, commentaires: comments.filter((c) => c.user_id === id).map((c) => ({ texte: c.text, le: c.created_at })) }),
    async resetPseudo(id) { const p = 'lecteur' + Math.random().toString(16).slice(2, 8); const r = readers.find((x) => x.id === id); if (r) r.pseudo = p; return p; },
    async deleteUser(id) { comments = comments.filter((c) => c.user_id !== id); readers.splice(0, readers.length, ...readers.filter((p) => p.id !== id)); audit.unshift({ at: new Date().toISOString(), who: 'fen', action: 'Compte supprimé', target: id, detail: null }); },
    audit: () => wait(audit),
    team: () => wait(team.filter((p) => p.role !== 'reader')),
    async setRole(id, role) {
      const r = readers.find((p) => p.id === id);
      if (r && !team.includes(r)) team.push(r);
      team = team.map((p) => (p.id === id ? { ...p, role } : p));
    },
    findProfile: async (pseudo) => wait([...team, ...readers].find((p) => p.pseudo?.toLowerCase() === pseudo.toLowerCase()) ?? null),
  };
}
