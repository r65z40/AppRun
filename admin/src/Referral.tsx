// Parrainage : chaque lecteur invite ses amis avec son lien. Le parrainage est validé quand le filleul a vraiment lu
// quelques infos ; il compte alors pour le badge Ambassadeur (réglé dans Reconnaissance) et peut offrir des jours Premium.
import { useEffect, useState, type ChangeEvent } from 'react';
import { api, sb } from './data';

type Conf = { enabled: boolean; confirm_reads: number; referrer_days: number; referee_days: number; max_rewarded: number; claim_days: number; link: string; share_text: string };
type Top = { pseudo: string | null; email: string | null; total: number; confirmed: number; days: number; last: string };
type Recent = { created_at: string; confirmed_at: string | null; via: 'link' | 'code'; referrer_days: number; referee_days: number; referrer: string | null; referee: string | null; referee_email: string | null; reads: number };
type Totals = { referrals: number; confirmed: number; pending: number; last_30: number; referrers: number; days_given: number };
type Admin = { conf: Conf; totals: Totals; top: Top[]; recent: Recent[] };

const CONF: Conf = { enabled: true, confirm_reads: 5, referrer_days: 7, referee_days: 7, max_rewarded: 10, claim_days: 14, link: '', share_text: 'J’ai trouvé une app qui résume l’actu du jour en quelques minutes. Essaie-la avec mon lien : {lien}' };
/** Le back office est en /admin/ à côté de la version web de l'app. */
const WEB = `${location.origin}${location.pathname.replace(/admin(\/.*)?$/, '')}`;

/* ---------- Données : Supabase, ou démo en mémoire ---------- */
const day = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
let demo: Admin = {
  conf: CONF,
  totals: { referrals: 42, confirmed: 31, pending: 11, last_30: 18, referrers: 17, days_given: 378 },
  top: [
    { pseudo: 'Camille_R', email: 'camille@exemple.fr', total: 9, confirmed: 8, days: 56, last: day(1) },
    { pseudo: 'Nico.B', email: 'nico@exemple.fr', total: 5, confirmed: 4, days: 28, last: day(3) },
    { pseudo: 'Ines', email: 'ines@exemple.fr', total: 3, confirmed: 3, days: 21, last: day(9) },
  ],
  recent: [
    { created_at: day(0.1), confirmed_at: null, via: 'link', referrer_days: 0, referee_days: 0, referrer: 'Camille_R', referee: 'Lou', referee_email: 'lou@exemple.fr', reads: 2 },
    { created_at: day(1), confirmed_at: day(0.8), via: 'link', referrer_days: 7, referee_days: 7, referrer: 'Camille_R', referee: 'Sam', referee_email: 'sam@exemple.fr', reads: 14 },
    { created_at: day(3), confirmed_at: day(2), via: 'code', referrer_days: 7, referee_days: 7, referrer: 'Nico.B', referee: 'Jo', referee_email: 'jo@exemple.fr', reads: 31 },
  ],
};
const data = sb ? {
  async load(): Promise<Admin> {
    const r = await sb!.rpc('referral_admin');
    if (r.error) throw new Error(r.error.message);
    return r.data as Admin;
  },
  save: (c: Conf) => api.setSetting('REFERRAL', JSON.stringify(c)),
} : {
  load: async () => demo,
  async save(c: Conf) { demo = { ...demo, conf: c }; },
};

const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

