// Journal d'un passage du moteur, enregistré dans engine_runs pour le back office.
import { q } from './db.js';

export type Journal = {
  log: (...a: unknown[]) => void;
  details: Record<string, unknown>;
  finish: (status: 'ok' | 'error', summary: string, stats?: Record<string, unknown>) => Promise<void>;
};

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
    await q(`update engine_runs set log = $2, details = $3 ${extra} where id = $1`, [id, JSON.stringify(lines), JSON.stringify(details)]).catch(() => {});
  };
  let t: ReturnType<typeof setTimeout> | null = null;
  return {
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
        [id, status, summary, JSON.stringify(stats), JSON.stringify(lines), JSON.stringify(details)]).catch(() => {});
    },
  };
}
