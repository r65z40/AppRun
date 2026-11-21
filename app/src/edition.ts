import { RUBRICS } from './content';
import type { Article, Column, Comment, Tag } from './types';

export const AD = { ad: true as const, id: 'ad' as const };
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
  dec: { label: 'Découverte', why: () => 'Pour sortir un peu de vos habitudes.' },
};

/** « Mon édition » (§16) : sujets majeurs pour tous, puis vos rubriques, puis une découverte. */
export function buildColumns(active: string[], quota: number, premium: boolean): Column[] {
  const act = RUBRICS.filter((r) => active.includes(r.id));
  const other = RUBRICS.filter((r) => !active.includes(r.id));
  const total = act.reduce((n, r) => n + r.items.length, 0);
  const disc = other.length ? other[0].items[0] : null;
  const size = Math.min(quota, total + (disc ? 1 : 0));
  const picked: { a: Article; tag: Tag }[] = [];
  for (let k = 0; picked.length < size - (disc ? 1 : 0); k++) {
    let added = false;
    for (const r of act) {
      if (picked.length < size - (disc ? 1 : 0) && r.items[k]) {
        picked.push({ a: r.items[k], tag: picked.length < 2 ? 'ess' : 'pv' });
        added = true;
      }
    }
    if (!added) break;
  }
  if (disc) picked.push({ a: disc, tag: 'dec' });
  else if (picked.length > 2) picked[picked.length - 1].tag = 'dec';

  const edCards: Column['cards'] = picked.map((p) => p.a);
  // Pub : jamais avant la 3e carte, au plus une toutes les six (§4.6).
  if (!premium && edCards.length > 3) edCards.splice(3, 0, AD);
  const tags: Record<string, Tag> = {};
  picked.forEach((p) => (tags[p.a.id] = p.tag));

  return [
    { id: 'edition', name: 'Mon édition', cards: edCards, tags },
    ...act.map((r) => ({ id: r.id, name: r.name, cards: r.items, tags: {} })),
  ];
}

const PSEUDOS: [string, string][] = [
  ['Camille_R', '#7B5CFF'],
  ['nico.dlt', '#3D7BFF'],
  ['Inès', '#C86BFA'],
  ['Yanis75', '#4fb0ff'],
  ['marie.l', '#9a7bff'],
];
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
  }));

export const CREDITS =
  'Quai de gare : Eutah Mizushima (Unsplash) · Route enneigée : Ali Inay (Unsplash) · Vagues : Sarah Bürvenich (Unsplash) · Fjord : Jeff Sheldon (Unsplash) · Façade : Roman Kraft (Unsplash) · Chaîne de vélo : NonNerd (CC0) · Bâtiment blanc : Julien Moreau (Unsplash) · Sommet : Namphuong Van (Unsplash) · Route de montagne : Barry Marsh (domaine public) · Reliure : Cornettesax (CC0) · Lampe : LoMit (CC BY-SA 4.0, floutée)';
