// Régie publicitaire : campagnes, sponsor exclusif, ciblage, plafonds, statistiques et revenus estimés.
import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { api, RUBRICS, sb } from './data';

export type Campaign = {
  id: string; name: string; advertiser: string; title: string; body: string; cta: string; url: string; image_url: string | null;
  active: boolean; exclusive: boolean; starts_on: string; ends_on: string | null; rubrics: string[]; weight: number;
  max_views: number | null; pricing: 'cpm' | 'flat'; price: number; created_at: string;
};
type Stat = { campaign_id: string; day: string; views: number; clicks: number };
type Draft = Omit<Campaign, 'id' | 'created_at'> & { id?: string };

const today = () => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());
const dayShift = (d: number) => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date(Date.now() + d * 86400e3));
const fr = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
const int = (n: number) => n.toLocaleString('fr-FR');
const eur = (n: number) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const pct = (c: number, v: number) => (v ? `${((c / v) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %` : '—');

/* ---------- Données : Supabase, ou démo en mémoire ---------- */
let demoList: Campaign[] = [
  { id: 'c1', name: 'Lumen hiver', advertiser: 'Maison Lumen', title: 'Lire le soir, sans fatiguer vos yeux', body: 'Une lampe de lecture rechargeable à lumière chaude.', cta: "Découvrir l'offre", url: 'https://exemple.test/lumen', image_url: null, active: true, exclusive: false, starts_on: dayShift(-10), ends_on: dayShift(20), rubrics: [], weight: 2, max_views: null, pricing: 'cpm', price: 8, created_at: '' },
  { id: 'c2', name: 'Vélo urbain', advertiser: 'Rayon', title: 'Le vélo électrique qui se plie', body: '12 kg, 60 km d’autonomie.', cta: 'Voir le vélo', url: 'https://exemple.test/rayon', image_url: null, active: true, exclusive: false, starts_on: dayShift(-3), ends_on: null, rubrics: ['tech', 'ecologie'], weight: 1, max_views: 50000, pricing: 'cpm', price: 12, created_at: '' },
  { id: 'c3', name: 'Banque partenaire, semaine exclusive', advertiser: 'Banque Horizon', title: 'Votre compte en 5 minutes', body: 'Sans frais la première année.', cta: 'Ouvrir un compte', url: 'https://exemple.test/horizon', image_url: null, active: true, exclusive: true, starts_on: dayShift(5), ends_on: dayShift(11), rubrics: [], weight: 1, max_views: null, pricing: 'flat', price: 1500, created_at: '' },
];
const demoStats: Stat[] = demoList.slice(0, 2).flatMap((c, k) =>
  Array.from({ length: 10 }, (_, i) => ({ campaign_id: c.id, day: dayShift(-i), views: 900 + ((i * 37 + k * 11) % 400), clicks: 9 + ((i * 7 + k) % 12) })));

const real = (sb: SupabaseClient) => ({
  list: async () => { const r = await sb.from('ad_campaigns').select('*').order('starts_on', { ascending: false }); if (r.error) throw new Error(r.error.message); return r.data as Campaign[]; },
  stats: async () => { const r = await sb.from('ad_stats').select('*'); if (r.error) throw new Error(r.error.message); return r.data as Stat[]; },
  async save(c: Partial<Draft>) {
    const { id, ...rest } = c;
    const r = id ? await sb.from('ad_campaigns').update(rest).eq('id', id) : await sb.from('ad_campaigns').insert({ ...rest, created_by: (await sb.auth.getUser()).data.user?.id });
    if (r.error) throw new Error(r.error.message);
  },
  async remove(id: string) { const r = await sb.from('ad_campaigns').delete().eq('id', id); if (r.error) throw new Error(r.error.message); },
});
const ads = sb ? real(sb) : {
  list: async () => [...demoList],
  stats: async () => demoStats,
  async save(c: Partial<Draft>) {
    if (c.id) demoList = demoList.map((x) => (x.id === c.id ? { ...x, ...c } as Campaign : x));
    else demoList = [{ ...(c as Draft), id: `c${Date.now()}`, created_at: new Date().toISOString() }, ...demoList];
  },
      async remove(id: string) { demoList = demoList.filter((x) => x.id !== id); },
};

/* ---------- État d'une campagne ---------- */
type State = 'live' | 'hidden' | 'planned' | 'ended' | 'paused' | 'capped';
const STATE: Record<State, [string, string]> = {
  live: ['En cours', 'published'], hidden: ['Masquée par le sponsor exclusif', 'draft'], planned: ['Programmée', 'draft'],
  ended: ['Terminée', 'rejected'], paused: ['En pause', 'rejected'], capped: ['Plafond atteint', 'rejected'],
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
});

