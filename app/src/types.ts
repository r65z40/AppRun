
export type Fact = { text: string; source: string; doc: string };

export type Article = {
  id: string;
  title: string;
  hour: string;
  key: string;
  facts: Fact[];
  photo: number | { uri: string } | null;
  grad: string[] | null;
  likes: number;
  comments: number;
  summary?: string[];
  /** Sujet majeur du jour (choisi par la rédaction). */
  essential?: boolean;
  /** « D'après … » : médias d'où viennent les faits. */
  media?: string;
  credit?: string;
  /** Note d'importance donnée par l'IA (1 à 10) : les plus importantes passent en tête. */
  importance?: number;
  /** Réactions emoji : nombre par emoji, réaction du lecteur comprise. */
  emojis?: Record<string, number>;
};

export type Rubric = { id: string; name: string; items: Article[] };

/** Une pub d'une campagne en cours (back office > Publicité). */
export type AdCreative = { id: string; advertiser: string; title: string; body: string; cta: string; url: string; image_url: string | null; rubrics: string[]; weight: number };
export type Ad = { ad: true; id: string; c: AdCreative };
/** Dernière minute : une info majeure, datée à la minute. */
export type Flash = { flash: true; id: string; title: string; sentence: string; at: string; sources: { source: string; url: string }[] };
export type Card = Article | Ad | Flash;
export const isAd = (c: Card): c is Ad => 'ad' in c;
export const isFlash = (c: Card): c is Flash => 'flash' in c;
export const isArticle = (c: Card): c is Article => !('ad' in c) && !('flash' in c);

export type Tag = 'ess' | 'pv' | 'dec';

export type Column = {
  id: string;
  /** Rubrique que le lecteur ne suit pas : proposée après ses rubriques. */
  extra?: boolean;
  name: string;
  cards: Card[];
  tags: Record<string, Tag>;
};

export type Comment = {
  id: string;
  who: string;
  color: string;
  text: string;
  likes: number;
  dislikes: number;
  ago: string;
  mine: -1 | 0 | 1;
  order: number;
  /** Écrit par le lecteur connecté (il peut le supprimer). */
  own?: boolean;
  /** L'auteur est abonné Premium. */
  premium?: boolean;
};
