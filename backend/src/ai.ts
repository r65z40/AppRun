import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { PHOTO_TAGS, PHOTO_TAG_LIST } from './photos.js';

export const RUBRICS = {
  france: 'France : politique, société, justice, faits marquants en France',
  monde: 'Monde : international, diplomatie, conflits, élections étrangères',
  eco: 'Éco : économie, emploi, entreprises, prix, budget',
  tech: 'Tech : numérique, sciences, espace, santé, innovation',
  sport: 'Sport : résultats, compétitions, transferts',
  culture: 'Culture : cinéma, musique, livres, expositions, patrimoine',
} as const;
export type RubricId = keyof typeof RUBRICS;
const RUBRIC_IDS = Object.keys(RUBRICS) as [RubricId, ...RubricId[]];

/** Une info brute telle que le moteur la donne à l'IA (titre + chapô de chaque média). */
export type Item = { n: number; source: string; title: string; description: string; publishedAt: string | null };

export const MODEL = process.env.TITRE_MODEL || 'claude-opus-5-5';
const EFFORT = (process.env.TITRE_EFFORT as 'low' | 'medium' | 'high') || 'medium';
const MOCK = process.env.MOCK_AI === '1';

let client: Anthropic | null = null;
const api = () => (client ??= new Anthropic());

/* ---------- Étape 1 : choisir et regrouper les sujets du jour ---------- */

const Selection = z.object({
  stories: z.array(
    z.object({
      rubric: z.enum(RUBRIC_IDS),
      item_numbers: z.array(z.number().int()).describe('Numéros des dépêches qui parlent de ce même sujet'),
      importance: z.number().int().describe('1 (anecdotique) à 10 (majeur pour tout le pays)'),
      essential: z.boolean().describe('Sujet que tout le monde doit connaître aujourd’hui'),
      label: z.string().describe('Le sujet en quelques mots, pour le journal du moteur'),
    }),
  ),
});
export type Story = z.infer<typeof Selection>['stories'][number];

const SELECT_SYSTEM = `Tu es le rédacteur en chef de TITRE, une app d'actu ultra résumée pour les 20-40 ans.
Chaque matin tu reçois les titres et chapôs publiés par plusieurs médias français ces dernières 24 heures.
Ton travail : repérer les sujets distincts du jour, regrouper les dépêches qui parlent du même sujet, les classer dans une rubrique et noter leur importance.

Règles :
- Un sujet = un événement précis. Deux dépêches sur le même événement vont dans le même sujet.
- Ignore les contenus qui ne sont pas des infos : jeux, horoscopes, bons plans, publicités, programmes télé, directs sans fait nouveau, tribunes d'opinion.
- Préfère les sujets confirmés par plusieurs médias. Une rumeur isolée n'est pas un sujet.
- « essential » : au plus 4 sujets, ceux qu'une personne bien informée doit absolument connaître aujourd'hui.
- Au plus PER_RUBRIC sujets par rubrique, les plus importants d'abord.

Rubriques :
${Object.entries(RUBRICS).map(([k, v]) => `- ${k} : ${v}`).join('\n')}`;

export async function selectStories(items: Item[], perRubric: number): Promise<Story[]> {
  if (MOCK) return mockSelect(items, perRubric);
  const list = items
    .map((i) => `[${i.n}] (${i.source}) ${i.title}${i.description ? ' — ' + i.description.slice(0, 280) : ''}`)
    .join('\n');
  const res = await api().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SELECT_SYSTEM.replace('PER_RUBRIC', String(perRubric)),
    output_config: { effort: EFFORT, format: betaZodOutputFormat(Selection) },
    messages: [{ role: 'user', content: `Dépêches du jour :\n\n${list}` }],
  });
  if (res.stop_reason === 'refusal') throw new Error('Sélection refusée par le modèle');
  const out = res.parsed_output;
  if (!out) throw new Error(`Sélection illisible (stop_reason=${res.stop_reason})`);
  const valid = new Set(items.map((i) => i.n));
  return out.stories
    .map((s) => ({ ...s, item_numbers: s.item_numbers.filter((n) => valid.has(n)), importance: clamp(s.importance, 1, 10) }))
    .filter((s) => s.item_numbers.length > 0);
}

/* ---------- Étape 2 : écrire la carte TITRE d'un sujet ---------- */

const CardSchema = z.object({
  title: z.string().describe('Titre factuel, 60 caractères maximum, sans point final'),
  key_sentence: z.string().describe('La phrase clé : ce qu’il faut retenir, 140 caractères maximum'),
  facts: z
    .array(
      z.object({
        text: z.string().describe('Un fait vérifiable, 90 caractères maximum, avec l’élément clé entre <b> et </b>'),
        item_number: z.number().int().describe('Numéro de la dépêche d’où vient ce fait'),
      }),
    )
    .describe('Exactement 3 faits'),
  summary: z.object({
    context: z.string().describe('Contexte : pourquoi on en parle, 280 caractères maximum'),
    change: z.string().describe('Ce qui change concrètement, 280 caractères maximum'),
    next: z.string().describe('Et après : prochaines étapes ou dates, 280 caractères maximum'),
  }),
  photo_tag: z.enum(PHOTO_TAG_LIST).describe('La photo d’ambiance la plus proche du sujet'),
});
export type CardOut = z.infer<typeof CardSchema>;