export function ReferralPage({ say, go }: { say: (m: string) => void; go: (p: 'badges') => void }) {
  const [d, setD] = useState<Admin | null>(null);
  const [fail, setFail] = useState<string | null>(null);
  useEffect(() => { data.load().then((x) => setD({ ...x, conf: { ...CONF, ...x.conf } })).catch((e) => setFail(e.message)); }, []);
  const t = d?.totals;
  return (
    <>
      <header className="head">
        <div>
          <div className="eyebrow">Lecteurs</div>
          <h1>Parrainage</h1>
          <p className="muted">Chaque lecteur a son lien d’invitation dans Mon compte. Un ami qui crée son compte avec ce lien (ou qui tape le code ensuite) devient son filleul. Le parrainage est validé quand le filleul a vraiment lu quelques infos : il compte alors pour le badge Ambassadeur et offre, si vous le voulez, des jours Premium aux deux.</p>
        </div>
      </header>
      {fail ? <p className="warn">Parrainage indisponible : {fail}. La mise à jour de la base (workflow « Installer la base ») est peut-être encore en cours.</p> : null}
      {t ? (
        <div className="tiles">
          <Tile label="Amis invités" value={t.referrals} sub={`${t.last_30} ces 30 derniers jours`} />
          <Tile label="Parrainages validés" value={t.confirmed} sub={t.referrals ? `${Math.round((100 * t.confirmed) / t.referrals)} % des invités lisent vraiment` : undefined} />
          <Tile label="En attente" value={t.pending} sub="inscrits, pas encore assez lu" />
          <Tile label="Parrains" value={t.referrers} sub={`${t.days_given} jours Premium offerts au total`} />
        </div>
      ) : null}
      {d ? <ConfPanel c={d.conf} say={say} go={go} onSaved={(c) => setD({ ...d, conf: c })} /> : !fail ? <p className="muted">Chargement…</p> : null}
      {d ? (
        <>
          <h2>Meilleurs parrains</h2>
          {d.top.length ? (
            <table className="table">
              <thead><tr><th>Lecteur</th><th>Invités</th><th>Validés</th><th>Jours gagnés</th><th>Dernier</th></tr></thead>
              <tbody>{d.top.map((r, i) => (
                <tr key={i}><td><b>{r.pseudo ?? '—'}</b> <span className="muted small">{r.email}</span></td><td>{r.total}</td><td>{r.confirmed}</td><td>{r.days}</td><td className="muted">{date(r.last)}</td></tr>
              ))}</tbody>
            </table>
          ) : <p className="muted">Personne n’a encore invité d’ami.</p>}
          <h2>Derniers parrainages</h2>
          {d.recent.length ? (
            <table className="table">
              <thead><tr><th>Date</th><th>Parrain</th><th>Filleul</th><th>État</th><th>Premium offert</th></tr></thead>
              <tbody>{d.recent.map((r, i) => (
                <tr key={i}>
                  <td className="muted">{date(r.created_at)}</td>
                  <td>{r.referrer ?? '—'}</td>
                  <td>{r.referee ?? '—'} <span className="muted small">{r.referee_email} · {r.via === 'link' ? 'par le lien' : 'code tapé'}</span></td>
                  <td>{r.confirmed_at ? `Validé le ${date(r.confirmed_at)}` : <span className="muted">En attente · {r.reads}/{d.conf.confirm_reads} infos lues</span>}</td>
                  <td>{r.confirmed_at ? `${r.referrer_days} j / ${r.referee_days} j` : '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          ) : <p className="muted">Aucun parrainage pour l’instant.</p>}
        </>
      ) : null}
    </>
  );
}

function Tile({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return <div className="panel tile"><div className="muted small">{label}</div><div className="tile-v">{value.toLocaleString('fr-FR')}</div>{sub ? <div className="muted small">{sub}</div> : null}</div>;
}

function ConfPanel({ c: init, say, go, onSaved }: { c: Conf; say: (m: string) => void; go: (p: 'badges') => void; onSaved: (c: Conf) => void }) {
  const [c, setC] = useState(init);
  const num = (k: keyof Conf, min: number, max: number) => (e: ChangeEvent<HTMLInputElement>) => setC({ ...c, [k]: Math.min(max, Math.max(min, Math.round(Number(e.target.value) || 0))) });
  const link = `${(c.link.trim() || WEB).replace(/\/?$/, '/')}?parrain=K7M2QX`;
  const bad = !c.share_text.includes('{lien}') || (!!c.link.trim() && !/^https:\/\//.test(c.link.trim()));
  const save = async () => {
    const v = { ...c, link: c.link.trim(), share_text: c.share_text.trim() };
    try { await data.save(v); onSaved(v); say('Réglages du parrainage enregistrés.'); }
    catch (e) { say(e instanceof Error ? e.message : 'Enregistrement impossible'); }
  };
  return (
    <section className="panel settings" style={{ marginBottom: 26 }}>
      <h2>Réglages</h2>
      <label className="check"><input type="checkbox" checked={c.enabled} onChange={(e) => setC({ ...c, enabled: e.target.checked })} /> Parrainage ouvert (le lien d’invitation apparaît dans Mon compte)</label>
      <div className="row3">
        <label>Infos lues pour valider
          <input type="number" min={0} max={200} value={c.confirm_reads} onChange={num('confirm_reads', 0, 200)} />
          <span className="muted small" style={{ fontWeight: 400 }}>Le filleul doit lire ce nombre d’infos : les faux comptes ne comptent pas.</span>
        </label>
        <label>Jours Premium pour le parrain
          <input type="number" min={0} max={365} value={c.referrer_days} onChange={num('referrer_days', 0, 365)} />
          <span className="muted small" style={{ fontWeight: 400 }}>Par ami validé. 0 = pas de récompense, seulement le badge.</span>
        </label>
        <label>Jours Premium pour le filleul
          <input type="number" min={0} max={365} value={c.referee_days} onChange={num('referee_days', 0, 365)} />
          <span className="muted small" style={{ fontWeight: 400 }}>Cadeau de bienvenue, une fois validé. 0 = aucun.</span>
        </label>
      </div>
      <div className="row3">
        <label>Amis récompensés au plus, par parrain
          <input type="number" min={0} max={1000} value={c.max_rewarded} onChange={num('max_rewarded', 0, 1000)} />
          <span className="muted small" style={{ fontWeight: 400 }}>Au-delà, plus de jours offerts, mais les amis comptent toujours pour les badges.</span>
        </label>
        <label>Jours pour taper un code après l’inscription
          <input type="number" min={0} max={365} value={c.claim_days} onChange={num('claim_days', 0, 365)} />
          <span className="muted small" style={{ fontWeight: 400 }}>Pour l’ami qui a installé l’app sans passer par le lien.</span>
        </label>
        <label>Adresse du lien
          <input value={c.link} placeholder={WEB} onChange={(e) => setC({ ...c, link: e.target.value })} className={!c.link.trim() || /^https:\/\//.test(c.link.trim()) ? '' : 'invalid'} />
          <span className="muted small" style={{ fontWeight: 400 }}>Vide = la version web de l’app. Exemple : {link}</span>
        </label>
      </div>
      <label>Message partagé par le lecteur
        <textarea rows={2} maxLength={300} value={c.share_text} onChange={(e) => setC({ ...c, share_text: e.target.value })} className={c.share_text.includes('{lien}') ? '' : 'invalid'} />
        <span className="muted small" style={{ fontWeight: 400 }}>{'{lien}'} est remplacé par son lien d’invitation (obligatoire), {'{code}'} par son code.</span>
      </label>
      <p className="muted small">Les badges Ambassadeur (3 amis validés) et Grand ambassadeur (10) se règlent comme les autres dans <a href="#badges" onClick={(e) => { e.preventDefault(); go('badges'); }}>Reconnaissance</a>, type « Parrainage ».</p>
      <div><button className="btn primary sm" disabled={bad} onClick={save}>Enregistrer</button></div>
    </section>
  );
}
