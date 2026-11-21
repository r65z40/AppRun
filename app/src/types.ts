
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
};

export type Rubric = { id: string; name: string; items: Article[] };

export type Ad = { ad: true; id: string };
/** Dernière minute : une info majeure, datée à la minute. */
export type Flash = { flash: true; id: string; title: string; sentence: string; at: string; sources: { source: string; url: string }[] };
export type Card = Article | Ad | Flash;
export const isAd = (c: Card): c is Ad => 'ad' in c;
export const isFlash = (c: Card): c is Flash => 'flash' in c;
export const isArticle = (c: Card): c is Article => !('ad' in c) && !('flash' in c);

export type Tag = 'ess' | 'pv' | 'dec';

export type Column = {
  id: string;
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
};
