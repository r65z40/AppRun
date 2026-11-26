// Régie publicitaire : fréquence des pubs, campagnes, emplacements, objectifs d'affichages avec rythme régulier,
// sponsor exclusif, ciblage, suivi et prévision, statistiques et revenus estimés.
import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { api, RUBRICS, sb } from './data';

export type Campaign = {
  id: string; name: string; advertiser: string; title: string; body: string; cta: string; url: string; image_url: string | null;
  active: boolean; exclusive: boolean; starts_on: string; ends_on: string | null; rubrics: string[]; weight: number;
  max_views: number | null; pricing: 'cpm' | 'flat'; price: number; created_at: string;
  placements: Place[]; priority: 1 | 2 | 3; pacing: 'even' | 'fast';
};
type Place = 'edition' | 'flash' | 'rubrics';
/** impressions = pub apparue, même très brièvement ; views = affichages (1 s à l'écran) ; absente avant la migration 0039. */
type Stat = { campaign_id: string; day: string; impressions?: number; views: number; clicks: number; placement?: Place };
const imps = (s: Stat) => s.impressions ?? s.views;
/** Rythme calculé par la base (fonction ad_report) : livré, part du jour, coefficient appliqué. */
type Pace = { id: string; delivered: number; today: number; need_today: number | null; expected_now: number | null; days_left: number | null; factor: number };
const PLACES: [Place, string][] = [['edition', 'Mon édition'], ['flash', 'Dernière minute'], ['rubrics', 'Rubriques']];
const PRIORITY: Record<number, [string, string]> = {
  1: ['Haute', 'Passe avant les autres : pour les campagnes vendues avec un volume garanti.'],
  2: ['Normale', 'Partage les emplacements avec les autres selon le poids.'],
  3: ['Remplissage', 'Seulement quand il reste de la place (campagnes maison, partenaires).'],
};
const DAY = 86400e3;
const days = (a: string, b: string) => Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / DAY);
type Draft = Omit<Campaign, 'id' | 'created_at'> & { id?: string };

const today = () => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());
const dayShift = (d: number) => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date(Date.now() + d * 86400e3));
const fr = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
const int = (n: number) => n.toLocaleString('fr-FR');
const eur = (n: number) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const pct = (c: number, v: number) => (v ? `${((c / v) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %` : '—');

/* ---------- Données : Supabase, ou démo en mémoire ---------- */
let demoList: Campaign[] = [
  { id: 'c1', name: 'Lumen hiver', advertiser: 'Maison Lumen', title: 'Lire le soir, sans fatiguer vos yeux', body: 'Une lampe de lecture rechargeable à lumière chaude.', cta: "Découvrir l'offre", url: 'https://exemple.test/lumen', image_url: null, active: true, exclusive: false, starts_on: dayShift(-10), ends_on: dayShift(20), rubrics: [], weight: 2, max_views: 30000, pricing: 'cpm', price: 8, created_at: '', placements: ['edition', 'flash', 'rubrics'], priority: 1, pacing: 'even' },
  { id: 'c2', name: 'Vélo urbain', advertiser: 'Rayon', title: 'Le vélo électrique qui se plie', body: '12 kg, 60 km d’autonomie.', cta: 'Voir le vélo', url: 'https://exemple.test/rayon', image_url: null, active: true, exclusive: false, starts_on: dayShift(-3), ends_on: null, rubrics: ['tech', 'ecologie'], weight: 1, max_views: 50000, pricing: 'cpm', price: 12, created_at: '', placements: ['edition', 'rubrics'], priority: 2, pacing: 'fast' },
  { id: 'c3', name: 'Banque partenaire, semaine exclusive', advertiser: 'Banque Horizon', title: 'Votre compte en 5 minutes', body: 'Sans frais la première année.', cta: 'Ouvrir un compte', url: 'https://exemple.test/horizon', image_url: null, active: true, exclusive: true, starts_on: dayShift(5), ends_on: dayShift(11), rubrics: [], weight: 1, max_views: null, pricing: 'flat', price: 1500, created_at: '', placements: ['edition', 'flash', 'rubrics'], priority: 2, pacing: 'even' },
];
const demoStats: Stat[] = demoList.slice(0, 2).flatMap((c, k) =>
  Array.from({ length: 10 }, (_, i) => (['edition', 'flash'] as Place[]).map((p) => ({
    campaign_id: c.id, day: dayShift(-i), placement: p,
    views: Math.round((900 + ((i * 37 + k * 11) % 400)) * (p === 'edition' ? 0.8 : 0.2) * (i === 0 ? 0.55 : 1)),
    clicks: Math.round((9 + ((i * 7 + k) % 12)) * (p === 'edition' ? 0.8 : 0.2)),
  }))).flat().map((s, i) => ({ ...s, impressions: Math.round(s.views * (1.25 + (i % 5) * 0.04)) })));

