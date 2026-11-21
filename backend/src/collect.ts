import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { q } from './db.js';
import { fetchFeed, parseFeed, type FeedItem } from './rss.js';

const slug = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Lit toutes les sources actives (ou des fichiers d'exemple) et range les titres dans raw_items. */
type Source = { id: string; name: string; url: string };

export async function collect(FIXTURES: string | undefined, log: (...a: unknown[]) => void) {
  const sources = await q<Source>('select id, name, url from sources where active order by name');
  let total = 0;
  const fixtureFiles = FIXTURES ? readdirSync(FIXTURES) : [];
  for (const s of sources) {
    let items: FeedItem[] = [];
    try {
      if (FIXTURES) {
        const f = fixtureFiles.find((x) => x.replace(/\.xml$/, '') === slug(s.name));
        if (!f) continue;
        items = parseFeed(readFileSync(path.join(FIXTURES, f), 'utf8'));
      } else {
        items = await fetchFeed(s.url);
      }
      for (const it of items) {
        await q(
          `insert into raw_items (source_id, guid, title, description, link, published_at)
           values ($1, $2, $3, $4, $5, $6)
           on conflict (source_id, guid) do update set title = excluded.title, description = excluded.description`,
          [s.id, it.guid, it.title, it.description, it.link, it.publishedAt],
        );
      }
      await q('update sources set last_fetch_at = now(), last_error = null where id = $1', [s.id]);
      total += items.length;
      log(`  ${s.name} : ${items.length} titres`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await q('update sources set last_fetch_at = now(), last_error = $2 where id = $1', [s.id, msg]);
      log(`  ${s.name} : échec (${msg})`);
    }
  }
  return total;
}