const WRITE_SYSTEM = `Tu écris pour TITRE, une app d'actu ultra résumée. Le lecteur doit tout comprendre en 20 secondes.
On te donne les titres et chapôs de plusieurs médias sur un même sujet. Écris la carte TITRE de ce sujet.

Style :
- Français simple, phrases courtes, ton neutre. Pas d'adjectifs dramatiques, pas de point d'exclamation, pas de question en titre.
- Écris avec tes propres mots. Ne recopie jamais une phrase d'un média : reprends seulement les faits.
- N'invente rien. Chaque fait doit venir des dépêches fournies ; indique le numéro de la dépêche.
- Si les médias se contredisent, dis-le simplement (« selon X… »).
- Dans chaque fait, mets entre <b> et </b> l'élément clé : un chiffre, une date, un nom. Une seule balise par fait.
- Respecte les longueurs maximales.

Photos d'ambiance disponibles :
${Object.entries(PHOTO_TAGS).map(([k, v]) => `- ${k} : ${v}`).join('\n')}`;

export async function writeCard(story: Story, items: Item[]): Promise<CardOut> {
  if (MOCK) return mockCard(story, items);
  const docs = items.map((i) => `[${i.n}] ${i.source}${i.publishedAt ? ` (${i.publishedAt})` : ''}\nTitre : ${i.title}\nChapô : ${i.description || '—'}`).join('\n\n');
  const res = await api().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: WRITE_SYSTEM,
    output_config: { effort: EFFORT, format: betaZodOutputFormat(CardSchema) },
    messages: [{ role: 'user', content: `Rubrique : ${story.rubric}\n\n${docs}` }],
  });
  if (res.stop_reason === 'refusal') throw new Error('Carte refusée par le modèle');
  const out = res.parsed_output;
  if (!out) throw new Error(`Carte illisible (stop_reason=${res.stop_reason})`);
  return out;
}

/* ---------- Contrôles éditoriaux après l'IA ---------- */

/** Renvoie la liste des problèmes ; une carte avec problèmes reste en brouillon pour relecture. */
export function checkCard(c: CardOut, items: Item[]): string[] {
  const issues: string[] = [];
  if (c.title.length > 70) issues.push(`titre trop long (${c.title.length})`);
  if (c.key_sentence.length > 170) issues.push('phrase clé trop longue');
  if (c.facts.length !== 3) issues.push(`${c.facts.length} faits au lieu de 3`);
  const nums = new Set(items.map((i) => i.n));
  c.facts.forEach((f, k) => {
    if (!nums.has(f.item_number)) issues.push(`fait ${k + 1} sans source valable`);
    if (!/<b>.+<\/b>/.test(f.text)) issues.push(`fait ${k + 1} sans élément en gras`);
    if (f.text.replace(/<\/?b>/g, '').length > 110) issues.push(`fait ${k + 1} trop long`);
  });
  // Reprise mot pour mot : 8 mots consécutifs identiques à un chapô = trop proche du texte du média.
  const src = items.map((i) => norm(i.title + ' ' + i.description)).join(' | ');
  for (const t of [c.key_sentence, ...c.facts.map((f) => f.text), c.summary.context, c.summary.change, c.summary.next]) {
    const w = norm(t).split(' ');
    for (let k = 0; k + 8 <= w.length; k++) {
      if (src.includes(w.slice(k, k + 8).join(' '))) {
        issues.push('reprise mot pour mot d’un média');
        break;
      }
    }
  }
  return [...new Set(issues)];
}

const norm = (s: string) => s.toLowerCase().replace(/<\/?b>/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, Math.round(v)));

/* ---------- Mode test sans clé (MOCK_AI=1) ---------- */

function guessRubric(t: string): RubricId {
  const s = t.toLowerCase();
  if (/match|ligue|coupe|champion|but |tennis|rugby|football|jo /.test(s)) return 'sport';
  if (/film|festival|musée|album|livre|expo|concert/.test(s)) return 'culture';
  if (/ia |numérique|appli|fusée|satellite|science|santé|vaccin/.test(s)) return 'tech';
  if (/prix|inflation|emploi|bourse|entreprise|budget|chômage|euros/.test(s)) return 'eco';
  if (/usa|états-unis|chine|ukraine|russie|onu|ue |europe|allemagne|brésil/.test(s)) return 'monde';
  return 'france';
}
function mockSelect(items: Item[], perRubric: number): Story[] {
  const byRub: Record<string, Story[]> = {};
  for (const i of items) {
    const r = guessRubric(i.title + ' ' + i.description);
    (byRub[r] ??= []).push({ rubric: r, item_numbers: [i.n], importance: 5, essential: false, label: i.title.slice(0, 40) });
  }
  const out = Object.values(byRub).flatMap((l) => l.slice(0, perRubric));
  out.slice(0, 2).forEach((s) => ((s.essential = true), (s.importance = 9)));
  return out;
}
function mockCard(story: Story, items: Item[]): CardOut {
  const i = items[0];
  const words = i.description.split(' ');
  return {
    title: i.title.slice(0, 60),
    key_sentence: `En bref : ${words.slice(0, 6).join(' ')}.`,
    facts: [0, 1, 2].map((k) => ({ text: `Fait <b>${k + 1}</b> selon ${i.source}`, item_number: (items[k] ?? i).n })),
    summary: { context: 'Contexte (mode test).', change: 'Ce qui change (mode test).', next: 'Et après (mode test).' },
    photo_tag: PHOTO_TAG_LIST[(story.label.length + i.n) % PHOTO_TAG_LIST.length],
  };
}