const real = (sb: SupabaseClient) => ({
  list: async () => { const r = await sb.from('ad_campaigns').select('*').order('starts_on', { ascending: false }); if (r.error) throw new Error(r.error.message); return r.data as Campaign[]; },
  stats: async () => { const r = await sb.from('ad_stats').select('*'); if (r.error) throw new Error(r.error.message); return r.data as Stat[]; },
  async save(c: Partial<Draft>) {
    const { id, ...rest } = c;
    const r = id ? await sb.from('ad_campaigns').update(rest).eq('id', id) : await sb.from('ad_campaigns').insert({ ...rest, created_by: (await sb.auth.getUser()).data.user?.id });
    if (r.error) throw new Error(r.error.message);
  },
  async remove(id: string) { const r = await sb.from('ad_campaigns').delete().eq('id', id); if (r.error) throw new Error(r.error.message); },
  // Base pas encore à jour (migration 0025 non passée) : pas de rythme, la page reste utilisable.
  pacing: async () => { const r = await sb.rpc('ad_report'); return r.error ? [] : (r.data as Pace[]); },
});
const ads = sb ? real(sb) : {
  list: async () => [...demoList],
  stats: async () => demoStats,
  async save(c: Partial<Draft>) {
    if (c.id) demoList = demoList.map((x) => (x.id === c.id ? { ...x, ...c } as Campaign : x));
    else demoList = [{ ...(c as Draft), id: `c${Date.now()}`, created_at: new Date().toISOString() }, ...demoList];
  },
  async remove(id: string) { demoList = demoList.filter((x) => x.id !== id); },
  // Démo : même calcul que la base, en simplifié (journée écoulée à 55 %).
  pacing: async () => demoList.filter((c) => !c.ends_on || c.ends_on >= today()).map((c): Pace => {
    const mine = demoStats.filter((x) => x.campaign_id === c.id);
    const before = mine.filter((x) => x.day < today()).reduce((n, x) => n + x.views, 0);
    const done = mine.filter((x) => x.day === today()).reduce((n, x) => n + x.views, 0);
    const left = c.ends_on ? days(today() > c.starts_on ? today() : c.starts_on, c.ends_on) + 1 : null;
    const need = c.max_views && left ? Math.max(0, c.max_views - before) / left : null;
    const factor = need === null || c.pacing === 'fast' ? 1 : done >= need * 1.05 ? 0 : Math.min(5, Math.max(0.2, (need * 0.55 + 1) / (done + 1)));
    return { id: c.id, delivered: before + done, today: done, need_today: need, expected_now: need && need * 0.55, days_left: left, factor };
  }),
};

/* ---------- État d'une campagne ---------- */
type State = 'live' | 'hidden' | 'planned' | 'ended' | 'paused' | 'capped';
const STATE: Record<State, [string, string]> = {
  live: ['En cours', 'published'], hidden: ['Masquée par le sponsor exclusif', 'draft'], planned: ['Programmée', 'draft'],
  ended: ['Terminée', 'rejected'], paused: ['En pause', 'rejected'], capped: ['Objectif atteint', 'published'],
};
function stateOf(c: Campaign, views: number, exclusiveLive: boolean): State {
  const d = today();
  if (!c.active) return 'paused';
  if (c.starts_on > d) return 'planned';
  if (c.ends_on && c.ends_on < d) return 'ended';
  if (c.max_views && views >= c.max_views) return 'capped';
  return exclusiveLive && !c.exclusive ? 'hidden' : 'live';
}
const revenue = (c: Campaign, views: number) => (c.pricing === 'flat' ? Number(c.price) : (views / 1000) * Number(c.price));

const empty = (): Draft => ({
  name: '', advertiser: '', title: '', body: '', cta: 'Découvrir', url: 'https://', image_url: null, active: true, exclusive: false,
  starts_on: today(), ends_on: null, rubrics: [], weight: 1, max_views: null, pricing: 'cpm', price: 0,
  placements: ['edition', 'flash', 'rubrics'], priority: 2, pacing: 'even',
});

