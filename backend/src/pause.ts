// Message clair quand le moteur est en pause : depuis quand, par qui, et jusqu'à quand.
import { q } from './db.js';
import { cfg } from './config.js';

const fmt = (d: Date) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);

export async function pauseMessage(): Promise<string> {
  const who = await q<{ at: Date; email: string | null }>(
    `select a.updated_at as at, u.email from app_settings a left join auth.users u on u.id = a.updated_by where a.key = 'ENGINE_PAUSED'`,
  ).catch(() => []);
  const since = who[0] ? ` depuis ${fmt(new Date(who[0].at))}${who[0].email ? ` (par ${who[0].email})` : ''}` : '';
  const until = cfg.pauseUntil();
  const end = until ? `, reprise automatique ${fmt(until)}` : ', sans reprise automatique';
  return `Moteur en pause${since}${end} : rien publié. Pour relancer : IA > Pilotage.`;
}
