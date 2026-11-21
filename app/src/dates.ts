const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', ...opts }).format(d);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** « Samedi 21 novembre » */
export const todayLabel = () => cap(fmt(new Date(), { weekday: 'long', day: 'numeric', month: 'long' }));
/** « dimanche 22 novembre » */
export const tomorrowLabel = () => fmt(new Date(Date.now() + 86400e3), { weekday: 'long', day: 'numeric', month: 'long' });
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
