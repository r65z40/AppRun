import { FLASHES, RUBRICS } from './content';
import { pickAds } from './ads';
import { RECOG, RULES } from './brand';
import type { Article, Badge, Column, Comment, Flash, Placement, ReaderCard, Tag } from './types';
import type { Pick } from './algo';

export const MEDIA = "D'après L'Écho national, Agence Presse Europe, Radio Horizon";

export const rubricOf = (a: Article) => RUBRICS.find((r) => r.items.includes(a))!;

export function summaryOf(a: Article): string[] {
  if (a.summary) return a.summary;
  const facts = a.facts.map((f) => f.text.replace(/<[^>]+>/g, '')).join(', ');
  return [
    `Ce sujet s'inscrit dans une tendance suivie depuis plusieurs mois. ${a.key}`,
    `Concrètement, les chiffres publiés ce jour confirment l'évolution : ${facts}.`,
    "Les prochaines données sont attendues dans les semaines qui viennent. Les acteurs concernés ont annoncé un nouveau point d'étape d'ici la fin de l'année.",
  ];
}

export const TAGS: Record<Tag, { label: string; why: (a: Article) => string }> = {
  ess: { label: 'Essentiel', why: () => 'Sujet majeur du jour, proposé à tout le monde.' },
  pv: { label: 'Pour vous', why: (a) => `Vous suivez la rubrique ${rubricOf(a).name}.` },
  dec: { label: 'Découverte', why: (a) => `Pour découvrir la rubrique ${rubricOf(a).name}.` },
};

/**
 * Colonnes du fil. « Mon édition » vient de l'algorithme de la base (picks, voir algo.ts) : sujets majeurs,
 * infos selon les goûts, découverte. Sans base ou hors ligne, l'app la compose elle-même avec les mêmes
 * proportions, à partir de taste (goût par rubrique : likes moins dislikes).
 */
export function buildColumns(active: string[], quota: number, premium: boolean, taste: Record<string, number> = {}, adsPersonalized = false, picks: Pick[] | null = null): Column[] {
  const score = (id: string) => taste[id] ?? 0;
  const act = RUBRICS.filter((r) => active.includes(r.id) && r.items.length > 0).sort((a, b) => score(b.id) - score(a.id));
  const others = RUBRICS.filter((r) => !active.includes(r.id) && r.items.length > 0);
  const tags: Record<string, Tag> = {};
  const why: Record<string, string> = {};
  const picked: Article[] = [];
  const take = (a: Article, t: Tag, w: string) => { picked.push(a); tags[a.id] = t; why[a.id] = w; };
  const all = RUBRICS.flatMap((r) => r.items);
  if (picks) {
    const byId = new Map(all.map((a) => [a.id, a]));
    for (const p of picks) {
      const a = byId.get(p.article_id);
      if (a && p.slot !== 'more' && picked.length < quota) take(a, p.slot, p.reason);
    }
  }
  if (!picked.length) {
    // Même recette que la base : un quart de sujets majeurs, une découverte (1 sur 8), le reste selon les goûts.
    const imp = (a: Article) => a.importance ?? 5;
    const free = (a: Article) => !picked.includes(a);
    [...all].sort((a, b) => Number(!!b.essential) - Number(!!a.essential) || imp(b) - imp(a))
      .slice(0, Math.max(1, Math.round(quota * 0.25))).forEach((a) => take(a, 'ess', TAGS.ess.why(a)));
    const dec = others.flatMap((r) => r.items).filter(free).sort((a, b) => imp(b) - imp(a)).slice(0, Math.max(1, Math.round(quota * 0.12)));
    const pv = act.flatMap((r) => r.items).filter((a) => free(a) && !dec.includes(a))
      .sort((a, b) => imp(b) + score(rubricOf(b).id) - imp(a) - score(rubricOf(a).id));
    pv.slice(0, Math.max(0, quota - picked.length - dec.length)).forEach((a) => take(a, 'pv', TAGS.pv.why(a)));
    const mid = Math.ceil(picked.length / 2);
    dec.slice(0, quota - picked.length).forEach((a, i) => { picked.splice(mid + i, 0, a); tags[a.id] = 'dec'; why[a.id] = TAGS.dec.why(a); });
  }

  const edCards: Column['cards'] = [...picked];
  const flashes: Column['cards'] = [...FLASHES].sort((a, b) => b.at.localeCompare(a.at));
  const withAds = (cards: Column['cards'], place: Placement, column: string) => (premium ? cards : insertAds(cards, place, column, active, adsPersonalized));
  return [
    { id: 'edition', name: 'Mon édition', cards: withAds(edCards, 'edition', 'edition'), tags, why },
    // Dernière minute : juste après l'édition, la plus récente en haut.
    ...(FLASHES.length ? [{ id: 'flash', name: 'Dernière minute', cards: withAds(flashes, 'flash', 'flash'), tags: {} }] : []),
    ...act.map((r) => ({ id: r.id, name: r.name, cards: withAds(r.items, 'rubrics', r.id), tags: {} })),
    // Puis les rubriques non suivies : toujours accessibles en continuant à glisser.
    ...others.map((r) => ({ id: r.id, name: r.name, cards: withAds(r.items, 'rubrics', r.id), tags: {}, extra: true })),
  ];
}

