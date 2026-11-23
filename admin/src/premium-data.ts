// Premium et abonnements : accès aux données (Supabase, ou données fictives en mode démo).
import { sb } from './data';

export type Period = 'month' | 'year' | 'lifetime';
export type Plan = {
  id: string; name: string; period: Period; price_cents: number; currency: string; trial_days: number;
  apple_product_id: string | null; google_product_id: string | null; highlight: string | null; active: boolean; position: number;
};
export type SubStatus = 'trial' | 'active' | 'grace' | 'cancelled' | 'expired' | 'refunded' | 'revoked';
export type SubSource = 'app_store' | 'play_store' | 'web' | 'promo' | 'gift' | 'code';
export type Subscriber = {
  user_id: string; pseudo: string | null; email: string | null; sub_id: string; status: SubStatus; source: SubSource; plan: string | null;
  started_at: string; expires_at: string | null; auto_renew: boolean; price_cents: number | null; currency: string | null;
  sandbox: boolean; note: string | null; live: boolean;
};
export type SubEvent = { at: string; pseudo: string | null; kind: string; source: string | null; amount_cents: number | null; currency: string | null; sandbox: boolean; detail: string | null };
export type PromoCode = { code: string; days: number; max_uses: number | null; uses: number; expires_at: string | null; active: boolean; note: string | null; created_at: string };
export type PremiumStats = {
  premium: number; paying: number; trial: number; gift: number; cancelling: number; mrr_cents: number;
  revenue_30_cents: number; revenue_all_cents: number; new_30: number; conversions_30: number; churn_30: number; by_source: Record<string, number>;
};
export type SubFilter = 'live' | 'paying' | 'trial' | 'gift' | 'cancelled' | 'ended' | 'all';

export const STATUS: Record<SubStatus, string> = {
  trial: 'Essai gratuit', active: 'Actif', grace: 'Paiement en échec', cancelled: 'Résilié (fin à l’échéance)',
  expired: 'Terminé', refunded: 'Remboursé', revoked: 'Retiré',
};
export const SOURCE: Record<SubSource, string> = { app_store: 'App Store', play_store: 'Google Play', web: 'Web', promo: 'Promo store', gift: 'Offert', code: 'Code promo' };
export const FILTERS: Record<SubFilter, string> = {
  live: 'En cours', paying: 'Payants', trial: 'En essai', gift: 'Offerts', cancelled: 'Résiliés ou en échec', ended: 'Terminés', all: 'Tous',
};
export const PERIOD: Record<Period, string> = { month: 'par mois', year: 'par an', lifetime: 'une fois' };

export interface PremiumApi {
  stats(): Promise<PremiumStats>;
  subscribers(search: string, filter: SubFilter): Promise<Subscriber[]>;
  events(userId?: string | null): Promise<SubEvent[]>;
  grant(userId: string, days: number | null, note: string): Promise<void>;
  revoke(userId: string, note: string): Promise<void>;
  plans(): Promise<Plan[]>;
  savePlan(p: Partial<Plan> & { id: string }, isNew?: boolean): Promise<void>;
  codes(): Promise<PromoCode[]>;
  saveCode(c: Partial<PromoCode> & { code: string }, isNew?: boolean): Promise<void>;
  /** Pour la fiche lecteur : son abonnement le plus récent, s'il en a un. */
  ofUser(userId: string): Promise<Subscriber | null>;
}

function ok<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

function live(): PremiumApi {
  const c = sb!;
  return {
    stats: async () => ok(await c.rpc('premium_stats')) as PremiumStats,
    subscribers: async (search, filter) => ok(await c.rpc('admin_subscribers', { search, filter })) as Subscriber[],
    events: async (userId) => ok(await c.rpc('admin_sub_events', { uid: userId ?? null, lim: 300 })) as SubEvent[],
    async grant(userId, days, note) { ok(await c.rpc('admin_grant_premium', { uid: userId, days: days ?? 0, note: note || null })); },
    async revoke(userId, note) { ok(await c.rpc('admin_revoke_premium', { uid: userId, note: note || null })); },
    plans: async () => ok(await c.from('plans').select('*').order('position')) as Plan[],
    async savePlan(p, isNew) {
      if (isNew) ok(await c.from('plans').insert(p));
      else ok(await c.from('plans').update({ ...p, updated_at: new Date().toISOString() }).eq('id', p.id));
    },
    codes: async () => ok(await c.from('promo_codes').select('*').order('created_at', { ascending: false })) as PromoCode[],
    async saveCode(p, isNew) {
      if (isNew) { const { data } = await c.auth.getUser(); ok(await c.from('promo_codes').insert({ ...p, created_by: data.user?.id })); }
      else ok(await c.from('promo_codes').update(p).eq('code', p.code));
    },
    ofUser: async (userId) => {
      const rows = ok(await c.rpc('admin_subscribers', { search: '', filter: 'all', uid: userId })) as Subscriber[];
      return rows[0] ?? null;
    },
  };
}