/* ---------- Objectif : avancement et prévision ---------- */
type Plan = { goal: number; delivered: number; pct: number; expectedPct: number | null; need: number | null; rate: number | null; forecast: number | null; tone: 'ok' | 'late' | 'ahead' | 'done' | 'wait'; text: string };
const fmtFactor = (f: number) => f.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
function planOf(c: Campaign, mine: Stat[], pace: Pace | undefined, st: State): Plan | null {
  if (!c.max_views) return null;
  const goal = c.max_views;
  const t = today();
  const delivered = mine.reduce((n, x) => n + x.views, 0);
  const before = mine.filter((x) => x.day < t).reduce((n, x) => n + x.views, 0);
  const pct = Math.min(1, delivered / goal);
  const total = c.ends_on ? days(c.starts_on, c.ends_on) + 1 : null;
  const elapsed = total ? Math.min(total, Math.max(0, days(c.starts_on, t) + 0.5)) : null;
  const expectedPct = total && elapsed !== null ? elapsed / total : null;
  const left = c.ends_on ? days(t > c.starts_on ? t : c.starts_on, c.ends_on) + 1 : null;
  const need = left && left > 0 ? Math.max(0, goal - before) / left : null;
  // Rythme réel : moyenne des 3 derniers jours complets.
  const last = Array.from({ length: 3 }, (_, i) => dayShift(-1 - i)).filter((d) => d >= c.starts_on);
  const rate = last.length ? last.reduce((n, d) => n + mine.filter((x) => x.day === d).reduce((v, x) => v + x.views, 0), 0) / last.length : null;
  const forecast = left !== null && rate !== null ? Math.min(goal, Math.max(delivered, before + rate * left)) : null;
  const base = { goal, delivered, pct, expectedPct, need, rate, forecast };
  if (delivered >= goal) return { ...base, tone: 'done', text: 'Objectif atteint : la campagne s’est arrêtée.' };
  if (st === 'planned') return { ...base, tone: 'wait', text: need ? `Démarre le ${fr(c.starts_on)} : il faudra ≈ ${int(Math.ceil(goal / (total ?? 1)))} affichages par jour.` : `Démarre le ${fr(c.starts_on)}.` };
  if (st === 'ended') return { ...base, tone: 'late', text: `Terminée à ${Math.round(pct * 100)} % de l’objectif.` };
  if (!c.ends_on) return { ...base, tone: 'ok', text: 'Sans date de fin : elle passe jusqu’à atteindre l’objectif.' };
  const speed = pace ? (pace.factor === 0 ? ' Part du jour faite : elle reprend demain.' : pace.factor >= 1.2 ? ` Le système l’accélère (×${fmtFactor(pace.factor)}).` : pace.factor <= 0.8 ? ` Le système la freine (×${fmtFactor(pace.factor)}).` : '') : '';
  if (forecast === null) return { ...base, tone: 'wait', text: `Il faut ≈ ${int(Math.ceil(need ?? 0))} affichages par jour. Prévision dès demain.${speed}` };
  if (forecast >= goal * 0.98) {
    const ahead = expectedPct !== null && pct > expectedPct * 1.1;
    return { ...base, tone: ahead ? 'ahead' : 'ok', text: `${ahead ? 'En avance' : 'Dans les temps'} : objectif atteint d’ici le ${fr(c.ends_on)}.${speed}` };
  }
  return { ...base, tone: 'late', text: `En retard : prévu ≈ ${int(Math.round(forecast))} (${Math.round((forecast / goal) * 100)} %) au ${fr(c.ends_on)}. Il faut ≈ ${int(Math.ceil(need ?? 0))} par jour, elle en fait ≈ ${int(Math.round(rate ?? 0))}.${speed}` };
}
const TONE: Record<Plan['tone'], string> = { ok: 'var(--green)', ahead: 'var(--green)', done: 'var(--green)', late: 'var(--coral)', wait: 'var(--text2)' };
function Progress({ p }: { p: Plan }) {
  return (
    <div style={{ minWidth: 160 }}>
      <div style={{ position: 'relative', height: 8, borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden' }}>
        <div style={{ width: `${p.pct * 100}%`, height: '100%', background: TONE[p.tone] }} />
        {p.expectedPct !== null && p.tone !== 'done' ? <div title="Où elle devrait en être aujourd’hui" style={{ position: 'absolute', top: 0, bottom: 0, left: `calc(${Math.min(1, p.expectedPct) * 100}% - 1px)`, width: 2, background: 'var(--text)' }} /> : null}
      </div>
      <div className="small" style={{ marginTop: 6 }}>{int(p.delivered)} / {int(p.goal)} · {Math.round(p.pct * 100)} %</div>
      <div className="small" style={{ color: TONE[p.tone] }}>{p.text.replace(/\.\.+/g, '.')}</div>
    </div>
  );
}

/* ---------- Page ---------- */
export function AdsPage({ say }: { say: (m: string) => void }) {
  const [list, setList] = useState<Campaign[] | null>(null);
  const [stats, setStats] = useState<Stat[]>([]);
  const [pace, setPace] = useState<Pace[]>([]);
  const [form, setForm] = useState<Draft | null>(null);
  const err = (e: unknown) => say(e instanceof Error ? e.message : 'Action impossible');
  const load = () => Promise.all([ads.list().then(setList), ads.stats().then(setStats), ads.pacing().then(setPace)]).catch((e) => { setList([]); err(e); });
  useEffect(() => { load(); }, []);

  const by = useMemo(() => {
    const m: Record<string, { imps: number; views: number; clicks: number; i7: number; v7: number; c7: number }> = {};
    const from7 = dayShift(-6);
    for (const s of stats) {
      const x = (m[s.campaign_id] ??= { imps: 0, views: 0, clicks: 0, i7: 0, v7: 0, c7: 0 });
      x.imps += imps(s); x.views += s.views; x.clicks += s.clicks;
      if (s.day >= from7) { x.i7 += imps(s); x.v7 += s.views; x.c7 += s.clicks; }
    }
    return m;
  }, [stats]);
  const views = (c: Campaign) => by[c.id]?.views ?? 0;
  // Capacité : affichages pub servis par jour (moyenne des 7 derniers jours complets), et part réservée par les objectifs.
  const capacity = useMemo(() => {
    const from = dayShift(-7), t = today();
    const per = new Map<string, number>();
    for (const x of stats) if (x.day >= from && x.day < t) per.set(x.day, (per.get(x.day) ?? 0) + x.views);
    return per.size ? [...per.values()].reduce((a, b) => a + b, 0) / per.size : 0;
  }, [stats]);

  if (!list) return <p className="muted">Chargement…</p>;
  const exclusiveRaw = list.filter((c) => stateOf(c, views(c), false) === 'live' && c.exclusive);
  const states = new Map(list.map((c) => [c.id, stateOf(c, views(c), exclusiveRaw.length > 0)]));
  const live = list.filter((c) => states.get(c.id) === 'live');
  const plans = new Map(list.map((c) => [c.id, planOf(c, stats.filter((x) => x.campaign_id === c.id), pace.find((x) => x.id === c.id), states.get(c.id)!)]));
  const reserved = live.reduce((n, c) => n + (c.pacing === 'even' && !c.exclusive ? plans.get(c.id)?.need ?? 0 : 0), 0);
  const late = list.filter((c) => states.get(c.id) === 'live' && plans.get(c.id)?.tone === 'late');
  const sum = (k: 'i7' | 'v7' | 'c7') => Object.values(by).reduce((n, x) => n + x[k], 0);
  const from30 = dayShift(-29);
  const rev30 = list.reduce((n, c) => {
    if (c.pricing === 'flat') return n + (c.starts_on >= from30 && c.starts_on <= today() ? Number(c.price) : 0);
    return n + (stats.filter((s) => s.campaign_id === c.id && s.day >= from30).reduce((v, s) => v + s.views, 0) / 1000) * Number(c.price);
  }, 0);

  // Deux sponsors exclusifs dont les dates se chevauchent : ils se partageraient l'app.
  const overlaps = list.filter((a) => a.exclusive && a.active).flatMap((a) => list
    .filter((b) => b.id > a.id && b.exclusive && b.active && a.starts_on <= (b.ends_on ?? '9999') && b.starts_on <= (a.ends_on ?? '9999'))
    .map((b) => `${a.name} et ${b.name}`));

  const save = async (d: Draft) => {
    if (!/^https:\/\/.+\..+/.test(d.url)) return say('Le lien doit commencer par https:// et mener à une vraie page');
    if (!d.placements.length) return say('Cochez au moins un emplacement');
    await ads.save({ ...d, ends_on: d.ends_on || null, max_views: d.max_views || null })
      .then(() => { say(d.id ? 'Campagne mise à jour' : 'Campagne créée'); setForm(null); load(); }).catch(err);
  };

  return (
    <>
      <header className="head">
        <div>
          <div className="eyebrow">Publicité</div>
          <h1>Régie publicitaire</h1>
          <p className="muted">Les pubs passent chez les lecteurs gratuits, au rythme choisi ci-dessous. Les abonnés Premium n'en voient aucune, et jamais juste après un sujet sensible. Donnez un objectif d'affichages et une date de fin à une campagne : le système l'accélère ou la freine pour qu'elle l'atteigne pile à temps.</p>
        </div>
        <div className="actions"><button className="btn primary" onClick={() => setForm(empty())}>Nouvelle campagne</button></div>
      </header>

      <div className={`status-bar ${live.length ? '' : 'off'}`}>
        <b>{exclusiveRaw.length ? `Sponsor exclusif : ${exclusiveRaw.map((c) => c.advertiser).join(', ')}` : live.length ? `${live.length} campagne${live.length > 1 ? 's' : ''} en rotation` : 'Aucune pub dans l’app en ce moment'}</b>
        <span className="muted small">
          {exclusiveRaw.length ? `Seul annonceur visible${exclusiveRaw[0].ends_on ? ` jusqu'au ${fr(exclusiveRaw[0].ends_on)} inclus` : ''} ; les autres campagnes reprennent ensuite.` : live.length ? live.map((c) => c.advertiser).join(' · ') : 'Créez une campagne ou relancez-en une.'}
        </span>
      </div>
      {overlaps.length ? <p className="warn">Sponsors exclusifs aux dates qui se chevauchent : {overlaps.join(' ; ')}. Pendant ces jours-là, ils se partagent les emplacements.</p> : null}

      <Frequency say={say} />

      <div className="tiles">
        <div className="panel tile">
          <div className="muted small">Capacité pub par jour</div>
          <div className="tile-v">{capacity ? `≈ ${int(Math.round(capacity))}` : '—'}</div>
          <div className="muted small">{capacity ? `Objectifs en cours : ≈ ${int(Math.round(reserved))} par jour (${Math.round((reserved / capacity) * 100)} %)` : 'Pas encore d’historique : revenez dans quelques jours.'}</div>
        </div>
        <div className="panel tile"><div className="muted small">Impressions, 7 jours</div><div className="tile-v">{int(sum('i7'))}</div><div className="muted small">Pub apparue à l'écran, même un instant</div></div>
        <div className="panel tile"><div className="muted small">Affichages, 7 jours</div><div className="tile-v">{int(sum('v7'))}</div><div className="muted small">Visibilité {pct(sum('v7'), sum('i7'))} (restée 1 s)</div></div>
        <div className="panel tile"><div className="muted small">Clics, 7 jours</div><div className="tile-v">{int(sum('c7'))}</div><div className="muted small">Taux de clic {pct(sum('c7'), sum('v7'))}</div></div>
        <div className="panel tile"><div className="muted small">Revenus estimés, 30 jours</div><div className="tile-v">{eur(rev30)}</div><div className="muted small">Affichages × prix pour 1 000, plus les forfaits commencés</div></div>
      </div>

      {capacity && reserved > capacity * 0.9 ? <p className="warn">Les objectifs en cours demandent ≈ {int(Math.round(reserved))} affichages par jour pour ≈ {int(Math.round(capacity))} possibles : certains ne seront pas tenus. Montez la fréquence des pubs, repoussez une date de fin ou baissez un objectif.</p> : null}
      {late.length && !(capacity && reserved > capacity * 0.9) ? <p className="warn">En retard : {late.map((c) => c.name).join(', ')}. Passez-les en priorité haute, ajoutez des emplacements, ou montez la fréquence des pubs.</p> : null}

      {form ? <CampaignForm d={form} onCancel={() => setForm(null)} onSave={save} say={say} free={capacity ? Math.max(0, capacity - reserved + (form.id ? plans.get(form.id)?.need ?? 0 : 0)) : null} /> : null}

      <h2>Campagnes</h2>
      {list.length ? (
        <table className="table">
          <thead><tr><th>Campagne</th><th>Dates</th><th>Objectif</th><th>Impressions</th><th>Affichages</th><th>Clics</th><th>Revenu estimé</th><th /></tr></thead>
          <tbody>
            {list.map((c) => {
              const st = states.get(c.id)!;
              const s = by[c.id] ?? { imps: 0, views: 0, clicks: 0 };
              return (
                <tr key={c.id}>
                  <td>
                    <b>{c.name}</b> <span className={`pill ${STATE[st][1]}`}>{STATE[st][0]}</span>{c.exclusive ? <span className="pill" style={{ marginLeft: 6 }}>Exclusif</span> : null}
                    <div className="muted small">{c.advertiser} · {c.rubrics.length ? c.rubrics.map((r) => RUBRICS[r] ?? r).join(', ') : 'tout le monde'}{c.exclusive ? '' : ` · poids ${c.weight} · priorité ${PRIORITY[c.priority ?? 2][0].toLowerCase()}`}</div>
                    <div className="muted small">{(c.placements ?? ['edition']).map((p) => PLACES.find((x) => x[0] === p)?.[1]).join(' · ')}{c.max_views && c.ends_on ? ` · ${c.pacing === 'fast' ? 'au plus vite' : 'rythme régulier'}` : ''}</div>
                  </td>
                  <td className="small">{fr(c.starts_on)} → {c.ends_on ? fr(c.ends_on) : 'sans fin'}</td>
                  <td>{plans.get(c.id) ? <Progress p={plans.get(c.id)!} /> : <span className="muted small">Aucun</span>}</td>
                  <td>{int(s.imps)}</td>
                  <td>{int(s.views)}<div className="muted small">visibilité {pct(s.views, s.imps)}</div><Split stats={stats.filter((x) => x.campaign_id === c.id)} /></td>
                  <td>{int(s.clicks)}<div className="muted small">{pct(s.clicks, s.views)}</div></td>
                  <td>{eur(revenue(c, s.views))}<div className="muted small">{c.pricing === 'flat' ? 'forfait' : `${eur(Number(c.price))} / 1 000`}</div></td>
                  <td>
                    <div className="actions">
                      <button className="btn sm" onClick={() => setForm({ ...c })}>Modifier</button>
                      <button className="btn sm" title="Tableau à envoyer à l'annonceur (s'ouvre dans Excel)" onClick={() => report(c, stats.filter((x) => x.campaign_id === c.id))}>Rapport</button>
                      <button className="btn sm" onClick={() => ads.save({ id: c.id, active: !c.active }).then(() => { load(); say(c.active ? 'Campagne en pause' : 'Campagne relancée'); }).catch(err)}>{c.active ? 'Pause' : 'Relancer'}</button>
                      <button className="btn sm ghost" onClick={() => { if (confirm(`Supprimer « ${c.name} » et ses statistiques ?`)) ads.remove(c.id).then(() => { load(); say('Campagne supprimée'); }).catch(err); }}>Supprimer</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : <p className="muted">Aucune campagne pour l'instant.</p>}
      <p className="muted small">Une impression compte dès que la pub apparaît à l'écran, même une fraction de seconde. Un affichage compte quand la pub reste une seconde à l'écran, app ouverte, une fois par emplacement et par ouverture de l'app. Chaque affichage porte un numéro unique : renvoyé deux fois, il ne compte qu'une fois. Hors ligne, l'app le garde et l'envoie au retour du réseau (jusqu'à 72 h). Au-delà de 30 affichages d'une même campagne par téléphone et par jour, ou de 3 000 par connexion, le surplus est ignoré (abus). Un clic ne compte que sur un affichage compté. Les objectifs et le prix pour 1 000 se calculent sur les affichages. « Rapport » télécharge le bilan jour par jour d'une campagne, prêt à envoyer à l'annonceur. Aucune donnée sur le lecteur n'est enregistrée. Le ciblage par rubrique ne s'applique qu'aux lecteurs qui ont accepté les pubs selon leurs centres d'intérêt ; les autres ne voient que les campagnes sans ciblage.</p>
    </>
  );
}

/** Bilan d'une campagne pour l'annonceur : un fichier CSV (Excel, Numbers, Google Sheets), jour par jour et par emplacement. */
function report(c: Campaign, stats: Stat[]) {
  const rows = [...stats].sort((a, b) => a.day.localeCompare(b.day) || (a.placement ?? '').localeCompare(b.placement ?? ''));
  const rate = (a: number, b: number) => (b ? ((a / b) * 100).toFixed(2).replace('.', ',') : '');
  const line = (cells: (string | number)[]) => cells.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(';');
  const tot = rows.reduce((t, s) => ({ i: t.i + imps(s), v: t.v + s.views, k: t.k + s.clicks }), { i: 0, v: 0, k: 0 });
  const csv = [
    line([`Campagne : ${c.name}`]), line([`Annonceur : ${c.advertiser}`]),
    line([`Période : du ${c.starts_on} au ${c.ends_on ?? today()}`]),
    line(['Impression = pub apparue à l\'écran ; affichage = restée au moins 1 seconde, app ouverte ; clic = bouton touché après un affichage']),
    '',
    line(['Jour', 'Emplacement', 'Impressions', 'Affichages', 'Visibilité (%)', 'Clics', 'Taux de clic (%)']),
    ...rows.map((s) => line([s.day, PLACES.find((p) => p[0] === (s.placement ?? 'edition'))?.[1] ?? '', imps(s), s.views, rate(s.views, imps(s)), s.clicks, rate(s.clicks, s.views)])),
    line(['Total', '', tot.i, tot.v, rate(tot.v, tot.i), tot.k, rate(tot.k, tot.v)]),
  ].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `rapport-${c.advertiser}-${c.name}.csv`.replace(/[^\w.-]+/g, '-');
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Répartition des affichages par emplacement. */
function Split({ stats }: { stats: Stat[] }) {
  const tot = stats.reduce((n, x) => n + x.views, 0);
  if (!tot) return null;
  const parts = PLACES.map(([p, l]) => [l, stats.filter((x) => (x.placement ?? 'edition') === p).reduce((n, x) => n + x.views, 0)] as const).filter(([, n]) => n);
  if (parts.length < 2) return <div className="muted small">{parts[0]?.[0]}</div>;
  return <div className="muted small">{parts.map(([l, n]) => `${l} ${Math.round((n / tot) * 100)} %`).join(' · ')}</div>;
}

/* ---------- Fréquence des pubs (réglage APP_RULES, lu par l'app à chaque ouverture) ---------- */
// Mêmes valeurs par défaut que RULES dans app/src/brand.ts.
const FREQ_DEF = { ad_first: 3, ad_every: 6, flash_ad_every: 5, rubric_ad_every: 0 };
type Freq = typeof FREQ_DEF;
const NEVER = 0;
function Frequency({ say }: { say: (m: string) => void }) {
  const [raw, setRaw] = useState<string | null>(null);
  const [f, setF] = useState<Freq>(FREQ_DEF);
  const read = () => api.settings().then((l) => {
    const v = l.find((x) => x.key === 'APP_RULES')?.value ?? '';
    setRaw(v);
    let j: Partial<Freq> = {};
    try { j = v ? JSON.parse(v) : {}; } catch {}
    setF({ ...FREQ_DEF, ...Object.fromEntries(Object.entries(j).filter(([k]) => k in FREQ_DEF)) });
  }).catch(() => setRaw(''));
  useEffect(() => { read(); }, []);
  if (raw === null) return null;
  let all: Record<string, unknown> = {};
  try { all = raw ? JSON.parse(raw) : {}; } catch {}
  const saved = { ...FREQ_DEF, ...Object.fromEntries(Object.entries(all).filter(([k]) => k in FREQ_DEF)) } as Freq;
  const dirty = JSON.stringify(saved) !== JSON.stringify(f);
  const save = async () => {
    // On garde les autres règles de l'app (Personnalisation > Règles) ; seules les valeurs changées sont écrites.
    const next: Record<string, unknown> = { ...all };
    for (const k of Object.keys(FREQ_DEF) as (keyof Freq)[]) { if (f[k] === FREQ_DEF[k]) delete next[k]; else next[k] = f[k]; }
    try { await api.setSetting('APP_RULES', Object.keys(next).length ? JSON.stringify(next) : ''); await read(); say('Fréquence enregistrée : visible dans l’app à la prochaine ouverture'); }
    catch (e) { say(e instanceof Error ? e.message : 'Enregistrement impossible'); }
  };
  const count = (n: number, first: number, every: number) => (every ? Math.max(0, Math.ceil((n - first + 1) / every)) : 0);
  const sel = (k: keyof Freq, label: string, help: string, vals: number[], unit: (n: number) => string) => (
    <div className="setting">
      <div><b>{label}</b><p className="muted small">{help}</p></div>
      <select value={f[k]} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} aria-label={label}>
        {vals.map((v) => <option key={v} value={v}>{v === NEVER ? 'Jamais' : unit(v)}{v === FREQ_DEF[k] ? ' (par défaut)' : ''}</option>)}
      </select>
    </div>
  );
  return (
    <section className="panel settings" style={{ marginBottom: 18 }}>
      <h2>Fréquence des pubs</h2>
      {sel('ad_first', 'Mon édition : première pub', 'Après combien d’infos arrive la première carte sponsorisée.', [1, 2, 3, 4, 5, 6, 8, 10], (n) => `après la ${n}ᵉ info`)}
      {sel('ad_every', 'Mon édition : ensuite, une pub toutes les', `Pour une édition de 24 infos : ${count(24, f.ad_first, f.ad_every)} pubs.`, [3, 4, 5, 6, 8, 10, 12, 15, 20], (n) => `${n} infos`)}
      {sel('flash_ad_every', 'Dernière minute : une pub toutes les', 'Les infos tombent au fil de la journée (12 au plus par jour) : la pub se glisse entre elles.', [NEVER, 3, 4, 5, 6, 8, 10], (n) => `${n} infos`)}
      {sel('rubric_ad_every', 'Autres rubriques : une pub toutes les', 'Quand le lecteur continue à glisser vers France, Monde, Tech…', [NEVER, 4, 5, 6, 8, 10, 12, 15], (n) => `${n} infos`)}
      <div className="setting-actions" style={{ marginTop: 12 }}>
        <span className="muted small">Jamais juste après un sujet sensible : la pub glisse après l’info suivante. Plus de pubs = plus d’affichages pour tenir les objectifs.</span>
        <button className="btn primary" disabled={!dirty} onClick={save}>Enregistrer</button>
      </div>
    </section>
  );
}

/** Ce que demande l'objectif, comparé à la capacité libre de l'app. */
function goalHint(d: Draft, free: number | null) {
  if (!d.max_views) return '';
  if (!d.ends_on) return 'Sans date de fin, la campagne passe jusqu’à atteindre l’objectif, sans rythme imposé.';
  if (d.pacing === 'fast') return 'Elle prend toute la place que lui donnent sa priorité et son poids, et s’arrête à l’objectif.';
  const total = days(d.starts_on, d.ends_on) + 1;
  const per = Math.ceil(d.max_views / Math.max(1, total));
  const room = free === null ? '' : per > free ? ` Attention : il reste ≈ ${int(Math.round(free))} affichages libres par jour, l’objectif risque de ne pas être tenu.` : ` Il reste ≈ ${int(Math.round(free))} affichages libres par jour : ça passe.`;
  return `≈ ${int(per)} affichages par jour pendant ${total} jour${total > 1 ? 's' : ''}, répartis sur la journée.${room}`;
}

/* ---------- Création et modification ---------- */
function CampaignForm({ d: init, onSave, onCancel, say, free }: { d: Draft; onSave: (d: Draft) => void; onCancel: () => void; say: (m: string) => void; free: number | null }) {
  const [d, setD] = useState(init);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const n = (v: string) => (v === '' ? null : Math.max(0, Number(v)));
  return (
    <form className="panel adform" onSubmit={(e) => { e.preventDefault(); onSave(d); }}>
      <div className="addform">
        <h2>{d.id ? 'Modifier la campagne' : 'Nouvelle campagne'}</h2>
        <div className="row2">
          <label>Nom interne<input value={d.name} maxLength={80} required onChange={(e) => set('name', e.target.value)} placeholder="Lumen, campagne d'hiver" /></label>
          <label>Annonceur<input value={d.advertiser} maxLength={40} required onChange={(e) => set('advertiser', e.target.value)} placeholder="Maison Lumen" /></label>
        </div>
        <label>Titre <span className="count">{d.title.length}/60</span><input value={d.title} maxLength={60} required onChange={(e) => set('title', e.target.value)} /></label>
        <label>Texte <span className="count">{d.body.length}/160</span><textarea rows={2} value={d.body} maxLength={160} onChange={(e) => set('body', e.target.value)} /></label>
        <div className="row2">
          <label>Bouton<input value={d.cta} maxLength={24} required onChange={(e) => set('cta', e.target.value)} /></label>
          <label>Lien de l'annonceur<input value={d.url} type="url" required onChange={(e) => set('url', e.target.value)} /></label>
        </div>
        <label>Image de fond (floutée dans l'app, facultative)
          <div className="setting-row">
            <input value={d.image_url ?? ''} placeholder="https://…" onChange={(e) => set('image_url', e.target.value || null)} />
            <label className="btn" style={{ display: 'inline-block' }}>Envoyer<input type="file" accept="image/*" hidden onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) api.uploadPhoto(f).then((u) => set('image_url', u)).catch((x) => say(x instanceof Error ? x.message : 'Envoi impossible'));
            }} /></label>
          </div>
        </label>
        <div className="row3">
          <label>Début<input type="date" value={d.starts_on} required onChange={(e) => set('starts_on', e.target.value)} /></label>
          <label>Fin (incluse, vide = sans fin)<input type="date" value={d.ends_on ?? ''} min={d.starts_on} onChange={(e) => set('ends_on', e.target.value || null)} /></label>
          <label>Objectif d'affichages<input type="number" min={1} value={d.max_views ?? ''} placeholder="Aucun" onChange={(e) => set('max_views', n(e.target.value))} /></label>
        </div>
        {d.max_views ? (
          <div className="row2">
            <label>Rythme
              <select value={d.pacing} onChange={(e) => set('pacing', e.target.value as Draft['pacing'])} disabled={!d.ends_on}>
                <option value="even">Régulier jusqu'à la date de fin</option>
                <option value="fast">Au plus vite</option>
              </select>
            </label>
            <p className="muted small" style={{ margin: 0 }}>{goalHint(d, free)}</p>
          </div>
        ) : null}
        <div>
          <div className="lbl">Emplacements</div>
          <div className="actions" style={{ marginTop: 8 }}>
            {PLACES.map(([p, l]) => (
              <label key={p} className="check small"><input type="checkbox" checked={d.placements.includes(p)} onChange={(e) => set('placements', e.target.checked ? [...d.placements, p] : d.placements.filter((x) => x !== p))} /> {l}</label>
            ))}
          </div>
        </div>
        <label className="check"><input type="checkbox" checked={d.exclusive} onChange={(e) => set('exclusive', e.target.checked)} /> Sponsor exclusif : pendant ses dates, c'est le seul annonceur visible dans l'app</label>
        {!d.exclusive ? (
          <label>Priorité
            <select value={d.priority} onChange={(e) => set('priority', Number(e.target.value) as Draft['priority'])}>
              {[1, 2, 3].map((p) => <option key={p} value={p}>{PRIORITY[p][0]} : {PRIORITY[p][1].charAt(0).toLowerCase() + PRIORITY[p][1].slice(1)}</option>)}
            </select>
          </label>
        ) : null}
        {!d.exclusive ? (
          <label>Poids dans la rotation : {d.weight} <span className="muted small">(une campagne de poids 2 passe deux fois plus qu'une de poids 1)</span>
            <input type="range" min={1} max={10} value={d.weight} onChange={(e) => set('weight', Number(e.target.value))} />
          </label>
        ) : null}
        <div>
          <div className="lbl">Ciblage : lecteurs qui suivent une de ces rubriques (rien de coché = tout le monde)</div>
          <div className="actions" style={{ marginTop: 8 }}>
            {Object.entries(RUBRICS).map(([id, name]) => (
              <label key={id} className="check small"><input type="checkbox" checked={d.rubrics.includes(id)} onChange={(e) => set('rubrics', e.target.checked ? [...d.rubrics, id] : d.rubrics.filter((r) => r !== id))} /> {name}</label>
            ))}
          </div>
        </div>
        <div className="row3">
          <label>Tarif<select value={d.pricing} onChange={(e) => set('pricing', e.target.value as Draft['pricing'])}><option value="cpm">Pour 1 000 vues</option><option value="flat">Forfait</option></select></label>
          <label>Prix (€)<input type="number" min={0} step="0.01" value={d.price} onChange={(e) => set('price', Number(e.target.value))} /></label>
          <span />
        </div>
        <div className="actions">
          <button className="btn primary">{d.id ? 'Enregistrer' : 'Créer la campagne'}</button>
          <button type="button" className="btn ghost" onClick={onCancel}>Annuler</button>
        </div>
      </div>
      <div>
        <div className="lbl" style={{ marginBottom: 8 }}>Aperçu</div>
        <div className="phone" style={d.image_url ? { backgroundImage: `linear-gradient(rgba(40,24,110,.55), rgba(14,11,31,.9)), url("${d.image_url}")` } : undefined}>
          <div className="pc">
            <div className="ptag" style={{ justifySelf: 'start' }}>SPONSORISÉ · {(d.advertiser || 'Annonceur').toUpperCase()}</div>
            <div className="ptitle">{d.title || 'Titre de la pub'}</div>
            {d.body ? <div className="pkey">{d.body}</div> : null}
            <div className="pbtn">{d.cta}</div>
          </div>
        </div>
      </div>
    </form>
  );
}
