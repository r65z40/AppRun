// Personnalisation réglée dans le back office (page Personnalisation) : identité, textes, notification.
// Lue au démarrage, avant le premier écran : d'abord la copie gardée de la dernière ouverture (immédiat),
// puis la base (1,5 s au plus). Sans base ou sans réseau, l'app garde les valeurs par défaut ci-dessous.
// Ce module ne doit importer aucun écran : les styles des écrans sont calculés à leur import.
import * as Font from 'expo-font';
import { BASE, F, setColors, type BaseColors } from './theme';
import { getLocal, setLocal } from './account';

/** Polices proposées dans le back office (téléchargées depuis le CDN Fontsource ; Archivo est intégrée à l'app). */
export const FONTS: Record<string, { label: string; w: [number, number, number] }> = {
  archivo: { label: 'Archivo', w: [400, 600, 900] },
  inter: { label: 'Inter', w: [400, 600, 900] },
  'dm-sans': { label: 'DM Sans', w: [400, 600, 900] },
  outfit: { label: 'Outfit', w: [400, 600, 900] },
  manrope: { label: 'Manrope', w: [400, 600, 800] },
  'plus-jakarta-sans': { label: 'Plus Jakarta Sans', w: [400, 600, 800] },
};

export const BRAND = {
  name: 'TITRE',
  /** Adresse d'une image (PNG ou JPG) ; vide = l'icône dessinée de l'app. */
  logo: '',
  font: 'archivo',
};

export const TEXTS = {
  welcome_title: "L'actu ultra résumée.",
  welcome_text: "Tout ce que vous devez savoir, sur ce qui vous intéresse. Avec 80 % de temps en moins qu'un média classique.",
  notif_title: 'Votre édition, chaque matin.',
  notif_text: "Une seule notification par jour, quand l'édition est prête. Rien d'autre.",
  ads_title: 'Gratuit, grâce à quelques pubs.',
  ads_text: "Une carte sponsorisée de temps en temps, jamais plus d'une toutes les six infos. Premium les retire toutes.",
  end_title: "C'est tout pour aujourd'hui.",
  end_bye: 'À demain.',
  premium_pitch: 'L’actu qui compte, sans aucune interruption.',
};

export const NOTIF = {
  /** Coupé : l'app ne propose plus la notification et retire celle déjà prévue. */
  enabled: true,
  /** Heure proposée aux nouveaux lecteurs. */
  default_time: '7 h 30',
  title: 'Votre édition est prête',
  /** {n} = nombre d'infos choisi par le lecteur, {nom} = nom de l'app. */
  body: '{n} infos pour être à jour, en quelques minutes.',
};

type Config = { brand?: Record<string, unknown> | null; texts?: Record<string, unknown> | null; notifications?: Record<string, unknown> | null };

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const CACHE = 'titre.config';
const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const str = (v: unknown, max = 400) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

const DEF = { brand: { ...BRAND }, texts: { ...TEXTS }, notif: { ...NOTIF } };

/** Repart des valeurs par défaut puis applique ce qui est réglé (un réglage effacé revient au défaut). */
function apply(c: Config) {
  Object.assign(BRAND, DEF.brand); Object.assign(TEXTS, DEF.texts); Object.assign(NOTIF, DEF.notif);
  const b = c.brand ?? {};
  const name = str(b.name, 40);
  if (name) BRAND.name = name;
  const logo = str(b.logo, 500);
  BRAND.logo = logo && /^https:\/\//.test(logo) ? logo : '';
  if (typeof b.font === 'string' && FONTS[b.font]) BRAND.font = b.font;
  const col = (b.colors ?? {}) as Record<string, unknown>;
  const next = { ...BASE } as BaseColors;
  (Object.keys(BASE) as (keyof BaseColors)[]).forEach((k) => { if (isHex(col[k])) next[k] = col[k] as string; });
  setColors(next);
  const t = c.texts ?? {};
  (Object.keys(TEXTS) as (keyof typeof TEXTS)[]).forEach((k) => { const v = str(t[k]); if (v) TEXTS[k] = v; });
  const n = c.notifications ?? {};
  if (typeof n.enabled === 'boolean') NOTIF.enabled = n.enabled;
  if (typeof n.default_time === 'string' && /^([01]?\d|2[0-3]) h [0-5]\d$/.test(n.default_time)) NOTIF.default_time = n.default_time;
  const nt = str(n.title, 80); if (nt) NOTIF.title = nt;
  const nb = str(n.body, 200); if (nb) NOTIF.body = nb;
}

async function fetchConfig(ms: number): Promise<Config | null> {
  if (!URL || !KEY) return null;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const h: Record<string, string> = KEY.startsWith('sb_') ? { apikey: KEY } : { apikey: KEY, Authorization: `Bearer ${KEY}` };
    const r = await fetch(`${URL}/rest/v1/rpc/app_config`, { method: 'POST', headers: { ...h, 'Content-Type': 'application/json' }, body: '{}', signal: ctl.signal });
    return r.ok ? ((await r.json()) as Config) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function loadFont(id: string, ms: number) {
  const f = FONTS[id];
  if (!f || id === 'archivo') return;
  const fam = (w: number) => `${id}_${w}`;
  const src = (w: number) => `https://cdn.jsdelivr.net/fontsource/fonts/${id}@latest/latin-${w}-normal.ttf`;
  const all = Object.fromEntries(f.w.map((w) => [fam(w), src(w)]));
  const ok = await Promise.race([Font.loadAsync(all).then(() => true, () => false), new Promise<boolean>((r) => setTimeout(() => r(false), ms))]);
  if (ok) Object.assign(F, { regular: fam(f.w[0]), semi: fam(f.w[1]), black: fam(f.w[2]) });
}

/** À attendre avant d'importer les écrans. Ne lève jamais d'erreur. */
export async function bootBrand(): Promise<void> {
  try {
    const cached = await getLocal(CACHE);
    if (cached) apply(JSON.parse(cached));
  } catch {}
  const fresh = await fetchConfig(1500);
  if (fresh) {
    apply(fresh);
    setLocal(CACHE, JSON.stringify({ brand: fresh.brand, texts: fresh.texts, notifications: fresh.notifications }));
  }
  await loadFont(BRAND.font, 3000);
}

/** Texte de la notification pour ce lecteur. */
export const notifBody = (quota: number) => NOTIF.body.replaceAll('{n}', String(quota)).replaceAll('{nom}', BRAND.name);