/* ---------- Démo ---------- */
function demo(): PremiumApi {
  const iso = (days: number) => new Date(Date.now() + days * 86400e3).toISOString();
  const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), 120));
  let plans: Plan[] = [
    { id: 'annuel', name: 'Annuel', period: 'year', price_cents: 2499, currency: 'EUR', trial_days: 7, apple_product_id: 'titre_premium_annuel', google_product_id: 'titre_premium:annuel', highlight: '30 % moins cher', active: true, position: 0 },
    { id: 'mensuel', name: 'Mensuel', period: 'month', price_cents: 299, currency: 'EUR', trial_days: 7, apple_product_id: 'titre_premium_mensuel', google_product_id: 'titre_premium:mensuel', highlight: null, active: true, position: 1 },
  ];
  const sub = (i: number, pseudo: string, status: SubStatus, source: SubSource, plan: string | null, exp: number | null, extra: Partial<Subscriber> = {}): Subscriber => ({
    user_id: `u-p${i}`, pseudo, email: `${pseudo.toLowerCase()}@exemple.fr`, sub_id: `s${i}`, status, source, plan, started_at: iso(-40 + i),
    expires_at: exp === null ? null : iso(exp), auto_renew: source === 'app_store' || source === 'play_store' ? !['cancelled', 'expired', 'refunded'].includes(status) : false,
    price_cents: plan === 'Annuel' ? 2499 : plan === 'Mensuel' ? 299 : null, currency: plan ? 'EUR' : null, sandbox: false, note: null,
    live: ['trial', 'active', 'grace', 'cancelled'].includes(status) && (exp === null || exp > 0), ...extra,
  });
  let subs: Subscriber[] = [
    sub(1, 'Camille_R', 'active', 'app_store', 'Annuel', 320),
    sub(2, 'nico.dlt', 'trial', 'play_store', 'Mensuel', 4),
    sub(3, 'Inès', 'active', 'app_store', 'Mensuel', 18),
    sub(4, 'jb_lyon', 'cancelled', 'app_store', 'Mensuel', 9),
    sub(5, 'Sarah.M', 'grace', 'play_store', 'Mensuel', 2),
    sub(6, 'fen', 'active', 'gift', null, null, { note: 'Premium accordé avant les abonnements' }),
    sub(7, 'concours_noel', 'active', 'code', null, 21, { note: 'Code NOEL26' }),
    sub(8, 'Hugo', 'expired', 'app_store', 'Mensuel', -12),
  ];
  let events: SubEvent[] = [
    { at: iso(-0.1), pseudo: 'nico.dlt', kind: 'essai', source: 'play_store', amount_cents: null, currency: null, sandbox: false, detail: 'titre_premium:mensuel' },
    { at: iso(-1), pseudo: 'Sarah.M', kind: 'problème de paiement', source: 'play_store', amount_cents: null, currency: null, sandbox: false, detail: 'titre_premium:mensuel' },
    { at: iso(-2), pseudo: 'jb_lyon', kind: 'résiliation', source: 'app_store', amount_cents: null, currency: null, sandbox: false, detail: 'titre_premium_mensuel' },
    { at: iso(-3), pseudo: 'concours_noel', kind: 'code promo', source: 'code', amount_cents: null, currency: null, sandbox: false, detail: '30 jours · Code NOEL26' },
    { at: iso(-12), pseudo: 'Hugo', kind: 'expiration', source: 'app_store', amount_cents: null, currency: null, sandbox: false, detail: null },
    { at: iso(-12), pseudo: 'Inès', kind: 'renouvellement', source: 'app_store', amount_cents: 299, currency: 'EUR', sandbox: false, detail: 'titre_premium_mensuel' },
    { at: iso(-45), pseudo: 'Camille_R', kind: 'conversion', source: 'app_store', amount_cents: 2499, currency: 'EUR', sandbox: false, detail: 'titre_premium_annuel' },
  ];
  let codes: PromoCode[] = [{ code: 'NOEL26', days: 30, max_uses: 500, uses: 37, expires_at: iso(40), active: true, note: 'Concours de Noël', created_at: iso(-5) }];
  return {
    stats: () => wait<PremiumStats>({
      premium: subs.filter((s) => s.live).length, paying: subs.filter((s) => s.live && ['app_store', 'play_store', 'web'].includes(s.source) && s.status !== 'trial').length,
      trial: subs.filter((s) => s.live && s.status === 'trial').length, gift: subs.filter((s) => s.live && ['gift', 'code', 'promo'].includes(s.source)).length,
      cancelling: subs.filter((s) => s.live && ['cancelled', 'grace'].includes(s.status)).length, mrr_cents: Math.round(2499 / 12 + 299 + 299),
      revenue_30_cents: 299, revenue_all_cents: 2798, new_30: 2, conversions_30: 0, churn_30: 1, by_source: { app_store: 3, play_store: 2, gift: 1, code: 1 },
    }),
    subscribers: (search, filter) => wait(subs.filter((s) => (!search || `${s.pseudo} ${s.email}`.toLowerCase().includes(search.toLowerCase())) && ({
      live: s.live, trial: s.live && s.status === 'trial', paying: s.live && ['app_store', 'play_store', 'web'].includes(s.source) && s.status !== 'trial',
      gift: s.live && ['gift', 'code', 'promo'].includes(s.source), cancelled: s.live && ['cancelled', 'grace'].includes(s.status), ended: !s.live, all: true,
    } as Record<SubFilter, boolean>)[filter])),
    events: (userId) => wait(userId ? events.filter((e) => e.pseudo === subs.find((s) => s.user_id === userId)?.pseudo) : events),
    async grant(userId, days, note) {
      const s = subs.find((x) => x.user_id === userId);
      const base = s?.live && s.expires_at ? new Date(s.expires_at).getTime() : Date.now();
      const exp = days ? new Date(base + days * 86400e3).toISOString() : null;
      const row: Subscriber = { ...(s ?? sub(subs.length + 1, 'lecteur', 'active', 'gift', null, null)), user_id: userId, status: 'active', source: 'gift', plan: null, expires_at: exp, live: true, note: note || null, auto_renew: false };
      subs = [row, ...subs.filter((x) => x.user_id !== userId)];
      events.unshift({ at: new Date().toISOString(), pseudo: row.pseudo, kind: 'offert', source: 'gift', amount_cents: null, currency: null, sandbox: false, detail: `${days ? `${days} jours` : 'À vie'}${note ? ` · ${note}` : ''}` });
    },
    async revoke(userId, note) {
      subs = subs.map((s) => (s.user_id === userId ? { ...s, status: 'revoked', live: false, note: note || s.note } : s));
      events.unshift({ at: new Date().toISOString(), pseudo: subs.find((s) => s.user_id === userId)?.pseudo ?? null, kind: 'retiré', source: null, amount_cents: null, currency: null, sandbox: false, detail: note || null });
    },
    plans: () => wait([...plans].sort((a, b) => a.position - b.position)),
    async savePlan(p, isNew) { plans = isNew ? [...plans, { ...plans[0], ...p } as Plan] : plans.map((x) => (x.id === p.id ? { ...x, ...p } : x)); },
    codes: () => wait(codes),
    async saveCode(c, isNew) { codes = isNew ? [{ uses: 0, active: true, max_uses: null, expires_at: null, note: null, days: 30, created_at: new Date().toISOString(), ...c }, ...codes] : codes.map((x) => (x.code === c.code ? { ...x, ...c } : x)); },
    ofUser: async (userId) => wait(subs.find((s) => s.user_id === userId) ?? null),
  };
}

export const premiumApi: PremiumApi = sb ? live() : demo();
