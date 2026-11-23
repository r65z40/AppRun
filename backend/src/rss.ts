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
  s.replace(/<[^>]+>/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
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

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';

export type Fetched = { items: FeedItem[] | null; etag: string | null; lastModified: string | null };

/** items = null : le flux n'a pas changé depuis le dernier passage (réponse 304, rien à relire). */
export async function fetchFeed(url: string, timeoutMs = 15000, since: { etag?: string | null; lastModified?: string | null } = {}): Promise<Fetched> {
  const headers: Record<string, string> = { 'user-agent': 'TITRE-bot/0.2 (agrégateur de titres)', accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' };
  if (since.etag) headers['if-none-match'] = since.etag;
  if (since.lastModified) headers['if-modified-since'] = since.lastModified;
  let res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  // Certains médias (20 Minutes…) refusent les robots inconnus (403) ou saturent un instant (429, 5xx) :
  // un second essai, deux secondes plus tard, avec l'identité d'un navigateur ordinaire.
  if (res.status === 403 || res.status === 429 || res.status >= 500) {
    await new Promise((r) => setTimeout(r, 2000));
    res = await fetch(url, { headers: { ...headers, 'user-agent': BROWSER_UA, 'accept-language': 'fr-FR,fr;q=0.9' }, signal: AbortSignal.timeout(timeoutMs) });
  }
  if (res.status === 304) return { items: null, etag: since.etag ?? null, lastModified: since.lastModified ?? null };
  if (!res.ok) throw new Error(res.status === 403 ? 'HTTP 403 (le média bloque les robots)' : res.status >= 500 ? `HTTP ${res.status} (site du média indisponible)` : `HTTP ${res.status}`);
  const body = await res.text();
  const items = parseFeed(body);
  if (!items.length && /<html/i.test(body.slice(0, 500))) throw new Error("page web au lieu d'un flux RSS (adresse à corriger)");
  return { items, etag: res.headers.get('etag'), lastModified: res.headers.get('last-modified') };
}
