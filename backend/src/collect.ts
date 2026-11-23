import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { q } from './db.js';
import { cfg } from './config.js';
import { fetchFeed, parseFeed, type FeedItem } from './rss.js';

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

type Source = { id: string; name: string; url: string; etag: string | null; last_modified: string | null; fail_count: number };
export type CollectResult = { total: number; fresh: number; unchanged: number; failed: number };

/**
 * Lit toutes les sources actives (ou des fichiers d'exemple) et range les titres dans raw_items.
 * Plusieurs sources à la fois ; un flux inchangé depuis le dernier passage n'est pas retéléchargé (ETag).
 * Une source en échec trop de fois d'affilée est mise à l'écart (réglage SOURCE_MAX_FAILS) : l'équipe la voit dans IA > Sources.
 * all : vérifie aussi les sources désactivées (npm run sources), sans jamais les réactiver.
 */
export async function collect(FIXTURES: string | undefined, log: (...a: unknown[]) => void, opts: { all?: boolean } = {}): Promise<number> {
  return (await collectAll(FIXTURES, log, opts)).total;
}

export async function collectAll(FIXTURES: string | undefined, log: (...a: unknown[]) => void, opts: { all?: boolean } = {}): Promise<CollectResult> {
  const sources = await q<Source>(`select id, name, url, etag, last_modified, fail_count from sources ${opts.all ? '' : 'where active'} order by name`);
  const fixtureFiles = FIXTURES ? readdirSync(FIXTURES) : [];
  const res: CollectResult = { total: 0, fresh: 0, unchanged: 0, failed: 0 };
  const oldest = Date.now() - cfg.rawRetentionDays() * 86400e3;

  const one = async (s: Source) => {
    try {
      let items: FeedItem[] | null;
      let etag: string | null = null, lastModified: string | null = null;
      if (FIXTURES) {
        const f = fixtureFiles.find((x) => x.replace(/\.xml$/, '') === slug(s.name));
        if (!f) return;
        items = parseFeed(readFileSync(path.join(FIXTURES, f), 'utf8'));
      } else {
        const r = await fetchFeed(s.url, cfg.fetchTimeout() * 1000, opts.all ? {} : { etag: s.etag, lastModified: s.last_modified });
        items = r.items;
        etag = r.etag;
        lastModified = r.lastModified;
      }
      if (items === null) {
        // 304 : le média n'a rien publié depuis le dernier passage.
        res.unchanged++;
        await q('update sources set last_fetch_at = now(), last_error = null, fail_count = 0 where id = $1', [s.id]);
        return;
      }
      // Une seule fois chaque dépêche, et rien de plus vieux que la durée de conservation.
      const seen = new Set<string>();
      const keep = items.filter((it) => !seen.has(it.guid) && seen.add(it.guid) && (!it.publishedAt || it.publishedAt.getTime() > oldest || !!FIXTURES));
      let added = 0;
      if (keep.length) {
        // Une seule requête par source au lieu d'une par dépêche.
        const r = await q<{ inserted: boolean }>(
          `insert into raw_items (source_id, guid, title, description, link, published_at)
           select $1, * from unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::timestamptz[])
           on conflict (source_id, guid) do update set title = excluded.title, description = excluded.description
             where raw_items.title is distinct from excluded.title or raw_items.description is distinct from excluded.description
           returning (xmax = 0) as inserted`,
          [s.id, keep.map((i) => i.guid), keep.map((i) => i.title), keep.map((i) => i.description), keep.map((i) => i.link), keep.map((i) => i.publishedAt)],
        );
        added = r.filter((x) => x.inserted).length;
      }
      const last = items.reduce<Date | null>((m, i) => (i.publishedAt && (!m || i.publishedAt > m) ? i.publishedAt : m), null);
      await q(
        `update sources set last_fetch_at = now(), last_error = $2, fail_count = 0, last_count = $3, last_item_at = coalesce($4, last_item_at),
                etag = coalesce($5, etag), last_modified = coalesce($6, last_modified) where id = $1`,
        [s.id, items.length ? null : 'Flux vide ou illisible', items.length, last, etag, lastModified],
      );
      res.total += items.length;
      res.fresh += added;
      log(`  ${s.name} : ${items.length} titres${added ? `, ${added} nouveaux` : ''}`);
    } catch (e) {
      const msg = e instanceof Error ? (e.name === 'TimeoutError' ? `pas de réponse en ${cfg.fetchTimeout()} s` : e.message) : String(e);
      res.failed++;
      const max = cfg.sourceMaxFails();
      const off = max > 0 && s.fail_count + 1 >= max && !opts.all;
      await q(
        `update sources set last_fetch_at = now(), last_error = $2, fail_count = fail_count + 1,
                active = active and not $3, disabled_reason = case when $3 then $4 else disabled_reason end where id = $1`,
        [s.id, msg, off, `Mise à l'écart automatique après ${max} échecs d'affilée (${msg})`],
      );
      log(`  ${s.name} : échec (${msg})${off ? ` · source mise à l'écart après ${max} échecs d'affilée` : ''}`);
    }
  };

  // 6 sources à la fois : la lecture complète prend quelques secondes au lieu d'une minute.
  const queue = [...sources];
  await Promise.all(Array.from({ length: Math.min(6, queue.length) }, async () => {
    while (queue.length) await one(queue.shift()!);
  }));
  return res;
}
