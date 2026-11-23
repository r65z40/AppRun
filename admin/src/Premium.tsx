// Page « Abonnements » : chiffres clés, abonnés (offrir, prolonger, retirer), offres, codes promo, historique.
import { useCallback, useEffect, useState } from 'react';
import { api } from './data';
import { FILTERS, PERIOD, premiumApi, SOURCE, STATUS, type Period, type Plan, type PremiumStats, type PromoCode, type SubEvent, type SubFilter, type Subscriber } from './premium-data';

type Tab = 'subs' | 'plans' | 'codes' | 'history';
const TABS: [Tab, string][] = [['subs', 'Abonnés'], ['plans', 'Offres'], ['codes', 'Codes promo'], ['history', 'Historique']];
const eur = (c: number | null | undefined, cur = 'EUR') => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur || 'EUR' }).format((c ?? 0) / 100);
const day = (iso: string | null) => (iso ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso)) : 'À vie');
const int = (n: number) => n.toLocaleString('fr-FR');
const err = (e: unknown) => (e instanceof Error ? e.message : 'Action impossible');
const pillOf = (s: Subscriber) => (!s.live ? 'rejected' : s.status === 'grace' || s.status === 'cancelled' ? 'ready' : s.status === 'trial' ? 'ess' : 'published');

export function PremiumPage({ say }: { say: (m: string) => void }) {
  const [tab, setTab] = useState<Tab>('subs');
  const [st, setSt] = useState<PremiumStats | null>(null);
  const [fail, setFail] = useState<string | null>(null);
  const loadStats = useCallback(() => premiumApi.stats().then(setSt).catch((e) => setFail(err(e))), []);
  useEffect(() => { loadStats(); }, [loadStats]);
  const Tile = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
    <div className="panel tile"><div className="muted small">{label}</div><div className="tile-v">{value}</div>{sub ? <div className="muted small">{sub}</div> : null}</div>
  );
  return (
    <>
      <header className="head">
        <div>
          <div className="eyebrow">Revenus</div>
          <h1>Premium et abonnements</h1>
          <p className="muted">Les achats passent par l'App Store et Google Play (via RevenueCat), qui préviennent la base tout seuls. Ici, vous suivez les abonnés, offrez Premium, réglez les offres et créez des codes promo. Les achats de test ne sont jamais comptés.</p>
        </div>
      </header>
      {fail ? <p className="warn">Abonnements indisponibles : {fail}. La mise à jour de la base (workflow « Installer la base ») est peut-être encore en cours.</p> : null}
      {st ? (
        <div className="tiles">
          <Tile label="Abonnés Premium" value={int(st.premium)} sub={`${int(st.paying)} payant${st.paying > 1 ? 's' : ''} · ${int(st.trial)} en essai · ${int(st.gift)} offert${st.gift > 1 ? 's' : ''}`} />
          <Tile label="Revenu mensuel récurrent" value={eur(st.mrr_cents)} sub="Abonnements qui se renouvellent, l'annuel compté pour un douzième. Avant la part d'Apple ou Google (15 à 30 %)." />
          <Tile label="Encaissé, 30 jours" value={eur(st.revenue_30_cents)} sub={`${eur(st.revenue_all_cents)} depuis le début`} />
          <Tile label="Nouveaux, 30 jours" value={int(st.new_30)} sub={`${int(st.conversions_30)} essai${st.conversions_30 > 1 ? 's' : ''} transformé${st.conversions_30 > 1 ? 's' : ''} en abonnement`} />
          <Tile label="Départs, 30 jours" value={int(st.churn_30)} sub={`${int(st.cancelling)} résilié${st.cancelling > 1 ? 's' : ''} ou en échec de paiement, encore actif${st.cancelling > 1 ? 's' : ''}`} />
        </div>
      ) : null}
      <div className="tabs">{TABS.map(([t, l]) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{l}</button>)}</div>
      {tab === 'subs' ? <Subscribers say={say} changed={loadStats} /> : null}
      {tab === 'plans' ? <Plans say={say} /> : null}
      {tab === 'codes' ? <Codes say={say} /> : null}
      {tab === 'history' ? <History /> : null}
    </>
  );
}