/* ---------- Page ---------- */
export function AdsPage({ say }: { say: (m: string) => void }) {
  const [list, setList] = useState<Campaign[] | null>(null);
  const [stats, setStats] = useState<Stat[]>([]);
  const [form, setForm] = useState<Draft | null>(null);
  const err = (e: unknown) => say(e instanceof Error ? e.message : 'Action impossible');
  const load = () => Promise.all([ads.list().then(setList), ads.stats().then(setStats)]).catch((e) => { setList([]); err(e); });
  useEffect(() => { load(); }, []);

  const by = useMemo(() => {
    const m: Record<string, { views: number; clicks: number; v7: number; c7: number }> = {};
    const from7 = dayShift(-6);
    for (const s of stats) {
      const x = (m[s.campaign_id] ??= { views: 0, clicks: 0, v7: 0, c7: 0 });
      x.views += s.views; x.clicks += s.clicks;
      if (s.day >= from7) { x.v7 += s.views; x.c7 += s.clicks; }
    }
    return m;
  }, [stats]);
  const views = (c: Campaign) => by[c.id]?.views ?? 0;

  if (!list) return <p className="muted">Chargement…</p>;
  const exclusiveRaw = list.filter((c) => stateOf(c, views(c), false) === 'live' && c.exclusive);
  const states = new Map(list.map((c) => [c.id, stateOf(c, views(c), exclusiveRaw.length > 0)]));
  const live = list.filter((c) => states.get(c.id) === 'live');
  const sum = (k: 'v7' | 'c7') => Object.values(by).reduce((n, x) => n + x[k], 0);
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
    await ads.save({ ...d, ends_on: d.ends_on || null, max_views: d.max_views || null })
      .then(() => { say(d.id ? 'Campagne mise à jour' : 'Campagne créée'); setForm(null); load(); }).catch(err);
  };

  return (
    <>
      <header className="head">
        <div>
          <div className="eyebrow">Publicité</div>
          <h1>Régie publicitaire</h1>
          <p className="muted">Les pubs passent seulement dans « Mon édition » des lecteurs gratuits : après la 3ᵉ info, puis une toutes les six. Les abonnés Premium n'en voient aucune. Sans campagne en cours, l'app n'affiche pas de pub.</p>
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

      <div className="tiles">
        <div className="panel tile"><div className="muted small">Affichages, 7 jours</div><div className="tile-v">{int(sum('v7'))}</div></div>
        <div className="panel tile"><div className="muted small">Clics, 7 jours</div><div className="tile-v">{int(sum('c7'))}</div><div className="muted small">Taux de clic {pct(sum('c7'), sum('v7'))}</div></div>
        <div className="panel tile"><div className="muted small">Revenus estimés, 30 jours</div><div className="tile-v">{eur(rev30)}</div><div className="muted small">Affichages × prix pour 1 000, plus les forfaits commencés</div></div>
      </div>

      {form ? <CampaignForm d={form} onCancel={() => setForm(null)} onSave={save} say={say} /> : null}

      <h2>Campagnes</h2>
      {list.length ? (
        <table className="table">
          <thead><tr><th>Campagne</th><th>Dates</th><th>Affichages</th><th>Clics</th><th>Revenu estimé</th><th /></tr></thead>
          <tbody>
            {list.map((c) => {
              const st = states.get(c.id)!;
              const s = by[c.id] ?? { views: 0, clicks: 0 };
              return (
                <tr key={c.id}>
                  <td>
                    <b>{c.name}</b> <span className={`pill ${STATE[st][1]}`}>{STATE[st][0]}</span>{c.exclusive ? <span className="pill" style={{ marginLeft: 6 }}>Exclusif</span> : null}
                    <div className="muted small">{c.advertiser} · {c.rubrics.length ? c.rubrics.map((r) => RUBRICS[r] ?? r).join(', ') : 'tout le monde'}{c.exclusive ? '' : ` · poids ${c.weight}`}</div>
                  </td>
                  <td className="small">{fr(c.starts_on)} → {c.ends_on ? fr(c.ends_on) : 'sans fin'}</td>
                  <td>{int(s.views)}{c.max_views ? <div className="muted small">sur {int(c.max_views)}</div> : null}</td>
                  <td>{int(s.clicks)}<div className="muted small">{pct(s.clicks, s.views)}</div></td>
                  <td>{eur(revenue(c, s.views))}<div className="muted small">{c.pricing === 'flat' ? 'forfait' : `${eur(Number(c.price))} / 1 000`}</div></td>
                  <td>
                    <div className="actions">
                      <button className="btn sm" onClick={() => setForm({ ...c })}>Modifier</button>
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
      <p className="muted small">Les affichages sont comptés quand la pub reste une seconde à l'écran, une fois par emplacement et par ouverture de l'app. Aucune donnée sur le lecteur n'est enregistrée. Le ciblage par rubrique ne s'applique qu'aux lecteurs qui ont accepté les pubs selon leurs centres d'intérêt ; les autres ne voient que les campagnes sans ciblage.</p>
    </>
  );
}

/* ---------- Création et modification ---------- */
function CampaignForm({ d: init, onSave, onCancel, say }: { d: Draft; onSave: (d: Draft) => void; onCancel: () => void; say: (m: string) => void }) {
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
          <label>Plafond d'affichages<input type="number" min={1} value={d.max_views ?? ''} placeholder="Aucun" onChange={(e) => set('max_views', n(e.target.value))} /></label>
        </div>
        <label className="check"><input type="checkbox" checked={d.exclusive} onChange={(e) => set('exclusive', e.target.checked)} /> Sponsor exclusif : pendant ses dates, c'est le seul annonceur visible dans l'app</label>
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
