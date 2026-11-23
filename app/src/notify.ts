// Notification du matin : une seule par jour, à l'heure choisie par le lecteur.
// Textes, heure proposée et activation se règlent dans le back office (Personnalisation > Notification).
// Notification locale, programmée sur le téléphone : son texte ne cite jamais une info précise
// (donc jamais un sujet sensible), seulement le nombre d'infos du lecteur.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { NOTIF, notifBody } from './brand';
import { getLocal, setLocal } from './account';

const KEY = 'titre.notif';
const on = Platform.OS !== 'web';
const parse = (t: string) => { const m = /(\d+) h (\d+)/.exec(t); return m ? { hour: Number(m[1]) % 24, minute: Number(m[2]) % 60 } : { hour: 7, minute: 30 }; };

if (on) Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });

async function schedule(time: string, quota: number) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('edition', { name: 'Édition du matin', importance: Notifications.AndroidImportance.DEFAULT });
  await Notifications.scheduleNotificationAsync({
    content: { title: NOTIF.title, body: notifBody(quota) },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, ...parse(time), channelId: 'edition' },
  });
}

/** Le lecteur a demandé la notification sur cet appareil. */
export async function notifWanted(): Promise<boolean> {
  return (await getLocal(KEY)) === '1';
}

/** Active (demande l'autorisation au besoin) ou coupe la notification. Renvoie l'état final. */
export async function setNotif(want: boolean, time: string, quota: number): Promise<boolean> {
  if (!on) return false;
  try {
    if (!want || !NOTIF.enabled) {
      await setLocal(KEY, want ? '1' : '0');
      await Notifications.cancelAllScheduledNotificationsAsync();
      return false;
    }
    let { granted } = await Notifications.getPermissionsAsync();
    if (!granted) granted = (await Notifications.requestPermissionsAsync()).granted;
    await setLocal(KEY, granted ? '1' : '0');
    if (granted) await schedule(time, quota);
    return granted;
  } catch {
    return false;
  }
}

/** À chaque ouverture : reprogramme avec l'heure et les textes du moment (sans redemander l'autorisation). */
export async function syncNotif(time: string, quota: number) {
  if (!on) return;
  try {
    if (!NOTIF.enabled) return void (await Notifications.cancelAllScheduledNotificationsAsync());
    if (!(await notifWanted())) return;
    if ((await Notifications.getPermissionsAsync()).granted) await schedule(time, quota);
  } catch {}
}
