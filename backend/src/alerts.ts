/**
 * Alertes « sujet suivi » : après chaque passage du moteur (édition, mise à jour, Dernière minute),
 * la base choisit les alertes à envoyer (fonction take_topic_alerts, réglée dans le back office)
 * et on les envoie par le service de notifications d'Expo (gratuit, sans clé).
 * Jamais d'alerte pour un sujet sensible : la base les écarte avant.
 */
import { q } from './db.js';

const EXPO = 'https://exp.host/--/api/v2/push/send';
type Alert = { token: string; title: string; body: string; topic: string; item: string };

export async function sendTopicAlerts(log: (...a: unknown[]) => void = console.log): Promise<number> {
  const rows = await q<Alert>('select * from take_topic_alerts()');
  if (!rows.length) return 0;
  const dead: string[] = [];
  let sent = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const msgs = batch.map((r) => ({
      to: r.token, title: r.title, body: r.body, sound: 'default', channelId: 'topics',
      data: { topic: r.topic, item: r.item },
    }));
    try {
      const res = await fetch(EXPO, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(msgs) });
      const out = (await res.json().catch(() => null)) as { data?: { status: string; details?: { error?: string } }[] } | null;
      (out?.data ?? []).forEach((t, k) => {
        if (t.status === 'ok') sent++;
        else if (t.details?.error === 'DeviceNotRegistered') dead.push(batch[k].token);
      });
    } catch (e) {
      log(`Alertes sujets : envoi impossible (${e instanceof Error ? e.message : e})`);
    }
  }
  if (dead.length) await q('select drop_push($1)', [dead]);
  log(`Alertes sujets : ${sent} envoyée(s) sur ${rows.length}${dead.length ? `, ${dead.length} téléphone(s) oublié(s)` : ''}.`);
  return sent;
}
