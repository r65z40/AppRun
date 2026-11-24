// Journal d'un passage du moteur, enregistré dans engine_runs pour le back office.
import { q } from './db.js';
import { model, usage } from './ai.js';

export type Journal = {
  /** Passage dans engine_runs : chaque carte et info publiée le garde, pour pouvoir tout dépublier d'un coup. */
  id: string | null;
  log: (...a: unknown[]) => void;
  details: Record<string, unknown>;
  finish: (status: 'ok' | 'error', summary: string, stats?: Record<string, unknown>) => Promise<void>;
};

const spent = () => (usage.calls ? { model: model(), ai: { ...usage } } : {});

export async function startJournal(kind: 'edition' | 'flash'): Promise<Journal> {
  const lines: string[] = [];
  const details: Record<string, unknown> = {};
  let id: string | null = null;
  try {
    id = (await q<{ id: string }>('insert into engine_runs (kind) values ($1) returning id', [kind]))[0].id;
  } catch {
    // Base sans la migration 0004 : le moteur tourne quand même, sans journal.
  }
  const save = async (extra = '') => {
    if (!id) return;
    // La consommation de l'IA est notée en continu : le budget compte aussi les passages en cours ou plantés.
    await q(`update engine_runs set log = $2, details = $3, stats = stats || $4 ${extra} where id = $1`, [id, JSON.stringify(lines), JSON.stringify(details), JSON.stringify(spent())]).catch(() => {});
  };
  let t: ReturnType<typeof setTimeout> | null = null;
  return {
    id,
    details,
    log: (...a) => {
      const line = `${new Date().toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris' })} ${a.map(String).join(' ')}`;
      console.log(line);
      lines.push(line);
      if (!t) t = setTimeout(() => { t = null; save(); }, 3000); // le back office voit le passage avancer
    },
    async finish(status, summary, stats = {}) {
      if (t) clearTimeout(t);
      if (!id) return;
      await q(`update engine_runs set status = $2, summary = $3, stats = $4, log = $5, details = $6, finished_at = now() where id = $1`,
        [id, status, summary, JSON.stringify({ ...spent(), ...stats }), JSON.stringify(lines), JSON.stringify(details)]).catch(() => {});
    },
  };
}

/**
 * Économie : aucune dépêche arrivée depuis le dernier passage qui a appelé l'IA (details.seen = fin de sa lecture
 * des sources). Le rappeler coûterait le même prix pour la même réponse.
 */
export async function nothingNew(kind: 'edition' | 'flash', self: string | null): Promise<boolean> {
  const r = await q<{ n: boolean }>(
    `select exists (select 1 from engine_runs where kind = $1 and id is distinct from $2 and status = 'ok' and details ? 'seen' and coalesce((stats->'ai'->>'calls')::int, 0) > 0)
        and not exists (select 1 from raw_items where fetched_at > (select max((details->>'seen')::timestamptz) from engine_runs
              where kind = $1 and id is distinct from $2 and status = 'ok' and details ? 'seen' and coalesce((stats->'ai'->>'calls')::int, 0) > 0)) as n`,
    [kind, self],
  ).catch(() => [{ n: false }]);
  return r[0]?.n ?? false;
}