/**
 * Version gratuite : pubs glissées dans une colonne, au rythme réglé dans le back office (page Publicité).
 * Mon édition : une après la 3e info, puis une toutes les six (par défaut). Dernière minute et rubriques : une
 * toutes les N infos (0 = jamais). Jamais juste après un sujet sensible (drame, attentat…) : elle glisse après
 * l'info suivante. Sans campagne en cours pour cet emplacement, aucune carte sponsorisée. Premium : aucune.
 */
export function insertAds(cards: Column['cards'], place: Placement, column: string, active: string[], personalized: boolean): Column['cards'] {
  const every = place === 'edition' ? RULES.ad_every : place === 'flash' ? RULES.flash_ad_every : RULES.rubric_ad_every;
  const first = place === 'edition' ? RULES.ad_first : every;
  if (!every || cards.length < first) return cards;
  const out = [...cards];
  const ads = pickAds(Math.ceil((cards.length - first + 1) / every), place, column, active, personalized);
  ads.forEach((c, n) => {
    let at = first + n * (every + 1);
    while (at < out.length && (out[at - 1] as Article | Flash).sensitive) at++;
    if (at > out.length) return;
    out.splice(at, 0, { ad: true, id: `ad-${column}-${n}-${c.id}`, c, place });
  });
  return out;
}

const PSEUDOS: [string, string][] = [
  ['Camille_R', '#7B5CFF'],
  ['nico.dlt', '#3D7BFF'],
  ['Inès', '#C86BFA'],
  ['Yanis75', '#4fb0ff'],
  ['marie.l', '#9a7bff'],
];
// Badges de démonstration (les vrais se règlent dans le back office, Lecteurs > Reconnaissance).
const DEMO_BADGES: Badge[][] = [
  [{ label: 'Premium', description: 'Abonné Premium : soutient l’app.', icon: '💎', color: '#C86BFA', kind: 'premium' }, { label: 'Érudit', description: 'A lu plus de 1 000 infos.', icon: '🧠', color: '#9A7BFF', kind: 'reads' }],
  [{ label: 'Bienfaiteur', description: 'A proposé des idées pour améliorer l’app.', icon: '💌', color: '#FFB547', kind: 'manual' }, { label: 'Curieux', description: 'A lu plus de 50 infos.', icon: '📖', color: '#5AD1B5', kind: 'reads' }],
  [{ label: 'Assidu', description: 'A lu plus de 250 infos.', icon: '📚', color: '#4FB0FF', kind: 'reads' }],
  [],
  [{ label: 'Pionnier', description: 'Parmi les 1 000 premiers comptes.', icon: '🚀', color: '#FF8A7A', kind: 'early' }],
];
const DEMO_READS = [1240, 86, 310, 12, 45];

/** Fiche de démonstration, en touchant un pseudo. */
export const demoCard = (c: Comment): ReaderCard => {
  const i = Math.max(0, PSEUDOS.findIndex((p) => p[0] === c.who));
  return { pseudo: c.who, hidden: false, reads: DEMO_READS[i], minutes_saved: DEMO_READS[i] * RECOG.minutes_per_article, badges: c.badges ?? [], since: '2026-11-01T00:00:00Z' };
};

const BASE: [string, number, number, string][] = [
  ['Enfin une info claire, sans titre racoleur.', 42, 2, 'il y a 12 min'],
  ['Ça mériterait un suivi dans quelques semaines.', 18, 1, 'il y a 25 min'],
  ["Les sources en un tap, c'est vraiment pratique.", 27, 0, 'il y a 40 min'],
  ["J'aurais aimé un chiffre de comparaison européen.", 9, 3, 'il y a 1 h'],
  ['Lu dans le métro en 30 secondes, parfait.', 15, 0, 'il y a 2 h'],
];
export const seedComments = (): Comment[] =>
  BASE.map((b, i) => ({
    id: `c${i}`,
    who: PSEUDOS[i][0],
    color: PSEUDOS[i][1],
    text: b[0],
    likes: b[1],
    dislikes: b[2],
    ago: b[3],
    mine: 0,
    order: i,
    badges: DEMO_BADGES[i],
  }));