/* ---------- Abonnés ---------- */
function Subscribers({ say, changed }: { say: (m: string) => void; changed: () => void }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<SubFilter>('live');
  const [list, setList] = useState<Subscriber[] | null>(null);
  const [gift, setGift] = useState({ pseudo: '', days: '30', note: '' });
  const load = useCallback(() => premiumApi.subscribers(search.trim(), filter).then(setList).catch((e) => { setList([]); say(err(e)); }), [search, filter, say]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  const act = async (f: () => Promise<void>, msg: string) => {
    try { await f(); await load(); changed(); say(msg); } catch (e) { say(err(e)); }
  };
  return (
    <>
      <form className="panel addform" onSubmit={async (e) => {
        e.preventDefault();
        const p = await api.findProfile(gift.pseudo.trim()).catch(() => null);
        if (!p) return say(`Aucun lecteur avec le pseudo « ${gift.pseudo.trim()} »`);
        const d = Number(gift.days);
        await act(() => premiumApi.grant(p.id, d || null, gift.note.trim()), `Premium offert à ${p.pseudo}`);
        setGift({ pseudo: '', days: '30', note: '' });
      }}>
        <h2>Offrir Premium</h2>
        <p className="muted small">Pour un gagnant de concours, un partenaire, un geste commercial… Les jours s'ajoutent après ce que le lecteur a déjà.</p>
        <div className="row3">
          <label>Pseudo du lecteur<input value={gift.pseudo} onChange={(e) => setGift({ ...gift, pseudo: e.target.value })} required placeholder="Camille_R" /></label>
          <label>Durée<select value={gift.days} onChange={(e) => setGift({ ...gift, days: e.target.value })}>
            {[[7, '7 jours'], [30, '1 mois'], [90, '3 mois'], [365, '1 an'], [0, 'À vie']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></label>
          <label>Motif (facultatif)<input value={gift.note} onChange={(e) => setGift({ ...gift, note: e.target.value })} placeholder="Gagnant du concours" /></label>
        </div>
        <div><button className="btn primary">Offrir</button></div>
      </form>

      <div className="actions" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', margin: '18px 0 14px' }}>
        <input className="search" style={{ margin: 0 }} placeholder="Chercher un pseudo ou une adresse e-mail" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Chercher un abonné" />
        <select value={filter} onChange={(e) => setFilter(e.target.value as SubFilter)} aria-label="Filtrer">
          {Object.entries(FILTERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {!list ? <p className="muted">Chargement…</p> : !list.length ? <p className="muted empty">Aucun abonné ici pour l'instant.</p> : (
        <table className="table">
          <thead><tr><th>Lecteur</th><th>Statut</th><th>Via</th><th>Offre</th><th>Échéance</th><th></th></tr></thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.sub_id} className={s.live ? '' : 'off'}>
                <td><b>{s.pseudo ?? '—'}</b><div className="muted small">{s.email}</div>{s.note ? <div className="muted small">{s.note}</div> : null}</td>
                <td><span className={`pill ${pillOf(s)}`}>{STATUS[s.status]}</span>{s.sandbox ? <div className="muted small">achat de test</div> : null}</td>
                <td>{SOURCE[s.source] ?? s.source}</td>
                <td>{s.plan ?? '—'}{s.price_cents ? <div className="muted small">{eur(s.price_cents, s.currency ?? 'EUR')}</div> : null}</td>
                <td>{day(s.expires_at)}{s.live && s.expires_at ? <div className="muted small">{s.auto_renew ? 'se renouvelle' : 'sans renouvellement'}</div> : null}</td>
                <td className="btns">
                  {s.live && !s.expires_at ? null : <button className="btn sm" onClick={() => { const d = prompt(`Offrir combien de jours à ${s.pseudo ?? 'ce lecteur'} ? (0 = à vie)`, '30'); if (d !== null) act(() => premiumApi.grant(s.user_id, Number(d) || null, ''), 'Premium prolongé'); }}>{s.live ? 'Prolonger' : 'Offrir'}</button>}
                  {s.live ? <button className="btn ghost sm" onClick={() => {
                    const store = s.source === 'app_store' || s.source === 'play_store';
                    const r = prompt(`Retirer Premium à ${s.pseudo ?? 'ce lecteur'} tout de suite ?${store ? `\n\nAttention : ${SOURCE[s.source]} continuera de le prélever. Pour le rembourser ou arrêter les prélèvements, passez par ${s.source === 'app_store' ? 'App Store Connect' : 'la Play Console'}.` : ''}\n\nMotif (facultatif) :`, '');
                    if (r !== null) act(() => premiumApi.revoke(s.user_id, r), 'Premium retiré');
                  }}>Retirer</button> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

/* ---------- Offres ---------- */
const emptyPlan = { id: '', name: '', period: 'month' as Period, price: '', trial: '7' };
function Plans({ say }: { say: (m: string) => void }) {
  const [list, setList] = useState<Plan[] | null>(null);
  const [edit, setEdit] = useState<Record<string, Partial<Plan>>>({});
  const [form, setForm] = useState(emptyPlan);
  const load = useCallback(() => premiumApi.plans().then((l) => { setList(l); setEdit({}); }).catch((e) => say(err(e))), [say]);
  useEffect(() => { load(); }, [load]);
  const v = <K extends keyof Plan>(p: Plan, k: K): Plan[K] => (edit[p.id]?.[k] ?? p[k]) as Plan[K];
  const set = (p: Plan, k: keyof Plan, val: unknown) => setEdit((e) => ({ ...e, [p.id]: { ...e[p.id], [k]: val } }));
  const save = async (p: Plan) => {
    try { await premiumApi.savePlan({ id: p.id, ...edit[p.id] }); await load(); say('Offre enregistrée'); } catch (e) { say(err(e)); }
  };
  return (
    <>
      <p className="muted">Le prix encaissé est celui réglé dans App Store Connect et la Play Console : le prix ci-dessous sert à l'affichage quand le store ne répond pas, et aux estimations de revenus. Les identifiants de produit doivent être identiques à ceux créés dans les stores et dans RevenueCat.</p>
      {!list ? <p className="muted">Chargement…</p> : list.map((p) => (
        <div key={p.id} className={`panel addform ${v(p, 'active') ? '' : 'off'}`} style={{ marginBottom: 14, opacity: v(p, 'active') ? 1 : 0.65 }}>
          <h2 style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{v(p, 'name')} <span className="muted small">{p.id}</span>{v(p, 'active') ? <span className="pill published">En vente</span> : <span className="pill rejected">Retirée</span>}</h2>
          <div className="row3">
            <label>Nom affiché<input value={v(p, 'name')} onChange={(e) => set(p, 'name', e.target.value)} /></label>
            <label>Prix (€)<input type="number" min="0" step="0.01" value={(v(p, 'price_cents') / 100).toString()} onChange={(e) => set(p, 'price_cents', Math.round(Number(e.target.value) * 100))} /></label>
            <label>Facturation<select value={v(p, 'period')} onChange={(e) => set(p, 'period', e.target.value)}>{Object.entries(PERIOD).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          </div>
          <div className="row3">
            <label>Essai gratuit (jours)<input type="number" min="0" max="90" value={v(p, 'trial_days')} onChange={(e) => set(p, 'trial_days', Number(e.target.value))} /></label>
            <label>Petite phrase<input value={v(p, 'highlight') ?? ''} placeholder="30 % moins cher" onChange={(e) => set(p, 'highlight', e.target.value || null)} /></label>
            <label>Ordre<input type="number" value={v(p, 'position')} onChange={(e) => set(p, 'position', Number(e.target.value))} /></label>
          </div>
          <div className="row2">
            <label>Produit App Store<input value={v(p, 'apple_product_id') ?? ''} onChange={(e) => set(p, 'apple_product_id', e.target.value || null)} /></label>
            <label>Produit Google Play<input value={v(p, 'google_product_id') ?? ''} placeholder="abonnement:offre" onChange={(e) => set(p, 'google_product_id', e.target.value || null)} /></label>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn primary" disabled={!edit[p.id]} onClick={() => save(p)}>Enregistrer</button>
            <button className="btn ghost" onClick={async () => { try { await premiumApi.savePlan({ id: p.id, active: !p.active }); await load(); say(p.active ? 'Offre retirée de l’app' : 'Offre remise en vente'); } catch (e) { say(err(e)); } }}>{p.active ? 'Retirer de la vente' : 'Remettre en vente'}</button>
          </div>
        </div>
      ))}
      <form className="panel addform" onSubmit={async (e) => {
        e.preventDefault();
        const id = form.id.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
        try {
          await premiumApi.savePlan({ id, name: form.name.trim(), period: form.period, price_cents: Math.round(Number(form.price) * 100), trial_days: Number(form.trial) || 0, position: (list?.length ?? 0) }, true);
          setForm(emptyPlan); await load(); say('Offre créée : ajoutez ses identifiants de produit');
        } catch (er) { say(err(er)); }
      }}>
        <h2>Nouvelle offre</h2>
        <div className="row3">
          <label>Identifiant<input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} required placeholder="etudiant" /></label>
          <label>Nom affiché<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Étudiant" /></label>
          <label>Facturation<select value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value as Period })}>{Object.entries(PERIOD).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        </div>
        <div className="row2">
          <label>Prix (€)<input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required /></label>
          <label>Essai gratuit (jours)<input type="number" min="0" max="90" value={form.trial} onChange={(e) => setForm({ ...form, trial: e.target.value })} /></label>
        </div>
        <div><button className="btn primary">Créer l'offre</button></div>
      </form>
    </>
  );
}

/* ---------- Codes promo ---------- */
const emptyCode = { code: '', days: '30', max: '', until: '', note: '' };
function Codes({ say }: { say: (m: string) => void }) {
  const [list, setList] = useState<PromoCode[] | null>(null);
  const [form, setForm] = useState(emptyCode);
  const load = useCallback(() => premiumApi.codes().then(setList).catch((e) => say(err(e))), [say]);
  useEffect(() => { load(); }, [load]);
  const random = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
  const usable = (c: PromoCode) => c.active && (!c.expires_at || new Date(c.expires_at) > new Date()) && (c.max_uses === null || c.uses < c.max_uses);
  return (
    <>
      <form className="panel addform" onSubmit={async (e) => {
        e.preventDefault();
        try {
          await premiumApi.saveCode({ code: form.code.trim().toUpperCase(), days: Number(form.days), max_uses: Number(form.max) || null, expires_at: form.until ? new Date(form.until + 'T23:59:59').toISOString() : null, note: form.note.trim() || null }, true);
          setForm(emptyCode); await load(); say('Code créé');
        } catch (er) { say(err(er)); }
      }}>
        <h2>Nouveau code</h2>
        <p className="muted small">Le lecteur le saisit dans l'app (Premium › J'ai un code) et reçoit Premium pour la durée choisie, sans payer. Un code ne sert qu'une fois par compte.</p>
        <div className="row3">
          <label>Code (4 à 24 lettres, chiffres, tirets)<input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required pattern="[A-Za-z0-9-]{4,24}" placeholder="NOEL26" /></label>
          <label>Premium offert<select value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })}>{[[7, '7 jours'], [14, '14 jours'], [30, '1 mois'], [90, '3 mois'], [365, '1 an']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label>Utilisations au plus (vide = illimité)<input type="number" min="1" value={form.max} onChange={(e) => setForm({ ...form, max: e.target.value })} /></label>
        </div>
        <div className="row2">
          <label>Valable jusqu'au (facultatif)<input type="date" value={form.until} onChange={(e) => setForm({ ...form, until: e.target.value })} /></label>
          <label>Note interne<input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Partenariat podcast" /></label>
        </div>
        <div style={{ display: 'flex', gap: 10 }}><button className="btn primary">Créer le code</button><button type="button" className="btn ghost" onClick={() => setForm({ ...form, code: random() })}>Code au hasard</button></div>
      </form>
      {!list ? <p className="muted">Chargement…</p> : !list.length ? <p className="muted empty">Aucun code pour l'instant.</p> : (
        <table className="table">
          <thead><tr><th>Code</th><th>Offre</th><th>Utilisé</th><th>Valable jusqu'au</th><th>État</th><th></th></tr></thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.code} className={usable(c) ? '' : 'off'}>
                <td><b style={{ fontFamily: 'ui-monospace, monospace', letterSpacing: 1 }}>{c.code}</b>{c.note ? <div className="muted small">{c.note}</div> : null}</td>
                <td>{c.days} jours</td>
                <td>{int(c.uses)}{c.max_uses ? ` / ${int(c.max_uses)}` : ''}</td>
                <td>{c.expires_at ? day(c.expires_at) : '—'}</td>
                <td>{usable(c) ? <span className="pill published">Actif</span> : <span className="pill rejected">{!c.active ? 'Désactivé' : c.max_uses !== null && c.uses >= c.max_uses ? 'Épuisé' : 'Expiré'}</span>}</td>
                <td className="btns">
                  <button className="btn ghost sm" onClick={async () => { await navigator.clipboard?.writeText(c.code); say('Code copié'); }}>Copier</button>
                  <button className="btn sm" onClick={async () => { try { await premiumApi.saveCode({ code: c.code, active: !c.active }); await load(); say(c.active ? 'Code désactivé' : 'Code réactivé'); } catch (e) { say(err(e)); } }}>{c.active ? 'Désactiver' : 'Réactiver'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

/* ---------- Historique ---------- */
function History() {
  const [list, setList] = useState<SubEvent[] | null>(null);
  useEffect(() => { premiumApi.events().then(setList).catch(() => setList([])); }, []);
  if (!list) return <p className="muted">Chargement…</p>;
  if (!list.length) return <p className="muted empty">Rien pour l'instant : les achats, renouvellements et résiliations s'afficheront ici.</p>;
  return (
    <table className="table">
      <thead><tr><th>Quand</th><th>Lecteur</th><th>Événement</th><th>Via</th><th>Montant</th></tr></thead>
      <tbody>
        {list.map((e, i) => (
          <tr key={i} className={e.sandbox ? 'off' : ''}>
            <td className="muted">{new Date(e.at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</td>
            <td>{e.pseudo ?? '—'}</td>
            <td>{e.kind[0].toUpperCase() + e.kind.slice(1)}{e.detail ? <div className="muted small">{e.detail}</div> : null}{e.sandbox ? <div className="muted small">test</div> : null}</td>
            <td>{e.source ? SOURCE[e.source as keyof typeof SOURCE] ?? e.source : '—'}</td>
            <td>{e.amount_cents ? eur(e.amount_cents, e.currency ?? 'EUR') : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ---------- Fiche lecteur (page Lecteurs) ---------- */
export function ReaderSubscription({ id, say }: { id: string; say?: (m: string) => void }) {
  const [s, setS] = useState<Subscriber | null | undefined>(undefined);
  const load = useCallback(() => premiumApi.ofUser(id).then(setS).catch(() => setS(null)), [id]);
  useEffect(() => { load(); }, [load]);
  const act = async (f: () => Promise<void>, msg: string) => { try { await f(); await load(); say?.(msg); } catch (e) { say?.(err(e)); } };
  if (s === undefined) return null;
  return (
    <p className="small" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <b>Premium :</b>
      {s ? <><span className={`pill ${pillOf(s)}`}>{STATUS[s.status]}</span><span className="muted">{SOURCE[s.source]}{s.plan ? ` · ${s.plan}` : ''} · {s.live ? (s.expires_at ? `jusqu'au ${day(s.expires_at)}` : 'à vie') : `fin le ${day(s.expires_at)}`}</span></> : <span className="muted">jamais abonné</span>}
      <button className="btn sm" onClick={() => act(() => premiumApi.grant(id, 30, 'Depuis la fiche lecteur'), '1 mois de Premium offert')}>Offrir 1 mois</button>
      {s?.live ? <button className="btn ghost sm" onClick={() => confirm('Retirer Premium tout de suite ?') && act(() => premiumApi.revoke(id, ''), 'Premium retiré')}>Retirer</button> : null}
    </p>
  );
}
