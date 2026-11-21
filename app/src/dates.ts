const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', ...opts }).format(d);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** « Samedi 21 novembre » */
export const todayLabel = () => cap(fmt(new Date(), { weekday: 'long', day: 'numeric', month: 'long' }));
/** « dimanche 22 novembre » */
export const tomorrowLabel = () => fmt(new Date(Date.now() + 86400e3), { weekday: 'long', day: 'numeric', month: 'long' });
export const yearLabel = () => fmt(new Date(), { year: 'numeric' });
