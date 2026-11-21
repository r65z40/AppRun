import { XMLParser } from 'fast-xml-parser';

export type FeedItem = { guid: string; title: string; description: string; link: string; publishedAt: Date | null };

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', textNodeName: '#text', cdataPropName: false as any });

const text = (v: unknown): string => {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === 'object') return text((v as any)['#text'] ?? (v as any)['@href'] ?? '');
  return '';
};
const clean = (s: string) =>
  s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const arr = <T>(v: T | T[] | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

/** Lit un flux RSS 2.0 ou Atom. Ne garde que titre, chapô, lien et date. */
export function parseFeed(xml: string): FeedItem[] {
  const doc = parser.parse(xml);
  const rss = doc?.rss?.channel ?? doc?.['rdf:RDF'];
  if (rss) {
    return arr(rss.item ?? doc['rdf:RDF']?.item).map((it: any) => {
      const link = text(it.link);
      return {
        guid: text(it.guid) || link,
        title: clean(text(it.title)),
        description: clean(text(it.description)).slice(0, 600),
        link,
        publishedAt: toDate(text(it.pubDate) || text(it['dc:date'])),
      };
    }).filter((i) => i.title && i.link);
  }
  const feed = doc?.feed;
  if (feed) {
    return arr(feed.entry).map((it: any) => {
      const links = arr(it.link);
      const link = text((links.find((l: any) => !l['@rel'] || l['@rel'] === 'alternate') ?? links[0]) as any);
      return {
        guid: text(it.id) || link,
        title: clean(text(it.title)),
        description: clean(text(it.summary) || text(it.content)).slice(0, 600),
        link,
        publishedAt: toDate(text(it.published) || text(it.updated)),
      };
    }).filter((i) => i.title && i.link);
  }
  return [];
}

function toDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export async function fetchFeed(url: string, timeoutMs = 15000): Promise<FeedItem[]> {
  const res = await fetch(url, {
    headers: { 'user-agent': 'TITRE-bot/0.1 (agrégateur de titres)', accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseFeed(await res.text());
}
