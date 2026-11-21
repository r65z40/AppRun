
export type Fact = { text: string; source: string; doc: string };

export type Article = {
  id: string;
  title: string;
  hour: string;
  key: string;
  facts: Fact[];
  photo: number | null;
  grad: string[] | null;
  likes: number;
  comments: number;
  summary?: string[];
};

export type Rubric = { id: string; name: string; items: Article[] };

export type Ad = { ad: true; id: 'ad' };
export type Card = Article | Ad;
export const isAd = (c: Card): c is Ad => 'ad' in c;

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
