// Données fictives : le back office fonctionne sans Supabase pour qu'on puisse l'essayer.
import type { Api, Article, Comment, Edition, Profile, Report, Source } from './data';

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
].map(([name, url, rubric_hint, last_error], i) => ({ id: `s${i}`, name: name!, url: url!, rubric_hint, active: true, last_fetch_at: iso(4), last_error }));
let comments: Comment[] = [
  ['Enfin une info claire, sans titre racoleur.', 'Camille_R', 'a1', 'visible'], ['Les sources en un tap, c’est vraiment pratique.', 'nico.dlt', 'a5', 'visible'],
  ['Encore une grève, ils exagèrent vraiment tous ces…', 'anonyme42', 'a1', 'visible'], ['Lu dans le métro en 30 secondes, parfait.', 'Inès', 'a4', 'visible'],
].map(([text, pseudo, article_id, status], i) => ({ id: `c${i}`, article_id: article_id!, user_id: `u${i}`, text: text!, status: status as Comment['status'], created_at: iso(i + 1), pseudo, article_title: articles.find((a) => a.id === article_id)?.title }));
let reports: Report[] = [{ id: 'r1', comment_id: 'c2', reason: 'Propos agressifs', resolved: false, created_at: iso(1) }];
let team: Profile[] = [
  { id: 'u-admin', pseudo: 'fen', role: 'admin', premium: true, created_at: iso(200) },
  { id: 'u-ed', pseudo: 'redaction_matin', role: 'editor', premium: false, created_at: iso(100) },
];
const readers: Profile[] = [{ id: 'u0', pseudo: 'Camille_R', role: 'reader', premium: false, created_at: iso(50) }];

const wait = <T>(v: T) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), 120));
let signed = false;

export function demoApi(): Api {
  return {
    demo: true,
    me: () => wait(signed ? { id: 'u-admin', email: 'demo@titre.app', role: 'admin' as const } : null),
    async signIn() { signed = true; return null; },
    async signOut() { signed = false; },
    editions: () => wait(editions),
    articles: (date) => wait(articles.filter((a) => a.edition_date === date)),
    async saveArticle(id, patch) { articles = articles.map((a) => (a.id === id ? { ...a, ...patch } : a)); },
    async saveArticles(ps) { ps.forEach((p) => (articles = articles.map((a) => (a.id === p.id ? { ...a, ...p.patch } : a)))); },
    async setEdition(date, status) { const e = editions.find((x) => x.date === date); if (e) { e.status = status; e.published_at = status === 'published' ? new Date().toISOString() : null; } },
    sources: () => wait(sources),
    async saveSource(s) { sources = s.id ? sources.map((x) => (x.id === s.id ? { ...x, ...s } : x)) : [...sources, { id: `s${Date.now()}`, name: '', url: '', rubric_hint: null, active: true, last_fetch_at: null, last_error: null, ...s }]; },
    reports: () => wait(reports.filter((r) => !r.resolved).map((r) => ({ ...r, comment: comments.find((c) => c.id === r.comment_id) }))),
    async resolveReport(r, hide) { if (hide) comments = comments.map((c) => (c.id === r.comment_id ? { ...c, status: 'hidden' } : c)); reports = reports.map((x) => (x.comment_id === r.comment_id ? { ...x, resolved: true } : x)); },
    comments: () => wait(comments),
    async setComment(id, status) { comments = comments.map((c) => (c.id === id ? { ...c, status } : c)); },
    team: () => wait(team.filter((p) => p.role !== 'reader')),
    async setRole(id, role) {
      const r = readers.find((p) => p.id === id);
      if (r && !team.includes(r)) team.push(r);
      team = team.map((p) => (p.id === id ? { ...p, role } : p));
    },
    findProfile: async (pseudo) => wait([...team, ...readers].find((p) => p.pseudo?.toLowerCase() === pseudo.toLowerCase()) ?? null),
  };
}
