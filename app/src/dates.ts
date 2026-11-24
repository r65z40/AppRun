const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', ...opts }).format(d);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** « Samedi 21 novembre » */
export const todayLabel = () => cap(fmt(new Date(), { weekday: 'long', day: 'numeric', month: 'long' }));
/** « dimanche 22 novembre » */
export const tomorrowLabel = () => fmt(new Date(Date.now() + 86400e3), { weekday: 'long', day: 'numeric', month: 'long' });
/** « Lundi 23 novembre 2026 » pour une date donnée. */
export const dayLabel = (iso: string) => cap(fmt(new Date(iso), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
export const yearLabel = () => fmt(new Date(), { year: 'numeric' });
/** « 14 h 32 », ou « il y a 5 min » si c'est tout récent. */
export const flashTime = (iso: string) => {
  const d = new Date(iso);
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const p = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric', minute: '2-digit' }).formatToParts(d);
  return `${Number(p.find((x) => x.type === 'hour')?.value)} h ${p.find((x) => x.type === 'minute')?.value}`;
};
/** Date du jour à Paris, décalée de n jours : « 2026-11-23 ». */
export const isoDay = (n = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(Date.now() + n * 86400e3));
/** « Hier », « Avant-hier » ou « Ven. 20 nov. » pour une date « 2026-11-20 ». */
export const shortDay = (d: string) => (d === isoDay(-1) ? 'Hier' : d === isoDay(-2) ? 'Avant-hier' : cap(fmt(new Date(`${d}T12:00:00Z`), { weekday: 'short', day: 'numeric', month: 'short' })));
