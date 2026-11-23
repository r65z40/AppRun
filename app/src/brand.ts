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

/** Règles de l'app (Personnalisation > Règles de l'app). */
export const RULES = {
  /** Rubriques cochées pour un nouveau lecteur. */
  default_rubrics: ['france', 'monde', 'eco', 'tech'],
  /** Nombre d'infos par jour proposé à un nouveau lecteur, et maximum de la roue (de 4 en 4). */
  default_quota: 24,
  quota_max: 60,
  /** Première pub après la N-ième info, puis une toutes les N infos (version gratuite). */
  ad_first: 3,
  ad_every: 6,
  /** Heure annoncée sur l'écran de fin de journée. */
  next_edition: '6 h 00',
  /** Réactions proposées en mode emoji. */
  emojis: ['❤️', '😂', '😮', '😢', '😡', '👏'],
  /** Avantages affichés dans le volet Premium ({nom} = nom de l'app). */
  premium_benefits: ['Zéro pub dans votre fil', 'Le badge Premium à côté de votre pseudo', 'Vous soutenez {nom} directement'],
  /** Rechargement de l'édition et de la Dernière minute, en minutes. */
  edition_refresh_min: 10,
  live_refresh_min: 3,
};

/** Rappels de temps en temps : créer un compte (sans compte) ou passer Premium (compte gratuit). */
export const NUDGES = {
  account: { enabled: true, every_days: 3, after_cards: 4, text: 'Votre compte gratuit : une édition qui apprend de vos likes et dislikes, sur tous vos appareils.' },
  premium: { enabled: true, every_days: 5, after_cards: 6 },
};

/** Reconnaissance (back office > Lecteurs > Reconnaissance). */
export const RECOG = {
  /** Minutes gagnées par info lue, par rapport à un article classique. */
  minutes_per_article: 3,
  /** Icônes de badges à côté du pseudo (les autres se voient en touchant le pseudo). */
  max_icons: 3,
  /** Le pseudo prend la couleur de son premier badge. */
  color_pseudo: true,
};

type Config = { recognition?: Record<string, unknown> | null; brand?: Record<string, unknown> | null; texts?: Record<string, unknown> | null; notifications?: Record<string, unknown> | null; rules?: Record<string, unknown> | null; nudges?: Record<string, unknown> | null };

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const CACHE = 'titre.config';
const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const str = (v: unknown, max = 400) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

const DEF = { recog: { ...RECOG }, brand: { ...BRAND }, texts: { ...TEXTS }, notif: { ...NOTIF }, rules: JSON.parse(JSON.stringify(RULES)) as typeof RULES, nudges: JSON.parse(JSON.stringify(NUDGES)) as typeof NUDGES };
const int = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : null);
const strs = (v: unknown, max: number, len = 120) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).map((x) => x.trim().slice(0, len)).slice(0, max) : []);

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
  applyRules(c.rules ?? {}, c.nudges ?? {});
  Object.assign(RECOG, DEF.recog);
  const g = c.recognition ?? {};
  const mp = typeof g.minutes_per_article === 'number' && g.minutes_per_article >= 0 && g.minutes_per_article <= 60 ? g.minutes_per_article : null;
  if (mp !== null) RECOG.minutes_per_article = mp;
  const mi = int(g.max_icons, 0, 6); if (mi !== null) RECOG.max_icons = mi;
  if (typeof g.color_pseudo === 'boolean') RECOG.color_pseudo = g.color_pseudo;
}

function applyRules(r: Record<string, unknown>, g: Record<string, unknown>) {
  Object.assign(RULES, JSON.parse(JSON.stringify(DEF.rules)));
  Object.assign(NUDGES, JSON.parse(JSON.stringify(DEF.nudges)));
  const rub = strs(r.default_rubrics, 20, 40); if (rub.length) RULES.default_rubrics = rub;
  const qm = int(r.quota_max, 8, 100); if (qm) RULES.quota_max = qm - (qm % 4);
  const dq = int(r.default_quota, 4, RULES.quota_max); if (dq) RULES.default_quota = dq - (dq % 4) || 4;
  const af = int(r.ad_first, 1, 20); if (af) RULES.ad_first = af;
  const ae = int(r.ad_every, 2, 30); if (ae) RULES.ad_every = ae;
  if (typeof r.next_edition === 'string' && /^([01]?\d|2[0-3]) h [0-5]\d$/.test(r.next_edition)) RULES.next_edition = r.next_edition;
  const em = strs(r.emojis, 8, 8); if (em.length >= 2) RULES.emojis = em;
  const pb = strs(r.premium_benefits, 6); if (pb.length) RULES.premium_benefits = pb;
  const er = int(r.edition_refresh_min, 2, 120); if (er) RULES.edition_refresh_min = er;
  const lr = int(r.live_refresh_min, 1, 60); if (lr) RULES.live_refresh_min = lr;
  for (const k of ['account', 'premium'] as const) {
    const x = (g[k] ?? {}) as Record<string, unknown>;
    const d = NUDGES[k] as { enabled: boolean; every_days: number; after_cards: number; text?: string };
    if (typeof x.enabled === 'boolean') d.enabled = x.enabled;
    const ed = int(x.every_days, 1, 60); if (ed) d.every_days = ed;
    const ac = int(x.after_cards, 1, 30); if (ac) d.after_cards = ac;
    const tx = str(x.text, 200); if (tx && k === 'account') d.text = tx;
  }
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
    setLocal(CACHE, JSON.stringify({ brand: fresh.brand, texts: fresh.texts, notifications: fresh.notifications, rules: fresh.rules, nudges: fresh.nudges, recognition: fresh.recognition }));
  }
  await loadFont(BRAND.font, 3000);
}

/** Temps gagné, lisible : « 45 min », « 3 h 20 », « 52 h ». */
export function savedLabel(min: number) {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  if (m < 600) return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
  return `${Math.round(m / 60).toLocaleString('fr-FR')} h`;
}

/** Texte de la notification pour ce lecteur. */
export const notifBody = (quota: number) => NOTIF.body.replaceAll('{n}', String(quota)).replaceAll('{nom}', BRAND.name);
