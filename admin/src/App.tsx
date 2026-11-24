import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { PremiumPage, ReaderSubscription } from './Premium';
import { premiumApi, type PremiumStats } from './premium-data';
import { AdsPage } from './Ads';
import { AlgoPage, ReaderTaste } from './Algo';
import { FollowPage } from './Follow';
import { BadgesPage } from './Badges';
import { ReferralPage } from './Referral';
import { BrandPage } from './Brand';
import { api, AUDIENCES, LINK, type AppMessage, type Audience, ENGINE_URL, type AuditEntry, type Dashboard, type EngineStatus, type ModerationCost, type Reader, type ReaderDetail, type ReaderFilter, type TopArticle, FLASH_URL, SOURCES_URL, PHOTO_TAGS, RUBRICS, type RubricHint, type Article, type Comment, type Edition, type Fact, type EngineRun, type LaunchWhat, type Flash, type Setting, type Me, type Profile, type Report, type Role, type Source, type SpendDay, type Status } from './data';

type Page = 'dashboard' | 'readers' | 'algo' | 'follow' | 'badges' | 'referral' | 'audit' | 'edition' | 'flash' | 'messages' | 'ai' | 'moderation' | 'ads' | 'premium' | 'team' | 'settings' | 'brand';
// Menu : une page par ligne, avec son groupe. Un groupe sans page visible n'est pas affiché.
const PAGES: [Page, string, string][] = [
  ['dashboard', 'Tableau de bord', ''],
  ['edition', 'Articles', 'Contenu'],
  ['flash', 'Dernière minute', 'Contenu'],
  ['ai', 'IA', 'Contenu'],
  ['readers', 'Lecteurs', 'Lecteurs'],
  ['moderation', 'Modération', 'Lecteurs'],
  ['messages', 'Messages', 'Lecteurs'],
  ['algo', 'Algorithme', 'Lecteurs'],
  ['follow', 'Sujets suivis', 'Lecteurs'],
  ['badges', 'Reconnaissance', 'Lecteurs'],
  ['referral', 'Parrainage', 'Lecteurs'],
  ['ads', 'Publicité', 'Revenus'],
  ['premium', 'Abonnements', 'Revenus'],
  ['brand', 'Personnalisation', 'Administration'],
  ['team', 'Équipe', 'Administration'],
  ['audit', 'Journal', 'Administration'],
  ['settings', 'Réglages', 'Administration'],
];
const GROUPS = ['', 'Contenu', 'Lecteurs', 'Revenus', 'Administration'];
// Anciennes adresses (#engine, #sources) : tout est maintenant dans la page IA.
const toPage = (h: string): Page => (h.includes('=') ? 'dashboard' : h === 'engine' || h === 'sources' ? 'ai' : (h as Page)) || 'dashboard';
const LIMITS = { title: 60, key: 140, fact: 90, summary: 280 };
const SUMMARY_HEADS = ['Contexte', 'Ce qui change', 'Et après'];

const dateLabel = (d: string) => new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(d + 'T12:00:00'));
const ago = (iso: string | null) => {
  if (!iso) return 'jamais';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : `il y a ${Math.round(m / 1440)} j`;
};
// Modération : seulement les commentaires. Rédaction : tout sauf les lecteurs, l'algorithme, la publicité, les abonnements, l'équipe, le journal et les réglages.
const ADMIN_ONLY: Page[] = ['readers', 'algo', 'follow', 'badges', 'referral', 'ads', 'premium', 'team', 'audit', 'settings', 'brand'];
const allowed = (role: Role, p: Page) => role === 'admin' || (role === 'editor' ? !ADMIN_ONLY.includes(p) : p === 'moderation');
const plain = (s: string) => s.replace(/<\/?b>/g, '');
/** Recherche sans accents ni majuscules. */
const norm = (s: string) => plain(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [page, setPage] = useState<Page>(() => toPage(location.hash.slice(1)));
  const [toast, setToast] = useState<string | null>(null);
  const [appName, setAppName] = useState('TITRE');
  useEffect(() => { api.me().then(setMe); }, []);
  // Nom réglé dans Personnalisation > Identité.
  useEffect(() => { if (me) api.settings().then((l) => { try { const n = JSON.parse(l.find((x) => x.key === 'BRAND')?.value ?? '{}').name; if (n) { setAppName(n); document.title = `${n} · back office`; } } catch {} }).catch(() => {}); }, [me?.id, page]);
  // Pas d'écriture tant que l'adresse porte encore un lien d'e-mail (Supabase le lit puis l'efface).
  useEffect(() => { if (!location.hash.includes('=')) location.hash = page; }, [page]);
  // Arrivée par le lien « mot de passe oublié », ou « Changer mon mot de passe » dans le menu.
  const [newPass, setNewPass] = useState(LINK.recovery);
  const say = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(null), 2400); }, []);

  if (me === undefined) return <div className="center muted">Chargement…</div>;
  if (!me) return <Login onIn={() => api.me().then(setMe)} />;
  if (newPass) return <NewPassword first={LINK.recovery} onDone={(m) => { setNewPass(false); if (m) say(m); }} />;
  if (me.role === 'reader')
    return (
      <div className="center">
        <div className="panel narrow">
          <h1>Accès réservé</h1>
          <p className="muted">Ce compte n'a pas accès au back office. Demandez à un administrateur de vous ajouter à l'équipe.</p>
          <button className="btn" onClick={() => api.signOut().then(() => setMe(null))}>Se déconnecter</button>
        </div>
      </div>
    );

  return (
    <div className="shell">
      <aside className="side">
        <div className="logo"><Glyph /> {appName} <span>back office</span></div>
        <nav>
          {GROUPS.map((g) => {
            const items = PAGES.filter(([p, , pg]) => pg === g && allowed(me.role, p));
            return items.length ? (
              <Fragment key={g}>
                {g ? <div className="nav-group">{g}</div> : null}
                {items.map(([p, l]) => <button key={p} className={page === p ? 'on' : ''} onClick={() => setPage(p)}>{l}</button>)}
              </Fragment>
            ) : null;
          })}
        </nav>
        <div className="who">
          {api.demo ? <div className="demo">Mode démo : données fictives</div> : null}
          <div className="muted small">{me.email}</div>
          <button className="link" onClick={() => setNewPass(true)}>Changer mon mot de passe</button>
          <button className="link" onClick={() => api.signOut().then(() => setMe(null))}>Se déconnecter</button>
        </div>
      </aside>
      <main className="main">
        <EngineBanner page={page} go={setPage} say={say} admin={me.role === 'admin'} />
        {!allowed(me.role, page) ? <ModerationPage say={say} /> : null}
        {page === 'dashboard' && allowed(me.role, page) && <DashboardPage go={setPage} />}
        {page === 'edition' && allowed(me.role, page) && <EditionPage say={say} go={setPage} />}
        {page === 'flash' && allowed(me.role, page) && <FlashPage say={say} />}
        {page === 'messages' && allowed(me.role, page) && <MessagesPage say={say} />}
        {page === 'ai' && allowed(me.role, page) && <AIPage say={say} admin={me.role === 'admin'} />}
        {page === 'moderation' && <ModerationPage say={say} />}
        {page === 'readers' && allowed(me.role, page) && <ReadersPage say={say} />}
        {page === 'premium' && allowed(me.role, page) && <PremiumPage say={say} />}
        {page === 'audit' && allowed(me.role, page) && <AuditPage />}
        {page === 'ads' && allowed(me.role, page) && <AdsPage say={say} />}
        {page === 'algo' && allowed(me.role, page) && <AlgoPage say={say} />}
        {page === 'follow' && allowed(me.role, page) && <FollowPage say={say} />}
        {page === 'badges' && allowed(me.role, page) && <BadgesPage say={say} />}
        {page === 'referral' && allowed(me.role, page) && <ReferralPage say={say} go={setPage} />}
        {page === 'team' && allowed(me.role, page) && <TeamPage say={say} me={me} />}
        {page === 'settings' && allowed(me.role, page) && <SettingsPage say={say} />}
        {page === 'brand' && allowed(me.role, page) && <BrandPage say={say} />}
      </main>
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

const when = (iso: string) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
/** Bandeau en haut de chaque page : moteur en pause, IA coupée, ou rien de publié aujourd'hui. Impossible à manquer. */
function EngineBanner({ page, go, say, admin }: { page: Page; go: (p: Page) => void; say: (m: string) => void; admin: boolean }) {
  const [s, setS] = useState<EngineStatus | null>(null);
  const load = useCallback(() => { api.engineStatus().then(setS).catch(() => setS(null)); }, []);
  useEffect(load, [page]);
  useEffect(() => {
    const t = setInterval(load, 60000);
    window.addEventListener('titre-settings', load);
    return () => { clearInterval(t); window.removeEventListener('titre-settings', load); };
  }, [load]);
  if (!s) return null;
  const fix = (k: string, msg: string) => api.setSetting(k, '').then(() => { say(msg); load(); window.dispatchEvent(new Event('titre-settings')); }).catch((e) => say(e instanceof Error ? e.message : 'Impossible'));
  const parisHour = Number(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  if (s.paused)
    return (
      <div className="engine-banner off" role="alert">
        <div>
          <b>Moteur en pause : aucune nouvelle info n'est publiée</b>
          <span className="small">{s.paused_at ? `Depuis ${when(s.paused_at)}${s.paused_by ? ` (par ${s.paused_by})` : ''}. ` : ''}{s.paused_until ? `Reprise automatique ${when(s.paused_until)}.` : 'Pas de reprise automatique.'}</span>
        </div>
        {admin ? <button className="btn primary" onClick={() => fix('ENGINE_PAUSED', 'Moteur relancé : prochain passage dans 10 minutes au plus')}>Relancer le moteur</button> : <span className="small">Un administrateur peut le relancer dans IA &gt; Pilotage.</span>}
      </div>
    );
  if (s.ai_off)
    return (
      <div className="engine-banner off" role="alert">
        <div><b>IA coupée : aucune nouvelle info n'est publiée</b><span className="small">Ce qui est en ligne reste visible. Interrupteur « Couper l'IA » dans IA &gt; Pilotage.</span></div>
        {admin ? <button className="btn primary" onClick={() => fix('AI_OFF', 'IA rallumée')}>Rallumer l'IA</button> : null}
      </div>
    );
  const pct = Math.max(s.budget_day_pct ?? 0, s.budget_month_pct ?? 0);
  if (pct >= (s.budget_alert ?? 80))
    return (
      <div className={`engine-banner ${pct >= 100 ? 'off' : 'warn-bar'}`} role="alert">
        <div>
          <b>{pct >= 100 ? 'Budget de l’IA atteint : l’IA est arrêtée' : `Budget de l’IA à ${pct} %`}</b>
          <span className="small">{[s.budget_day_pct != null ? `${s.budget_day_pct} % du plafond du jour` : '', s.budget_month_pct != null ? `${s.budget_month_pct} % du plafond du mois` : ''].filter(Boolean).join(' · ')}. {pct >= 100 ? 'Elle reprend au changement de jour ou de mois, ou si vous montez le plafond.' : 'Au plafond, l’IA s’arrête toute seule.'}</span>
        </div>
        {page !== 'ai' ? <button className="btn" onClick={() => go('ai')}>Voir le budget</button> : null}
      </div>
    );
  if (parisHour >= 10 && s.articles_today + s.flashes_today === 0)
    return (
      <div className="engine-banner warn-bar" role="alert">
        <div><b>Aucune info publiée aujourd'hui</b><span className="small">{s.last_published ? `Dernière publication ${when(s.last_published)}. ` : ''}Le journal du moteur explique pourquoi.</span></div>
        {page !== 'ai' ? <button className="btn" onClick={() => go('ai')}>Voir le journal</button> : null}
      </div>
    );
  return null;
}

function Glyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 48 48" aria-hidden>
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7B5CFF" /><stop offset="1" stopColor="#3D7BFF" /></linearGradient></defs>
      <rect width="48" height="48" rx="13" fill="url(#g)" />
      <rect x="9" y="11" width="30" height="7" rx="3.5" fill="#fff" /><rect x="9" y="21" width="22" height="7" rx="3.5" fill="#fff" opacity=".8" /><rect x="9" y="31" width="13" height="7" rx="3.5" fill="#fff" opacity=".6" />
    </svg>
  );
}

/* ---------------- Connexion ---------------- */
type LoginMode = 'in' | 'up' | 'forgot' | 'sent' | 'confirm';
function Login({ onIn }: { onIn: () => void }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(LINK.error);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [first, setFirst] = useState(false); // installation : aucun administrateur encore
  const [mode, setMode] = useState<LoginMode>('in');
  useEffect(() => { api.needsAdmin().then((f) => { setFirst(f); if (f) setMode('up'); }).catch(() => {}); }, []);
  const go = (m: LoginMode) => { setErr(null); setInfo(null); setMode(m); };
  const submit = async () => {
    setBusy(true); setErr(null); setInfo(null);
    if (mode === 'forgot') {
      const m = await api.resetPassword(email);
      setBusy(false);
      return m ? setErr(m) : setMode('sent');
    }
    const m = mode === 'up' ? await api.signUp(email, pw) : await api.signIn(email, pw);
    setBusy(false);
    if (m === 'confirm') return setMode('confirm');
    m ? setErr(m) : onIn();
  };
  const resend = async () => { const m = await api.resendConfirm(email); m ? setErr(m) : setInfo('E-mail de confirmation renvoyé.'); };
  if (mode === 'sent' || mode === 'confirm') return (
    <div className="center"><div className="panel narrow">
      <div className="logo big"><Glyph /> TITRE</div>
      <h1>Vérifiez votre boîte mail</h1>
      <p className="muted">{mode === 'sent'
        ? `Si un compte existe avec ${email}, un lien vient d’y être envoyé. Ouvrez-le : il vous ramène ici pour choisir un nouveau mot de passe.`
        : `Un lien de confirmation a été envoyé à ${email}. Cliquez dessus, puis revenez ici pour vous connecter.`} Pensez aux indésirables.</p>
      {err ? <p className="error">{err}</p> : null}
      {info ? <p className="muted small">{info}</p> : null}
      <button className="btn primary" onClick={() => { setFirst(false); go('in'); }}>{mode === 'sent' ? 'Retour à la connexion' : 'J’ai confirmé, me connecter'}</button>
      <button className="link" onClick={mode === 'sent' ? () => submit() : resend}>{mode === 'sent' ? 'Renvoyer le lien' : 'Rien reçu ? Renvoyer l’e-mail'}</button>
    </div></div>
  );
  const title = first ? 'Bienvenue' : mode === 'forgot' ? 'Mot de passe oublié' : mode === 'up' ? 'Créer un compte' : 'Back office';
  return (
    <div className="center">
      <form className="panel narrow" onSubmit={async (e) => { e.preventDefault(); await submit(); }}>
        <div className="logo big"><Glyph /> TITRE</div>
        <h1>{title}</h1>
        {first ? <p className="muted">La base est installée. Créez le compte administrateur : c'est le premier compte, il aura tous les droits.</p> : null}
        {mode === 'forgot' ? <p className="muted">Saisissez votre adresse : vous recevrez un lien pour choisir un nouveau mot de passe.</p> : null}
        {mode === 'up' && !first ? <p className="muted">Après la création, un administrateur vous donne l’accès depuis la page Équipe (avec votre adresse e-mail).</p> : null}
        {api.demo ? <p className="demo">Mode démo : aucune base n'est branchée. Cliquez sur « Se connecter » pour essayer avec des données fictives.</p> : null}
        <label>Adresse e-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required={!api.demo} autoComplete="username" /></label>
        {mode !== 'forgot' ? <label>Mot de passe{mode === 'up' ? ' (8 caractères au moins)' : ''}<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required={!api.demo} minLength={mode === 'up' ? 8 : undefined} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} /></label> : null}
        {err ? <p className="error">{err}</p> : null}
        {info ? <p className="muted small">{info}</p> : null}
        {err?.startsWith('Adresse pas encore confirmée') ? <button type="button" className="link" onClick={resend}>Renvoyer l’e-mail de confirmation</button> : null}
        <button className="btn primary" disabled={busy}>{busy ? 'Un instant…' : mode === 'forgot' ? 'Envoyer le lien' : mode === 'up' ? (first ? 'Créer le compte administrateur' : 'Créer mon compte') : 'Se connecter'}</button>
        {!first ? (
          <div className="login-links">
            {mode === 'in' ? <button type="button" className="link" onClick={() => go('forgot')}>Mot de passe oublié ?</button> : <button type="button" className="link" onClick={() => go('in')}>Retour à la connexion</button>}
            {mode === 'in' ? <button type="button" className="link" onClick={() => go('up')}>Créer un compte</button> : null}
          </div>
        ) : null}
      </form>
    </div>
  );
}

/** Nouveau mot de passe : après le lien « mot de passe oublié » (first) ou depuis le menu. */
function NewPassword({ first, onDone }: { first: boolean; onDone: (msg: string | null) => void }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="center">
      <form className="panel narrow" onSubmit={async (e) => {
        e.preventDefault();
        if (pw !== pw2) return setErr('Les deux mots de passe ne sont pas identiques.');
        setBusy(true);
        const m = await api.updatePassword(pw);
        setBusy(false);
        if (m) return setErr(m);
        if (first) history.replaceState(null, '', location.pathname + '#dashboard');
        onDone('Mot de passe changé');
      }}>
        <div className="logo big"><Glyph /> TITRE</div>
        <h1>Nouveau mot de passe</h1>
        <label>Nouveau mot de passe (8 caractères au moins)<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} autoComplete="new-password" /></label>
        <label>Le même, une seconde fois<input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required minLength={8} autoComplete="new-password" /></label>
        {err ? <p className="error">{err}</p> : null}
        <button className="btn primary" disabled={busy}>{busy ? 'Un instant…' : 'Enregistrer'}</button>
        {first ? null : <button type="button" className="link" onClick={() => onDone(null)}>Annuler</button>}
      </form>
    </div>
  );
}

/* ---------------- Édition du jour ---------------- */
type Filter = 'all' | 'review' | 'draft' | 'published' | 'rejected';
/* ---------------- Tableau de bord ---------------- */
const usd = (n: number) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
const int = (n: number) => n.toLocaleString('fr-FR');
const eur = (c: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(c / 100);
// Un passage en panne, bloqué, ou trop ancien (édition : 1 par jour ; Dernière minute : toutes les 10 min de 6 h à 23 h).
function engineAlert(r: Dashboard['last_runs'][number] | undefined, kind: 'edition' | 'flash'): string | null {
  if (!r) return 'Aucun passage enregistré pour l’instant.';
  const h = (Date.now() - new Date(r.started_at).getTime()) / 3600e3;
  if (r.status === 'error') return `Le dernier passage a planté : ${r.summary ?? 'voir IA > Historique'}`;
  if (r.summary?.startsWith('Moteur en pause') || r.summary?.startsWith('IA coupée')) return r.summary;
  if (r.status === 'running' && h > 0.75) return 'Le passage semble bloqué depuis plus de 45 minutes.';
  const parisHour = Number(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric' }).format(new Date()));
  if (kind === 'edition' && h > 26) return `Aucune édition depuis ${Math.round(h)} heures.`;
  if (kind === 'flash' && h > 2 && parisHour >= 7 && parisHour < 23) return `Aucun passage depuis ${Math.round(h)} heures.`;
  return null;
}
function DashboardPage({ go }: { go: (p: Page) => void }) {
  const [d, setD] = useState<Dashboard | null>(null);
  const [top, setTop] = useState<TopArticle[]>([]);
  const [mod, setMod] = useState<ModerationCost | null>(null);
  const [prem, setPrem] = useState<PremiumStats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [eng, setEng] = useState<EngineStatus | null>(null);
  useEffect(() => {
    const load = () => Promise.all([api.engineStatus().then(setEng).catch(() => null), api.dashboard().then(setD), api.topArticles().then(setTop), api.moderationCost().then(setMod), premiumApi.stats().then(setPrem).catch(() => null)]).catch((e) => setErr(e instanceof Error ? e.message : String(e)));
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);
  if (err) return <p className="warn">Tableau de bord indisponible : {err}. La mise à jour de la base (workflow « Installer la base ») est peut-être encore en cours.</p>;
  if (!d) return <p className="muted">Chargement…</p>;
  const runs = (['edition', 'flash'] as const).map((k) => ({ k, r: d.last_runs.find((x) => x.kind === k) }));
  const Tile = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
    <div className="panel tile"><div className="muted small">{label}</div><div className="tile-v">{value}</div>{sub ? <div className="muted small">{sub}</div> : null}</div>
  );
  return (
    <>
      <header className="head"><div><div className="eyebrow">Tableau de bord</div><h1>Comment va TITRE</h1><p className="muted">Mis à jour chaque minute. Un lecteur actif = un appareil qui a ouvert l'app ce jour-là, avec ou sans compte.</p></div></header>
      {runs.map(({ k, r }) => {
        const alert = engineAlert(r, k);
        return (
          <button key={k} className={`status-bar ${alert ? 'off' : ''}`} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }} onClick={() => go('ai')}>
            <b>{k === 'edition' ? 'Édition du matin' : 'Dernière minute'} : {alert ? 'problème' : 'tout va bien'}</b>
            <span className="muted small">{alert ?? `Dernier passage ${ago(r!.started_at)} : ${r!.summary ?? 'en cours'}`}</span>
          </button>
        );
      })}
      {eng ? (
        <button className={`status-bar ${eng.failing_sources.length ? 'off' : ''}`} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }} onClick={() => go('ai')}>
          <b>Aujourd'hui : {eng.articles_today} info{eng.articles_today > 1 ? 's' : ''} publiée{eng.articles_today > 1 ? 's' : ''} · {eng.flashes_today} en Dernière minute</b>
          <span className="muted small">{eng.failing_sources.length ? `Sources en échec : ${eng.failing_sources.map((x) => `${x.name} (${x.error ?? 'erreur'})`).join(', ')}. Les autres médias suffisent ; détail dans IA > Sources.` : 'Toutes les sources répondent.'}</span>
        </button>
      ) : null}
      <h2>Lecteurs</h2>
      <div className="tiles">
        <Tile label="Actifs aujourd'hui" value={int(d.active_today)} />
        <Tile label="Actifs sur 7 jours" value={int(d.active_7)} />
        <Tile label="Actifs sur 30 jours" value={int(d.active_30)} />
        <Tile label="Comptes créés" value={int(d.accounts)} sub={`+${int(d.accounts_7)} cette semaine`} />
        <Tile label="Likes, 7 jours" value={int(d.likes_7)} />
        <Tile label="Commentaires, 7 jours" value={int(d.comments_7)} sub={`${d.reports_open} signalement${d.reports_open > 1 ? 's' : ''} en attente · ${d.banned} banni${d.banned > 1 ? 's' : ''}`} />
      </div>
      <h2>Ce qui fait réagir cette semaine</h2>
      {top.length ? (
        <table className="table">
          <thead><tr><th>Info</th><th>Likes</th><th>Commentaires</th></tr></thead>
          <tbody>{top.map((a, i) => <tr key={i}><td><span className="muted small">{RUBRICS[a.rubric_id]}</span> {a.title}</td><td>{int(a.likes)}</td><td>{int(a.comments)}</td></tr>)}</tbody>
        </table>
      ) : <p className="muted">Pas encore de réactions cette semaine.</p>}
      <h2>Argent</h2>
      <div className="tiles">
        <Tile label="Coût de l'IA aujourd'hui" value={usd(d.ai_today)} />
        <Tile label="Coût de l'IA, 7 jours" value={usd(d.ai_7)} />
        <Tile label="Coût de l'IA, 30 jours" value={usd(d.ai_30)} sub="Estimé d'après les jetons consommés et le tarif du modèle" />
        <Tile label="Modération par l'IA, 30 jours" value={usd(mod?.cost ?? 0)} sub={`${int(mod?.judged ?? 0)} commentaire${(mod?.judged ?? 0) > 1 ? 's' : ''} tranché${(mod?.judged ?? 0) > 1 ? 's' : ''} · ${fmtTok((mod?.input ?? 0) + (mod?.output ?? 0))} jetons (déjà compris dans le coût de l'IA)`} />
        <Tile label="Revenus Premium, 30 jours" value={eur(prem?.revenue_30_cents ?? 0)} sub={`${int(prem?.premium ?? d.premium)} abonné${(prem?.premium ?? d.premium) > 1 ? 's' : ''} · revenu mensuel récurrent ${eur(prem?.mrr_cents ?? 0)}`} />
        <Tile label="Revenus publicité" value="→" sub="Détail par campagne dans la page Publicité" />
      </div>
    </>
  );
}

const STATUS_LABEL: Record<Status, string> = { draft: 'Brouillon', published: 'Publiée', rejected: 'Rejetée' };

function EditionPage({ say, go }: { say: (m: string) => void; go: (p: Page) => void }) {
  const [eds, setEds] = useState<Edition[]>([]);
  const [date, setDate] = useState<string | null>(null);
  const [list, setList] = useState<Article[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [edit, setEdit] = useState<Article | null>(null);
  const [auto, setAuto] = useState<boolean | null>(null);
  const [search, setSearch] = useState('');
  const [rub, setRub] = useState('');
  const [sort, setSort] = useState<'rank' | 'importance' | 'recent'>('rank');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const today = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const blank = (): Article => ({
    id: '', edition_date: date ?? today, rubric_id: 'france', status: 'draft', rank: 0, importance: 5, essential: false, sensitive: false, title: '', key_sentence: '',
    facts: [0, 1, 2].map(() => ({ text: '', source: '', url: '' })), summary: ['', '', ''], photo_tag: null, photo_url: null, review_notes: [], model: null, published_at: null, created_at: '',
  });
  const reload = useCallback(async (d = date) => {
    const e = await api.editions();
    setEds(e);
    const dd = d ?? e[0]?.date ?? null;
    setDate(dd);
    setList(dd ? await api.articles(dd) : []);
    setSel(new Set());
  }, [date]);
  useEffect(() => {
    reload();
    // Réservé aux admins : pour les autres, la ligne « mode de l'IA » n'est simplement pas affichée.
    api.settings().then((l) => { const v = l.find((x) => x.key === 'AUTO_PUBLISH')?.value; setAuto(v ? v === '1' : true); }).catch(() => {});
  }, []);

  const ed = eds.find((e) => e.date === date);
  const count = (f: (a: Article) => boolean) => list.filter(f).length;
  const isReview = (a: Article) => a.status === 'draft' && a.review_notes.length > 0;
  // Alerte simple (longueur, ponctuation, gras) : avertissement seulement, la carte se publie quand même.
  const serious = (a: Article) => a.review_notes.some((n) => !/trop long|ponctuation|en gras/.test(n));
  const needle = norm(search.trim());
  const shown = list.filter((a) => (filter === 'all' || (filter === 'review' ? isReview(a) : a.status === filter)) && (!rub || a.rubric_id === rub)
    && (!needle || norm(`${a.title} ${a.key_sentence} ${a.facts.map((f) => `${f.text} ${f.source}`).join(' ')}`).includes(needle)));
  const order = (x: Article, y: Article) => sort === 'importance' ? y.importance - x.importance || x.rank - y.rank : sort === 'recent' ? y.created_at.localeCompare(x.created_at) : x.rank - y.rank;
  const byRub = Object.keys(RUBRICS).map((r) => [r, shown.filter((a) => a.rubric_id === r).sort(order)] as const).filter(([, l]) => l.length);
  const picked = list.filter((a) => sel.has(a.id));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (!n.delete(id)) n.add(id); return n; });
  const bulk = async (patch: Partial<Article>, msg: string, only: (a: Article) => boolean = () => true) => {
    const l = picked.filter(only);
    if (!l.length) return say('Rien à changer dans la sélection');
    await api.saveArticles(l.map((a) => ({ id: a.id, patch })));
    setList((all) => all.map((x) => (l.some((o) => o.id === x.id) ? { ...x, ...patch } : x)));
    setSel(new Set());
    say(`${l.length} ${msg}`);
  };

  const save = async (a: Article, patch: Partial<Article>, msg?: string) => {
    await api.saveArticle(a.id, patch);
    setList((l) => l.map((x) => (x.id === a.id ? { ...x, ...patch } : x)));
    if (msg) say(msg);
  };
  const publish = (a: Article) => save(a, { status: 'published', published_at: new Date().toISOString() }, 'Carte publiée');
  const move = async (a: Article, dir: -1 | 1) => {
    const col = list.filter((x) => x.rubric_id === a.rubric_id).sort((x, y) => x.rank - y.rank);
    const i = col.findIndex((x) => x.id === a.id);
    const j = i + dir;
    if (j < 0 || j >= col.length) return;
    [col[i], col[j]] = [col[j], col[i]];
    const patches = col.map((x, k) => ({ id: x.id, patch: { rank: k } }));
    await api.saveArticles(patches);
    setList((l) => l.map((x) => ({ ...x, rank: patches.find((p) => p.id === x.id)?.patch.rank ?? x.rank })));
  };
  const publishClean = async () => {
    const ok = list.filter((a) => a.status === 'draft' && !serious(a));
    if (!ok.length) return say('Aucune carte sans alerte grave à publier');
    const now = new Date().toISOString();
    await api.saveArticles(ok.map((a) => ({ id: a.id, patch: { status: 'published', published_at: now } })));
    setList((l) => l.map((x) => (ok.some((o) => o.id === x.id) ? { ...x, status: 'published', published_at: now } : x)));
    say(`${ok.length} cartes publiées`);
  };
  const toggleEdition = async () => {
    if (!ed || !date) return;
    const next = ed.status === 'published' ? 'ready' : 'published';
    if (next === 'published' && !count((a) => a.status === 'published')) return say('Publiez au moins une carte avant l’édition');
    await api.setEdition(date, next);
    await reload(date);
    say(next === 'published' ? 'Édition en ligne dans l’app' : 'Édition retirée de l’app');
  };

  return (
    <>
      <header className="head">
        <div>
          <div className="eyebrow">Articles</div>
          <h1>{date ? dateLabel(date) : 'Aucune édition'}</h1>
          {ed ? (
            <div className="meta">
              <span className={`pill ${ed.status}`}>{ed.status === 'published' ? 'En ligne' : ed.status === 'ready' ? 'Prête, en attente' : 'En préparation'}</span>
              {ed.stats.fetched != null ? <span className="muted">{String(ed.stats.fetched)} titres lus · {String(ed.stats.stories ?? 0)} sujets retenus{ed.stats.fixed ? ` · ${String(ed.stats.fixed)} corrigées par l’IA` : ''} · modèle {String(ed.stats.model ?? '—')}</span> : null}
            </div>
          ) : null}
          {!ed && date ? <p className="warn">Aucune édition construite ce jour-là (moteur en pause ou passages non lancés). Choisissez un autre jour dans le calendrier, ou ajoutez un article.</p> : null}
          {auto !== null ? <p className="muted small">{auto ? 'Pilote automatique : l’IA publie seule, vous corrigez si besoin.' : 'Relecture : l’IA prépare des brouillons, vous publiez.'} <button className="link" onClick={() => go('ai')}>Régler l’IA</button></p> : null}
        </div>
        <div className="actions">
          <input type="date" style={{ width: "auto" }} value={date ?? today} max={today} onChange={(e) => e.target.value && reload(e.target.value)} aria-label="Choisir une édition" title={eds.length ? `Éditions construites : ${eds.map((e) => dateLabel(e.date)).join(', ')}` : 'Aucune édition construite'} />
          <button className="btn" onClick={() => setEdit(blank())}>Nouvel article</button>
          {count((a) => a.status === 'draft' && !serious(a)) ? <button className="btn" onClick={publishClean}>Publier les {count((a) => a.status === 'draft' && !serious(a))} brouillons sans alerte grave</button> : null}
          <button className={`btn ${ed?.status === 'published' ? '' : 'primary'}`} onClick={toggleEdition}>{ed?.status === 'published' ? 'Retirer l’édition' : 'Mettre l’édition en ligne'}</button>
        </div>
      </header>


      <div className="toolbar">
        <input type="search" placeholder="Rechercher un titre, un fait, un média…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Rechercher" />
        <select value={rub} onChange={(e) => setRub(e.target.value)} aria-label="Rubrique">
          <option value="">Toutes les rubriques</option>
          {Object.entries(RUBRICS).map(([k, v]) => <option key={k} value={k}>{v} ({count((a) => a.rubric_id === k)})</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Trier">
          <option value="rank">Ordre de l'app</option><option value="importance">Les plus importantes</option><option value="recent">Les plus récentes</option>
        </select>
      </div>

      <div className="tabs">
        {([['all', 'Toutes', list.length], ['review', 'À relire', count(isReview)], ['draft', 'Brouillons', count((a) => a.status === 'draft')], ['published', 'Publiées', count((a) => a.status === 'published')], ['rejected', 'Rejetées', count((a) => a.status === 'rejected')]] as [Filter, string, number][]).filter(([f, , n]) => f === 'all' || n || filter === f).map(([f, l, n]) => (
          <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{l} <b>{n}</b></button>
        ))}
      </div>

      {sel.size ? (
        <div className="bulk">
          <b>{sel.size} sélectionnée{sel.size > 1 ? 's' : ''}</b>
          <button className="btn primary sm" onClick={() => bulk({ status: 'published', published_at: new Date().toISOString() }, 'cartes publiées', (a) => a.status !== 'published')}>Publier</button>
          <button className="btn sm" onClick={() => bulk({ status: 'draft', published_at: null }, 'cartes remises en brouillon', (a) => a.status !== 'draft')}>Brouillon</button>
          <button className="btn sm" onClick={() => bulk({ essential: true }, 'cartes marquées essentielles', (a) => !a.essential)}>Essentiel</button>
          <button className="btn ghost sm" onClick={() => bulk({ status: 'rejected' }, 'cartes rejetées', (a) => a.status !== 'rejected')}>Rejeter</button>
          <button className="btn ghost sm" onClick={() => setSel(new Set())}>Annuler</button>
        </div>
      ) : shown.length ? (
        <button className="link small selall" onClick={() => setSel(new Set(shown.map((a) => a.id)))}>Tout sélectionner ({shown.length})</button>
      ) : null}
      {!byRub.length ? <p className="muted empty">{search || rub ? 'Aucune carte ne correspond.' : "Rien ici pour l'instant."}</p> : null}
      {byRub.map(([r, l]) => (
        <section key={r} className="rub">
          <h2>{RUBRICS[r]} <span className="muted">{l.length}</span></h2>
          {l.map((a, k) => (
            <article key={a.id} className={`card ${a.status} ${sel.has(a.id) ? 'picked' : ''}`}>
              <input type="checkbox" className="pick" checked={sel.has(a.id)} onChange={() => toggle(a.id)} aria-label="Sélectionner" />
              {sort === 'rank' ? (
                <div className="order">
                  <button className="ic" onClick={() => move(a, -1)} disabled={k === 0} aria-label="Monter">↑</button>
                  <button className="ic" onClick={() => move(a, 1)} disabled={k === l.length - 1} aria-label="Descendre">↓</button>
                </div>
              ) : null}
              <div className="thumb" style={{ backgroundImage: a.photo_url ? `url(${a.photo_url})` : a.photo_tag ? `url(photos/${a.photo_tag}.jpg)` : undefined }} />
              <div className="body" onClick={() => setEdit(a)}>
                <div className="line">
                  <span className={`pill ${a.status}`}>{STATUS_LABEL[a.status]}</span>
                  {a.essential ? <span className="pill ess">Essentiel</span> : null}
                  {a.sensitive ? <span className="pill">Sensible</span> : null}
                  <span className="muted small">importance {a.importance}/10 · {a.published_at ? `publiée ${ago(a.published_at)}` : `écrite ${ago(a.created_at)}`}</span>
                </div>
                <h3>{a.title}</h3>
                <p className="muted">{a.key_sentence}</p>
                <p className="muted small srcs">{[...new Set(a.facts.map((f) => f.source).filter(Boolean))].join(' · ') || 'Aucune source'}</p>
                {a.review_notes.length ? <p className="warn">⚠ {a.review_notes.join(' · ')}{serious(a) ? '' : ' (simple avertissement)'}</p> : null}
              </div>
              <div className="btns">
                {a.status !== 'published' ? <button className="btn primary sm" onClick={() => publish(a)}>{a.review_notes.length ? 'Publier quand même' : 'Publier'}</button> : <button className="btn sm" onClick={() => save(a, { status: 'draft', published_at: null }, 'Carte dépubliée')}>Dépublier</button>}
                <button className="btn sm" onClick={() => setEdit(a)}>Modifier</button>
                {a.status !== 'rejected' ? <button className="btn ghost sm" onClick={() => save(a, { status: 'rejected' }, 'Carte rejetée')}>Rejeter</button> : <button className="btn ghost sm" onClick={() => save(a, { status: 'draft' }, 'Carte remise en brouillon')}>Restaurer</button>}
              </div>
            </article>
          ))}
        </section>
      ))}

      {edit ? (
        <Editor
          a={edit}
          onClose={() => setEdit(null)}
          onSave={async (patch, pub) => {
            if (!edit.id) {
              const f = patch.facts ?? [];
              if (!patch.title?.trim() || !patch.key_sentence?.trim() || f.some((x) => !x.text.trim() || !x.source.trim())) return say('Remplissez le titre, la phrase clé et les 3 faits avec leur source');
              await api.createArticle({ ...patch, edition_date: edit.edition_date, rubric_id: patch.rubric_id ?? edit.rubric_id, status: pub ? 'published' : 'draft', published_at: pub ? new Date().toISOString() : null });
              setEdit(null);
              await reload(edit.edition_date);
              return say(pub ? 'Article ajouté et publié' : 'Article ajouté en brouillon');
            }
            await save(edit, { ...patch, review_notes: [], ...(pub ? { status: 'published', published_at: new Date().toISOString() } : {}) }, pub ? 'Carte enregistrée et publiée' : 'Carte enregistrée');
            setEdit(null);
          }}
        />
      ) : null}
    </>
  );
}

function Count({ v, max }: { v: string; max: number }) {
  const n = plain(v).length;
  return <span className={`count ${n > max ? 'over' : ''}`}>{n}/{max}</span>;
}

function Editor({ a, onClose, onSave }: { a: Article; onClose: () => void; onSave: (p: Partial<Article>, publish: boolean) => void }) {
  const [d, setD] = useState({ ...a, facts: a.facts.map((f) => ({ ...f })), summary: [...a.summary] });
  const [uploading, setUploading] = useState(false);
  const set = <K extends keyof Article>(k: K, v: Article[K]) => setD((x) => ({ ...x, [k]: v }));
  const setFact = (i: number, k: keyof Fact, v: string) => setD((x) => ({ ...x, facts: x.facts.map((f, j) => (j === i ? { ...f, [k]: v } : f)) }));
  const over = plain(d.title).length > LIMITS.title || d.key_sentence.length > LIMITS.key || d.facts.some((f) => plain(f.text).length > LIMITS.fact) || d.summary.some((s) => s.length > LIMITS.summary);
  const patch = (): Partial<Article> => ({ title: d.title, key_sentence: d.key_sentence, facts: d.facts, summary: d.summary, rubric_id: d.rubric_id, essential: d.essential, sensitive: d.sensitive, importance: d.importance, photo_tag: d.photo_tag, photo_url: d.photo_url || null, photo_credit: d.photo_url ? d.photo_credit || null : null });
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Modifier la carte">
        <div className="form">
          <div className="row2">
            <label>Rubrique<select value={d.rubric_id} onChange={(e) => set('rubric_id', e.target.value)}>{Object.entries(RUBRICS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label>Importance<input type="number" min={1} max={10} value={d.importance} onChange={(e) => set('importance', Number(e.target.value))} /></label>
            <label className="check"><input type="checkbox" checked={d.essential} onChange={(e) => set('essential', e.target.checked)} /> Essentiel (pour tout le monde)</label>
            <label className="check" title="Sujet triste ou choquant : il garde sa place selon son importance, mais n'est jamais poussé parce qu'il attire les clics, et aucune pub ne le suit."><input type="checkbox" checked={!!d.sensitive} onChange={(e) => set('sensitive', e.target.checked)} /> Sujet sensible (pas de mise en avant, pas de pub juste après)</label>
          </div>
          <label>Titre <Count v={d.title} max={LIMITS.title} /><input value={d.title} onChange={(e) => set('title', e.target.value)} /></label>
          <label>Phrase clé <Count v={d.key_sentence} max={LIMITS.key} /><textarea rows={2} value={d.key_sentence} onChange={(e) => set('key_sentence', e.target.value)} /></label>
          <div className="lbl">Les 3 faits <span className="muted small">mettez l'élément clé entre &lt;b&gt; et &lt;/b&gt;</span></div>
          {d.facts.map((f, i) => (
            <div key={i} className="fact">
              <label>Fait {i + 1} <Count v={f.text} max={LIMITS.fact} /><input value={f.text} onChange={(e) => setFact(i, 'text', e.target.value)} /></label>
              <div className="row2">
                <label>Source<input value={f.source} onChange={(e) => setFact(i, 'source', e.target.value)} /></label>
                <label>Lien<input value={f.url} onChange={(e) => setFact(i, 'url', e.target.value)} /></label>
              </div>
            </div>
          ))}
          <div className="lbl">Résumé « Lire · 1 min »</div>
          {d.summary.map((s, i) => (
            <label key={i}>{SUMMARY_HEADS[i]} <Count v={s} max={LIMITS.summary} /><textarea rows={3} value={s} onChange={(e) => setD((x) => ({ ...x, summary: x.summary.map((y, j) => (j === i ? e.target.value : y)) }))} /></label>
          ))}
          <div className="row2">
            <label>Photo d'ambiance<select value={d.photo_tag ?? ''} onChange={(e) => set('photo_tag', e.target.value || null)}><option value="">Dégradé</option>{PHOTO_TAGS.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label>Ou adresse d'une photo libre de droits<input placeholder="https://…" value={d.photo_url ?? ''} onChange={(e) => setD((x) => ({ ...x, photo_url: e.target.value, photo_credit: null }))} /></label>
          </div>
          <div className="row2">
            <label>Ou envoyer une image (JPG, PNG, WebP, 5 Mo max.)<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setUploading(true);
              try { const url = await api.uploadPhoto(f); setD((x) => ({ ...x, photo_url: url, photo_credit: null })); }
              catch (err) { alert(`Envoi impossible (${err instanceof Error ? err.message : err}). Collez plutôt l'adresse de l'image.`); }
              finally { setUploading(false); }
            }} /></label>
            {d.photo_url ? <label>Crédit photo (affiché dans l'app)<input placeholder="Photo : Nom de l'auteur" value={d.photo_credit ?? ''} onChange={(e) => set('photo_credit', e.target.value)} /></label> : null}
          </div>
          {a.review_notes.length ? <p className="warn">Alertes du moteur : {a.review_notes.join(' · ')}. Elles disparaissent quand vous enregistrez.</p> : null}
        </div>
        <div className="preview">
          <div className="phone" style={{ backgroundImage: d.photo_url ? `url(${d.photo_url})` : d.photo_tag ? `url(photos/${d.photo_tag}.jpg)` : undefined }}>
            <div className="veil" />
            <div className="pc">
              <div className="pline"><span className="ppill">{RUBRICS[d.rubric_id]?.toUpperCase()}</span>{d.essential ? <span className="ptag">Essentiel</span> : null}</div>
              <div className="ptitle">{d.title}</div>
              <div className="pkey">{d.key_sentence}</div>
              {d.facts.map((f, i) => <div key={i} className="pfact" dangerouslySetInnerHTML={{ __html: safeBold(f.text) }} />)}
              <div className="pbtn">Lire · 1 min</div>
            </div>
          </div>
          <div className="pfoot">
            {over ? <p className="warn">Un texte dépasse la longueur conseillée : simple avertissement, vous pouvez publier quand même.</p> : null}
            <button className="btn" onClick={onClose}>Annuler</button>
            <button className="btn" onClick={() => onSave(patch(), false)}>Enregistrer</button>
            <button className="btn primary" onClick={() => onSave(patch(), true)}>Enregistrer et publier</button>
          </div>
        </div>
      </div>
    </div>
  );
}
// Aperçu : on échappe tout, puis on ne réautorise que <b>.
const safeBold = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&lt;b&gt;/g, '<b>').replace(/&lt;\/b&gt;/g, '</b>');

/* ---------------- Sources ---------------- */
/* ---------------- Réglages ---------------- */
const MODELS: [string, string][] = [['claude-opus-5-5', 'Claude Opus 5.5 (meilleure qualité)'], ['claude-sonnet-5-5', 'Claude Sonnet 5.5 (équilibré)'], ['claude-haiku-5-5', 'Claude Haiku 5.5 (le moins cher)']];
const range = (a: number, b: number, step = 1) => Array.from({ length: Math.floor((b - a) / step) + 1 }, (_, i) => a + i * step);
// Lecture et écriture des réglages, partagées par la page IA et la page Réglages.
function useSettings(say: (m: string) => void, enabled = true) {
  const [list, setList] = useState<Setting[] | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const load = () => api.settings().then(setList).catch((e) => { setList([]); say(e instanceof Error ? e.message : 'Lecture impossible'); });
  useEffect(() => { if (enabled) load(); }, []);
  const get = (k: string) => list?.find((s) => s.key === k)?.value ?? '';
  const save = async (k: string, v: string, msg = 'Réglage enregistré') => {
    try { await api.setSetting(k, v); setDraft((d) => { const n = { ...d }; delete n[k]; return n; }); await load(); say(msg); window.dispatchEvent(new Event('titre-settings')); }
    catch (e) { say(e instanceof Error ? e.message : 'Enregistrement impossible'); }
  };
  const Key = ({ k, label, help, link }: { k: string; label: string; help: string; link: [string, string] }) => (
    <div className="setting">
      <div>
        <b>{label}</b> {get(k) ? <span className="pill published">Enregistrée {get(k)}</span> : <span className="pill rejected">Manquante</span>}
        <p className="muted small">{help} <a href={link[0]} target="_blank" rel="noreferrer">{link[1]} ↗</a></p>
      </div>
      <form className="setting-row" onSubmit={(e) => { e.preventDefault(); if (draft[k]?.trim()) save(k, draft[k], 'Clé enregistrée'); }}>
        <input type="password" autoComplete="off" placeholder={get(k) ? 'Coller une nouvelle clé pour la remplacer' : 'Coller la clé ici'} value={draft[k] ?? ''} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
        <button className="btn primary" disabled={!draft[k]?.trim()}>Enregistrer</button>
        {get(k) ? <button type="button" className="btn ghost" onClick={() => save(k, '', 'Clé effacée')}>Effacer</button> : null}
      </form>
    </div>
  );
  const Toggle = ({ k, label, help, def }: { k: string; label: string; help: string; def: boolean }) => {
    const on = get(k) ? get(k) === '1' : def;
    return (
      <div className="setting toggle">
        <div><b>{label}</b><p className="muted small">{help}</p></div>
        <input type="checkbox" checked={on} aria-label={label} onChange={(e) => save(k, e.target.checked ? '1' : '0')} />
      </div>
    );
  };
  const Pick = ({ k, label, help, def, options }: { k: string; label: string; help: string; def: string; options: [string, string][] }) => (
    <div className="setting">
      <div><b>{label}</b><p className="muted small">{help}</p></div>
      <select value={get(k) || def} onChange={(e) => save(k, e.target.value === def ? '' : e.target.value)} aria-label={label}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}{v === def ? ' (par défaut)' : ''}</option>)}
      </select>
    </div>
  );
  const nums = (vals: number[], unit = '') => vals.map((n) => [String(n), `${n}${unit}`] as [string, string]);
  const Text = ({ k, label, help, placeholder }: { k: string; label: string; help: string; placeholder: string }) => {
    const cur = get(k);
    const val = draft[k] ?? cur;
    return (
      <div className="setting column">
        <div><b>{label}</b> {cur ? <span className="pill published">Actives</span> : null}<p className="muted small">{help}</p></div>
        <textarea rows={4} maxLength={2000} placeholder={placeholder} value={val} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} aria-label={label} />
        <div className="setting-actions">
          <span className="muted small">{val.length}/2000</span>
          <button className="btn primary" disabled={val === cur} onClick={() => save(k, val, val.trim() ? 'Consignes enregistrées' : 'Consignes effacées')}>Enregistrer</button>
        </div>
      </div>
    );
  };
  return { list, get, save, Key, Toggle, Pick, Text, nums };
}

function SettingsPage({ say }: { say: (m: string) => void }) {
  const st = useSettings(say);
  if (!st.list) return <p className="muted">Chargement…</p>;
  return (
    <>
      <header className="head">
        <div>
          <div className="eyebrow">Réglages</div>
          <h1>Réactions et modération</h1>
          <p className="muted">Ce que les lecteurs peuvent faire sous les infos. Tout ce qui touche à l'IA (modèle, consignes, publication, clés) est dans la page IA.</p>
        </div>
      </header>
      <section className="panel settings">
        <h2>Réactions des lecteurs</h2>
        {st.Pick({ k: 'COMMENTS_MODE', label: 'Sous chaque info', help: "Emoji : les commentaires disparaissent de l'app (ceux déjà écrits sont gardés, pas affichés) et chaque lecteur choisit une réaction parmi ❤️ 😂 😮 😢 😡 👏. Les likes et dislikes restent dans les deux cas.", def: 'comments', options: [['comments', 'Commentaires'], ['emoji', 'Réactions emoji seulement']] })}
      </section>
      <section className="panel settings">
        <h2>Modération</h2>
        {st.Pick({ k: 'MODERATION', label: 'Mode de modération', help: "Mots-clés : un commentaire ou un pseudo qui contient une insulte de la liste est refusé à l'envoi, sans coût. IA : toutes les 10 minutes, l'IA relit les commentaires signalés, masque ce qui enfreint les règles, garde le reste et laisse les cas douteux à l'équipe ; chaque décision est expliquée dans le Journal et son coût est au Tableau de bord.", def: 'both', options: [['both', 'Mots-clés et IA'], ['words', 'Mots-clés seulement (gratuit)'], ['ai', 'IA seulement']] })}
        {st.Pick({ k: 'COMMENT_RATE', label: 'Commentaires par minute', help: 'Au-delà, le lecteur doit attendre un instant avant de commenter à nouveau (contre les rafales et les robots).', def: '5', options: st.nums([1, 2, 3, 5, 10, 20], ' par minute') })}
        {st.Pick({ k: 'REPORTS_TO_HIDE', label: 'Masquer automatiquement au', help: "Un commentaire signalé par ce nombre de lecteurs différents est masqué en attendant la décision (de l'IA ou de l'équipe).", def: '3', options: [['0', 'Jamais'], ...st.nums([2, 3, 4, 5, 10], 'e signalement')] })}
        {st.Text({ k: 'BANNED_WORDS', label: 'Mots interdits en plus', help: "Les insultes courantes sont déjà bloquées, même déguisées (c0nnard, connnnard). Ajoutez vos mots, séparés par des virgules : un commentaire ou un pseudo qui en contient un est refusé.", placeholder: 'mot1, mot2, une expression' })}
      </section>
    </>
  );
}

/* ---------------- IA : réglages, sources et historique du moteur ---------------- */
type AITab = 'pilotage' | 'edition' | 'flash' | 'sources' | 'history' | 'keys';
const AI_TABS: [AITab, string, boolean][] = [['pilotage', 'Pilotage', true], ['edition', 'Édition', true], ['flash', 'Dernière minute', true], ['sources', 'Sources', false], ['history', 'Historique', false], ['keys', 'Clés', true]];
function AIPage({ say, admin }: { say: (m: string) => void; admin: boolean }) {
  const st = useSettings(say, admin);
  const [tab, setTab] = useState<AITab>(admin ? 'pilotage' : 'history');
  const [steps, setSteps] = useState<string[] | null>(null);
  const runEngine = async () => {
    setSteps([]);
    await api.runEngine!((s) => setSteps((l) => [...(l ?? []), s]));
  };
  const get = st.get;
  // Lancer un passage d'un clic ; sans jeton GitHub, la page GitHub s'ouvre pour le lancer à la main.
  const launch = async (what: LaunchWhat) => {
    const test = what === 'test' || what === 'flash_test';
    if (!test && what === 'edition' && !window.confirm("Générer l'édition du jour maintenant ? L'IA construit l'édition, ou la complète si elle existe déjà (environ 5 minutes, coût habituel d'une édition).")) return;
    try {
      const r = await api.launchEngine(what);
      if (r.ok) { say(test ? 'Test lancé : le résultat arrive dans Historique d’ici 2 à 5 minutes, rien ne sera publié' : 'Passage lancé : le résultat arrive dans Historique d’ici 2 à 5 minutes'); setTab('history'); return; }
      if (r.reason === 'recent') return say('Déjà lancé il y a moins d’une minute : le résultat arrive dans Historique');
      window.open(what.startsWith('flash') ? FLASH_URL : ENGINE_URL, '_blank');
      say(`Jeton GitHub absent (onglet Clés) : GitHub s’ouvre, cliquez « Run workflow »${test ? ' et tapez test dans « mode »' : ''}`);
    } catch (e) { say(e instanceof Error ? e.message : 'Lancement impossible'); }
  };
  const TestBox = ({ what, label }: { what: LaunchWhat; label: string }) => (
    <section className="panel settings">
      <h2>Mode test</h2>
      <div className="setting">
        <div><b>{label}</b><p className="muted small">Passage à blanc avec les réglages ci-dessus : l’IA lit les dépêches, choisit et écrit comme d’habitude, mais rien n’est publié. Le résultat complet (sujets retenus, écartés et pourquoi, cartes d’essai) arrive dans Historique, marqué « Test ». Coût : environ un passage normal{what === 'test' ? ', 5 cartes au plus' : ''}.</p></div>
        <button className="btn" onClick={() => launch(what)}>Tester maintenant</button>
      </div>
    </section>
  );
  const pauseV = get('ENGINE_PAUSED');
  const paused = pauseV === '1' || (!!pauseV && pauseV !== '0' && new Date(pauseV).getTime() > Date.now());
  const auto = get('AUTO_PUBLISH') ? get('AUTO_PUBLISH') === '1' : true;
  const noKey = admin && st.list && !get('ANTHROPIC_API_KEY');
  const aiOff = get('AI_OFF') === '1';
  const [spend, setSpend] = useState<{ today: number; month: number } | null>(null);
  const [history, setHistory] = useState<SpendDay[] | null>(null);
  useEffect(() => { if (admin) { api.aiSpend().then(setSpend).catch(() => {}); api.aiSpendHistory().then(setHistory).catch(() => {}); } }, []);
  const capDay = Number(get('AI_BUDGET_DAY') || 0), capMonth = Number(get('AI_BUDGET_MONTH') || 0);
  const overBudget = !!spend && ((capDay > 0 && spend.today >= capDay) || (capMonth > 0 && spend.month >= capMonth));
  return (
    <>
      <header className="head">
        <div>
          <div className="eyebrow">IA</div>
          <h1>Pilotage de l'IA</h1>
          <p className="muted">Comment l'IA choisit et écrit les infos, les médias qu'elle lit, et ce qu'elle a fait à chaque passage. Le moteur relit ces réglages à chaque passage.</p>
        </div>
        <div className="actions">
          {api.runEngine ? <button className="btn" onClick={runEngine} title="Simulation du moteur (mode démo)">Générer l'édition</button> : admin ? <button className="btn primary" onClick={() => launch('edition')}>Générer l'édition</button> : <a className="btn" href={ENGINE_URL} target="_blank" rel="noreferrer">Générer l'édition ↗</a>}
          {admin ? <button className="btn" onClick={() => launch('flash')}>Lancer Dernière minute</button> : <a className="btn" href={FLASH_URL} target="_blank" rel="noreferrer">Lancer Dernière minute ↗</a>}
        </div>
      </header>
      {admin && st.list ? (
        <div className={`status-bar ${paused || noKey || aiOff || overBudget ? 'off' : ''}`}>
          <b>{aiOff ? 'IA coupée : aucune dépense' : overBudget ? 'Budget de l’IA atteint' : noKey ? 'Clé Claude manquante' : paused ? 'Moteur en pause' : auto ? 'Pilote automatique : l’IA publie seule' : 'Relecture : l’IA prépare, vous publiez'}</b>
          <span className="muted small">{aiOff ? 'Plus aucun appel à Claude : ni édition, ni Dernière minute, ni modération par l’IA. Ce qui est en ligne reste visible.' : overBudget ? 'L’IA reprend quand le jour ou le mois change, ou si vous montez le plafond ci-dessous.' : noKey ? 'Collez-la dans l’onglet Clés, sinon le moteur ne peut rien écrire.' : paused ? 'Ni édition ni Dernière minute tant que la pause est active.' : 'Édition chaque matin à 5 h 30, complétée toutes les heures de 9 h à 22 h ; Dernière minute toutes les 10 minutes de 6 h à 23 h.'}</span>
        </div>
      ) : null}
      {steps ? (
        <div className="panel engine">
          <div className="engine-head"><b>Moteur</b><button className="btn ghost sm" onClick={() => setSteps(null)}>Fermer</button></div>
          <ol>{steps.map((s, i) => <li key={i} className={i === steps.length - 1 && !s.startsWith('Terminé') && !s.startsWith('Rien') ? 'running' : 'done'}>{s}</li>)}</ol>
        </div>
      ) : null}
      <div className="tabs">
        {AI_TABS.filter(([, , adm]) => admin || !adm).map(([t, l]) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{l}</button>)}
      </div>
      {admin && !st.list && ['pilotage', 'edition', 'flash', 'keys'].includes(tab) ? <p className="muted">Chargement…</p> : null}
      {admin && st.list && tab === 'pilotage' ? (
        <>
          <section className="panel settings">
            <h2>Budget de l'IA</h2>
            {spend ? <p className="small">Dépense estimée : <b>{usd(spend.today)}</b> aujourd'hui{capDay ? ` sur ${usd(capDay)}` : ''} · <b>{usd(spend.month)}</b> ce mois-ci{capMonth ? ` sur ${usd(capMonth)}` : ''}. <span className="muted">Estimation d'après les jetons utilisés ; la facture exacte est sur console.anthropic.com.</span></p> : null}
            {st.Toggle({ k: 'AI_OFF', label: 'Couper l’IA', help: "Arrêt total : plus aucun appel à Claude, donc plus aucune dépense. Le moteur ne publie plus rien de nouveau, ce qui est en ligne reste visible.", def: false })}
            {st.Pick({ k: 'AI_BUDGET_DAY', label: 'Plafond par jour', help: "Au-delà, l'IA s'arrête jusqu'au lendemain. Les cartes déjà écrites restent ; les sujets suivants attendent.", def: '0', options: [['0', 'Sans limite'], ...[1, 2, 3, 5, 10, 20, 50, 100].map((n) => [String(n), `${n} $`] as [string, string])] })}
            {st.Pick({ k: 'AI_BUDGET_MONTH', label: 'Plafond par mois', help: "Au-delà, l'IA s'arrête jusqu'au 1er du mois suivant.", def: '0', options: [['0', 'Sans limite'], ...[10, 25, 50, 100, 200, 300, 500, 1000, 2000].map((n) => [String(n), `${n} $`] as [string, string])] })}
            {st.Pick({ k: 'AI_BUDGET_ALERT', label: 'Alerte avant le plafond', help: "Un bandeau orange s'affiche en haut de toutes les pages du back office quand la dépense du jour ou du mois atteint cette part du plafond, et le journal du moteur le note.", def: '80', options: st.nums([50, 70, 80, 90], ' %') })}
            {st.Pick({ k: 'AI_BUDGET_RUN', label: 'Plafond par passage', help: "Un seul passage (édition, mise à jour ou Dernière minute) ne peut pas dépenser plus. Au-delà, il s'arrête ; le suivant repart à zéro.", def: '0', options: [['0', 'Sans limite'], ...[0.5, 1, 2, 3, 5, 10].map((n) => [String(n), usd(n)] as [string, string])] })}
            {st.Pick({ k: 'AI_MAX_CALLS', label: 'Appels à l’IA par passage, au plus', help: "Protection contre une boucle ou des réessais sans fin : au-delà, le passage s'arrête. Une édition de 40 cartes en fait environ 120.", def: '200', options: st.nums([50, 100, 200, 300, 500]) })}
            {history?.length ? (
              <details>
                <summary className="muted small">Historique des dépenses (30 jours)</summary>
                <table className="table small"><thead><tr><th>Jour</th><th>Édition</th><th>Dernière minute</th><th>Total</th><th>Passages</th></tr></thead>
                  <tbody>{history.map((d) => <tr key={d.day}><td>{new Date(d.day + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</td><td>{usd(d.edition)}</td><td>{usd(d.flash)}</td><td><b>{usd(d.edition + d.flash)}</b>{capDay && d.edition + d.flash >= capDay ? ' ⚠' : ''}</td><td>{d.runs}</td></tr>)}</tbody>
                </table>
              </details>
            ) : null}
          </section>
          <section className="panel settings">
            <h2>Garde-fous de publication</h2>
            <p className="muted small">Avant de publier seule, l'IA est contrôlée. Au moindre doute, la carte attend dans Articles « À relire » (et l'info Dernière minute reste masquée) au lieu de partir en ligne. La raison est notée sur la carte et dans Historique.</p>
            {st.Toggle({ k: 'GUARD_RULES', label: 'Ton neutre et chiffres vérifiés', help: "Gratuit, sans IA : repère les mots d'opinion, sensationnels ou partisans (scandale, incroyable, heureusement…), les points d'exclamation, et tout nombre qui n'apparaît pas dans les dépêches des médias.", def: true })}
            {st.Toggle({ k: 'GUARD_AI_CHECK', label: 'Seconde lecture par l’IA', help: "Une deuxième IA relit chaque carte avant publication automatique : rien d'inventé par rapport aux sources, pas d'opinion, pas de parti pris, rien d'extrême. Coût : un petit appel par carte publiée (environ +15 % sur la facture).", def: true })}
            {st.Pick({ k: 'PUBLISH_MAX_PER_DAY', label: 'Cartes publiées par jour, au plus', help: "Au-delà, les cartes suivantes attendent en brouillon jusqu'à ce que vous les publiiez. Protège contre une IA qui publierait en rafale.", def: '80', options: [['0', 'Sans limite'], ...st.nums([20, 40, 60, 80, 120, 200])] })}
            {st.Text({ k: 'GUARD_WORDS', label: 'Mots à surveiller en plus', help: "Une carte qui contient un de ces mots part en relecture. Séparez-les par des virgules ou des retours à la ligne.", placeholder: 'mot1, mot2, une expression' })}
          </section>
          <section className="panel settings">
            <h2>Pilotage</h2>
            <div className="setting">
              <div>
                <b>Pause du moteur</b> {paused ? <span className="pill rejected">En pause{pauseV !== '1' ? ` jusqu'à ${when(pauseV)}` : ''}</span> : <span className="pill published">En marche</span>}
                <p className="muted small">Arrêt d'urgence : plus aucune édition ni Dernière minute tant que la pause dure. Ce qui est déjà en ligne reste visible. Une pause s'affiche en rouge en haut de toutes les pages.</p>
              </div>
              <select aria-label="Pause du moteur" value={paused ? (pauseV === '1' ? 'forever' : 'until') : ''} onChange={(e) => {
                const v = e.target.value;
                if (!v) return st.save('ENGINE_PAUSED', '', 'Moteur relancé');
                if (v === 'until') return;
                const label = v === 'forever' ? "jusqu'à ce que vous le relanciez" : `pendant ${v} h`;
                if (!window.confirm(`Mettre le moteur en pause ${label} ? Plus aucune info ne sera publiée pendant ce temps.`)) return;
                st.save('ENGINE_PAUSED', v === 'forever' ? '1' : new Date(Date.now() + Number(v) * 3600e3).toISOString(), 'Moteur en pause');
              }}>
                <option value="">En marche</option>
                {paused && pauseV !== '1' ? <option value="until">En pause jusqu'à {when(pauseV)}</option> : null}
                {['1', '3', '6', '12', '24'].map((h) => <option key={h} value={h}>Pause {h} h</option>)}
                <option value="forever">Pause jusqu'à ce que je relance</option>
              </select>
            </div>
            {st.Toggle({ k: 'AUTO_PUBLISH', label: 'Pilote automatique', help: "L'IA publie l'édition seule chaque matin. Coupé : les cartes arrivent en brouillon et vous les publiez dans Articles.", def: true })}
          </section>
          <section className="panel settings">
            <h2>Comportement de l'IA</h2>
            {st.Pick({ k: 'TITRE_MODEL', label: 'Modèle Claude', help: 'Opus écrit le mieux ; Sonnet et Haiku coûtent nettement moins cher.', def: 'claude-opus-5-5', options: MODELS })}
            {st.Pick({ k: 'TITRE_EFFORT', label: 'Niveau de réflexion', help: "Plus de réflexion = sujets mieux choisis et cartes plus soignées, mais plus lent et plus cher.", def: 'medium', options: [['low', 'Rapide'], ['medium', 'Équilibré'], ['high', 'Approfondi']] })}
            {st.Text({ k: 'AI_GUIDELINES', label: 'Consignes de la rédaction', help: "Votre ligne éditoriale, donnée à l'IA à chaque passage (choix des sujets, écriture, Dernière minute). Elle ne peut pas l'amener à inventer ou déformer un fait.", placeholder: "Exemples :\n- Ton direct, phrases courtes, pas de jargon.\n- Toujours expliquer l'impact concret pour un jeune actif.\n- Privilégier les sujets européens en Monde." })}
            {st.Text({ k: 'AI_AVOID', label: 'Sujets à écarter', help: "L'IA ne retiendra jamais ces sujets, ni dans l'édition ni en Dernière minute.", placeholder: "Exemples :\n- Faits divers sans portée nationale\n- Rumeurs de transferts au football\n- Vie privée des célébrités" })}
          </section>
        </>
      ) : null}
      {admin && st.list && tab === 'edition' ? (
        <>
          <section className="panel settings">
            <h2>Édition : choix des sujets</h2>
            {st.Pick({ k: 'PER_RUBRIC', label: 'Sujets par rubrique', help: 'Nombre maximum de sujets que l’IA retient dans chaque rubrique.', def: '8', options: st.nums([2, 3, 4, 5, 6, 8, 10, 12, 16, 20]) })}
            {st.Pick({ k: 'MAX_CARDS', label: "Cartes par édition, au total", help: 'Plafond de cartes écrites chaque matin, toutes rubriques confondues. Au-delà, les sujets les moins importants sont écartés.', def: '40', options: st.nums([8, 12, 16, 24, 32, 40, 50, 60, 80, 120]) })}
            {st.Pick({ k: 'MAX_ESSENTIAL', label: 'Sujets « essentiels »', help: 'Les sujets que tout le monde voit en tête de « Mon édition », quelles que soient ses rubriques.', def: '4', options: st.nums(range(0, 10)) })}
            {st.Pick({ k: 'MIN_IMPORTANCE', label: 'Importance minimum', help: "L'IA note chaque sujet de 1 (anecdotique) à 10 (majeur). En dessous de ce seuil, le sujet est écarté.", def: '1', options: [['1', '1 (tout garder)'], ...st.nums(range(2, 8)).map(([v, l]) => [v, `${l} sur 10`] as [string, string])] })}
            {st.Pick({ k: 'MIN_SOURCES', label: 'Médias minimum par sujet', help: 'Nombre de médias différents qui doivent parler du sujet pour qu’il soit retenu. 2 ou plus = moins de sujets, mais tous recoupés.', def: '1', options: st.nums([1, 2, 3, 4]) })}
            {st.Pick({ k: 'MAX_ITEMS', label: 'Dépêches lues par l’IA, au plus', help: "Les plus récentes d'abord, doublons retirés. Moins = plus rapide et moins cher, au risque de rater un sujet.", def: '400', options: st.nums([100, 200, 300, 400, 600, 800]) })}
            {st.Pick({ k: 'WINDOW_HOURS', label: 'Période couverte', help: "Les dépêches publiées dans les dernières heures avant l'édition.", def: '30', options: st.nums([12, 18, 24, 30, 36, 48], ' h') })}
          </section>
          <section className="panel settings">
            <h2>Édition : écriture et publication</h2>
            {st.Toggle({ k: 'AUTO_FIX', label: 'Autocorrection', help: "Une carte qui échoue aux contrôles (trop longue, source manquante, phrase reprise d'un média) est réécrite une fois par l'IA.", def: true })}
            {st.Toggle({ k: 'PUBLISH_FLAGGED', label: 'Publier aussi les cartes avec alerte', help: "Déconseillé. Les alertes simples (texte un peu long, ponctuation, gras manquant) ne bloquent jamais la publication. Coupé, une carte avec une alerte grave (source manquante, reprise mot pour mot…) attend dans « À relire ».", def: false })}
            {st.Pick({ k: 'PUBLISH_MIN_IMPORTANCE', label: 'Publication automatique à partir de', help: 'Avec le pilote automatique, seules les cartes au moins aussi importantes sont publiées ; les autres attendent en brouillon.', def: '1', options: [['1', 'Toutes les cartes'], ...st.nums(range(3, 9)).map(([v, l]) => [v, `Importance ${l} et plus`] as [string, string])] })}
          </section>
          <section className="panel settings">
            <h2>Moteur : rapidité et ménage</h2>
            {st.Pick({ k: 'AI_CONCURRENCY', label: 'Cartes écrites en même temps', help: "Plus = édition prête plus vite. Baissez si Claude répond « trop de requêtes ».", def: '4', options: st.nums([1, 2, 3, 4, 6, 8]) })}
            {st.Pick({ k: 'FETCH_TIMEOUT', label: 'Attente maximum par source', help: 'Un média qui ne répond pas dans ce délai est passé, sans bloquer les autres.', def: '15', options: st.nums([5, 10, 15, 20, 30, 60], ' s') })}
            {st.Pick({ k: 'SOURCE_MAX_FAILS', label: 'Mettre une source à l’écart après', help: "Échecs d'affilée avant qu'une source morte soit désactivée toute seule (visible dans Sources, réactivable d'un clic).", def: '10', options: [['0', 'Jamais'], ...st.nums([3, 5, 10, 20, 50], ' échecs')] })}
            {st.Pick({ k: 'RAW_RETENTION_DAYS', label: 'Garder les dépêches lues', help: 'Au-delà, elles sont effacées de la base (les cartes gardent leurs sources et leurs liens).', def: '14', options: st.nums([3, 7, 14, 30, 60, 90], ' jours') })}
          </section>
          <RubricHintsPanel say={say} />
          <section className="panel settings">
            <h2>Édition : mises à jour de la journée</h2>
            {st.Toggle({ k: 'LIVE_UPDATES', label: 'Compléter l’édition au fil de la journée', help: "Toutes les heures de 9 h à 22 h, l'IA lit les dépêches des 4 dernières heures et ajoute les sujets nouveaux et importants, sans reprendre ceux déjà publiés. Dans l'app, les infos les plus importantes passent toujours en tête. Coût : un choix de sujets par heure, plus une carte par sujet ajouté.", def: true })}
            {st.Pick({ k: 'UPDATE_WINDOW_HOURS', label: 'Période lue à chaque mise à jour', help: 'Les dépêches des dernières heures, déjà traitées exclues.', def: '4', options: st.nums([1, 2, 3, 4, 6, 8, 12], ' h') })}
            {st.Pick({ k: 'LIVE_MAX_CARDS', label: 'Cartes ajoutées par mise à jour, au plus', help: 'Automatique = un quart du plafond de cartes de l’édition.', def: '0', options: [['0', 'Automatique'], ...st.nums([1, 2, 3, 5, 8, 10, 15, 20])] })}
            {st.Pick({ k: 'LIVE_MIN_CARDS', label: 'Cartes ajoutées par mise à jour, au moins', help: "S'il y a des dépêches nouvelles, chaque mise à jour ajoute au moins ce nombre de cartes, même sous l'importance minimum ci-dessous (les plus importantes d'abord). 0 = seulement les sujets au-dessus du seuil.", def: '1', options: st.nums([0, 1, 2, 3, 5]) })}
            {st.Pick({ k: 'LIVE_MIN_IMPORTANCE', label: 'Importance minimum pour une mise à jour', help: "Plus haut = moins d'ajouts, seulement les sujets qui comptent vraiment (et moins de coût). Au plus un quart du plafond de cartes par passage.", def: '6', options: st.nums(range(3, 10), ' sur 10') })}
          </section>
          <TestBox what="test" label="Tester l’édition" />
        </>
      ) : null}
      {admin && st.list && tab === 'flash' ? (
        <>
          <section className="panel settings">
            <h2>Dernière minute</h2>
            {st.Toggle({ k: 'FLASH_ENABLED', label: 'Activée', help: 'Le moteur cherche les infos majeures toutes les 10 minutes, de 6 h à 23 h.', def: true })}
            {st.Toggle({ k: 'FLASH_AUTO_PUBLISH', label: 'Publier sans relecture', help: 'Sinon, les infos arrivent masquées et vous les mettez en ligne depuis la page Dernière minute.', def: true })}
            {st.Pick({ k: 'FLASH_MIN_IMPORTANCE', label: 'Importance minimum', help: 'Seuil pour publier une info en Dernière minute (sur 10).', def: '8', options: st.nums(range(6, 10), ' sur 10') })}
            {st.Pick({ k: 'FLASH_MIN_SOURCES', label: 'Médias minimum', help: 'Nombre de médias différents qui doivent annoncer le fait.', def: '2', options: st.nums([1, 2, 3, 4]) })}
            {st.Pick({ k: 'FLASH_WINDOW_HOURS', label: 'Période lue', help: 'Les dépêches des dernières heures que l’IA examine à chaque passage.', def: '2', options: st.nums([1, 2, 3, 4, 6], ' h') })}
            {st.Pick({ k: 'FLASH_MIN_PER_DAY', label: 'Infos par jour, au moins', help: "Pour que la rubrique ne reste jamais vide : si la journée (6 h-23 h) est en retard sur ce rythme, le moteur accepte aussi des infos un peu moins importantes, toujours confirmées par plusieurs médias. Exemple avec 3 : une info dès le matin, deux vers 14 h, trois le soir.", def: '3', options: [['0', 'Pas de minimum (seulement les infos majeures)'], ...st.nums([1, 2, 3, 4, 5, 6, 8, 10])] })}
            {st.Pick({ k: 'FLASH_RELAX_IMPORTANCE', label: 'Importance acceptée pour tenir le minimum', help: "Seuil utilisé seulement quand la journée est en retard sur le minimum ci-dessus.", def: '6', options: st.nums([4, 5, 6, 7], ' sur 10') })}
            {st.Pick({ k: 'FLASH_MAX_PER_DAY', label: 'Infos par jour, au plus', help: 'Au-delà, le moteur arrête de publier jusqu’au lendemain.', def: '12', options: st.nums([3, 5, 8, 12, 20, 30, 50]) })}
          </section>
          <TestBox what="flash_test" label="Tester la Dernière minute" />
        </>
      ) : null}
      {admin && st.list && tab === 'keys' ? (
        <>
          <section className="panel settings">
            <h2>Clés</h2>
            {st.Key({ k: "ANTHROPIC_API_KEY", label: "Clé Claude", help: "Pour choisir les sujets et écrire les cartes. Elle commence par sk-ant-.", link: ['https://console.anthropic.com/settings/keys', 'Créer une clé'] })}
            <DispatchKey st={st} />
            {st.Key({ k: "UNSPLASH_ACCESS_KEY", label: "Clé Unsplash (photos)", help: "Facultatif. Une vraie photo libre de droits par article, créditée à son auteur ; sans clé, les photos d'ambiance de l'app. Collez l'« Access Key ».", link: ['https://unsplash.com/oauth/applications/new', 'Créer une clé gratuite'] })}
            {st.Key({ k: "PEXELS_API_KEY", label: "Clé Pexels (ancienne)", help: "Seulement si vous en avez déjà une : Pexels ne délivre plus de nouvelles clés. Utilisée si Unsplash ne trouve rien.", link: ['https://www.pexels.com/api/', 'Pexels'] })}
          </section>
        </>
      ) : null}
      {tab === 'sources' ? <SourcesPage say={say} /> : null}
      {tab === 'history' ? <EnginePage admin={admin} say={say} /> : null}
    </>
  );
}

/* Relance automatique : GitHub saute ses passages programmés, la base les déclenche elle-même. */
function DispatchKey({ st }: { st: ReturnType<typeof useSettings> }) {
  const [d, setD] = useState<{ cron: boolean; token: boolean; last: string | null } | null>(null);
  useEffect(() => { api.dispatchStatus().then(setD).catch(() => {}); }, [st.get('GITHUB_DISPATCH_KEY')]);
  return (
    <>
      {st.Key({ k: 'GITHUB_DISPATCH_KEY', label: 'Jeton GitHub (relance automatique)', help: "Recommandé. GitHub saute souvent ses passages programmés : avec ce jeton, la base lance elle-même l'édition, les mises à jour et la Dernière minute à l'heure. Créez un jeton « Fine-grained », dépôt AppRun seulement, permission « Actions : Read and write », puis collez-le ici.", link: ['https://github.com/settings/personal-access-tokens/new', 'Créer le jeton'] })}
      {d ? <p className="muted small">{!d.cron ? 'Relance automatique indisponible sur cette base (extension pg_cron absente).' : !d.token ? 'Relance automatique en attente du jeton.' : d.last ? `Relance automatique active · dernier lancement ${ago(d.last)}.` : 'Relance automatique active · premier lancement dans les 10 minutes.'}</p> : null}
    </>
  );
}

/* ---------------- Messages à l'ouverture de l'app ---------------- */
const emptyMsg = { title: '', body: '', audience: 'all' as Audience, days: '' };
function MessagesPage({ say }: { say: (m: string) => void }) {
  const [list, setList] = useState<AppMessage[]>([]);
  const [form, setForm] = useState(emptyMsg);
  const load = () => api.messages().then(setList).catch((e) => say(e instanceof Error ? e.message : 'Lecture impossible'));
  useEffect(() => { load(); }, []);
  const live = (m: AppMessage) => m.active && (!m.ends_at || new Date(m.ends_at) > new Date());
  return (
    <>
      <header className="head">
        <div>
          <div className="eyebrow">Messages</div>
          <h1>Message à l'ouverture de l'app</h1>
          <p className="muted">Une carte s'affiche une seule fois pour chaque lecteur, à sa prochaine ouverture de l'app. Choisissez à qui elle s'adresse.</p>
        </div>
      </header>
      <form className="panel addform" onSubmit={async (e) => {
        e.preventDefault();
        const days = Number(form.days);
        await api.saveMessage({ title: form.title.trim(), body: form.body.trim(), audience: form.audience, active: true, ends_at: days > 0 ? new Date(Date.now() + days * 86400e3).toISOString() : null })
          .then(() => { say('Message en ligne'); setForm(emptyMsg); load(); })
          .catch((err) => say(err instanceof Error ? err.message : 'Enregistrement impossible'));
      }}>
        <h2>Nouveau message</h2>
        <label>Titre <Count v={form.title} max={80} /><input value={form.title} maxLength={80} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="Nouveau : les réactions emoji" /></label>
        <label>Texte <Count v={form.body} max={400} /><textarea value={form.body} maxLength={400} rows={3} onChange={(e) => setForm({ ...form, body: e.target.value })} /></label>
        <div className="row3">
          <label>Pour qui<select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value as Audience })}>{Object.entries(AUDIENCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>Pendant<select value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })}><option value="">Jusqu'à ce que je l'arrête</option>{[1, 3, 7, 14, 30].map((d) => <option key={d} value={d}>{d} jour{d > 1 ? 's' : ''}</option>)}</select></label>
          <span />
        </div>
        <div><button className="btn primary">Mettre en ligne</button></div>
      </form>
      {list.length ? (
        <div className="flashes">
          {list.map((m) => (
            <div key={m.id} className={`flash panel ${live(m) ? '' : 'off'}`}>
              <div className="flash-body">
                <div className="muted small">{AUDIENCES[m.audience]} · {ago(m.created_at)}{m.ends_at ? ` · jusqu'au ${new Date(m.ends_at).toLocaleDateString('fr-FR')}` : ''}{live(m) ? null : <span className="pill rejected" style={{ marginLeft: 8 }}>Arrêté</span>}</div>
                <b>{m.title}</b>
                {m.body ? <p>{m.body}</p> : null}
              </div>
              <div className="flash-actions">
                {live(m) ? <button className="btn sm" onClick={async () => { await api.saveMessage({ id: m.id, active: false }); load(); say('Message arrêté'); }}>Arrêter</button> : null}
                <button className="btn sm ghost" onClick={async () => { await api.deleteMessage(m.id); load(); say('Message supprimé'); }}>Supprimer</button>
              </div>
            </div>
          ))}
        </div>
      ) : <p className="muted">Aucun message pour l'instant.</p>}
    </>
  );
}

/* ---------------- Moteur ---------------- */
function EnginePage({ admin, say }: { admin: boolean; say: (m: string) => void }) {
  const [runs, setRuns] = useState<EngineRun[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const load = () => api.runs().then((r) => { setRuns(r); setOpen((o) => o ?? r[0]?.id ?? null); }).catch(() => setRuns([]));
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);
  const when = (iso: string) => new Date(iso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  return (
    <>
      <p className="muted">Chaque passage du moteur : sources lues, sujets retenus et les titres qui les composent, cartes écrites, infos écartées et pourquoi. Se met à jour toute seule.</p>
      {runs && !runs.length ? <p className="muted">Aucun passage enregistré. Appliquez la migration <code>0004_engine_runs.sql</code> dans Supabase, puis lancez le moteur.</p> : null}
      <div className="runs">
        {(runs ?? []).map((r) => (
          <div key={r.id} className={`panel run ${r.status}`}>
            <button className="run-head" onClick={() => setOpen(open === r.id ? null : r.id)}>
              <span className={`pill ${r.status === 'ok' ? 'published' : r.status === 'error' ? 'rejected' : ''}`}>{r.kind === 'edition' ? 'Édition' : 'Dernière minute'}</span>
              <span className="muted small">{when(r.started_at)}</span>
              {r.details?.test ? <span className="pill">Test</span> : null}
              <span className="run-sum">{r.status === 'running' ? 'En cours…' : r.summary}</span>
              <span className="muted">{open === r.id ? '▾' : '▸'}</span>
            </button>
            {open === r.id ? <RunDetails r={r} /> : null}
            {open === r.id && admin && !r.details?.test && r.status !== 'running' ? (
              <div className="run-body"><button className="btn sm" onClick={async () => {
                if (!window.confirm("Retirer de l'app tout ce que ce passage a publié ? Les cartes repassent « À relire » dans Articles, les infos Dernière minute sont masquées. Vous pourrez les republier une par une.")) return;
                try { const n = await api.unpublishRun(r.id); say(`Retiré de l'app : ${n.articles} carte(s), ${n.flashes} info(s) Dernière minute`); } catch (e) { say(e instanceof Error ? e.message : 'Impossible'); }
              }}>Dépublier tout ce passage</button></div>
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
}

const fmtTok = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} M` : n >= 1e3 ? `${Math.round(n / 1e3)} k` : String(n));
const CONFIG_LABEL: Record<string, string> = {
  modele: 'Modèle', effort: 'Réflexion', consignes: 'Consignes', a_eviter: 'Sujets à écarter', fenetre_h: 'Période (h)', par_rubrique: 'Sujets par rubrique',
  cartes_max: 'Cartes au total', essentiels_max: 'Essentiels', importance_min: 'Importance minimum', medias_min: 'Médias minimum', pilote_auto: 'Pilote automatique',
  autocorrection: 'Autocorrection', publier_alertes: 'Publier avec alerte', importance_min_publication: 'Publication à partir de', active: 'Activée',
  publication_auto: 'Publication sans relecture', max_par_jour: 'Infos par jour', mises_a_jour: 'Mises à jour', importance_min_mise_a_jour: 'Importance min. mise à jour',
  fenetre_mise_a_jour_h: 'Période mise à jour (h)', cartes_max_mise_a_jour: 'Cartes par mise à jour', cartes_min_mise_a_jour: 'Cartes au moins par mise à jour',
  min_par_jour: 'Infos par jour, au moins', importance_si_retard: 'Importance si en retard', depeches_max: 'Dépêches lues', ia_en_parallele: 'Cartes en parallèle',
  publications_max_jour: 'Publications par jour', regles_ton: 'Ton et chiffres vérifiés', relecture_ia: 'Seconde lecture IA',
};
function RunDetails({ r }: { r: EngineRun }) {
  const d = r.details ?? {};
  const ai = r.stats?.ai as { calls: number; input: number; output: number } | undefined;
  return (
    <div className="run-body">
      {ai?.calls ? <p className="muted small">IA : {ai.calls} appel{ai.calls > 1 ? 's' : ''} · {fmtTok(ai.input)} jetons lus · {fmtTok(ai.output)} jetons écrits{r.stats?.model ? ` · ${String(r.stats.model)}` : ''}</p> : null}
      {d.stories?.length ? (
        <section>
          <h3>Sujets retenus ({d.stories.length})</h3>
          {d.stories.map((s, i) => (
            <div key={i} className="story">
              <div><b>{s.label}</b> <span className="muted small">· {RUBRICS[s.rubric] ?? s.rubric} · importance {s.importance}/10{s.essential ? ' · essentiel' : ''}{s.sensitive ? ' · sensible' : ''}</span></div>
              <ul>{s.items.map((it, k) => <li key={k} className="muted small">{it.source} : {it.title}</li>)}</ul>
            </div>
          ))}
        </section>
      ) : null}
      {d.dropped?.length ? (
        <section>
          <h3>Écartés par vos réglages ({d.dropped.length})</h3>
          <ul>{d.dropped.map((x, i) => <li key={i} className="small">{x.label} <span className="muted">: {x.why}</span></li>)}</ul>
        </section>
      ) : null}
      {d.cards?.length ? (
        <section>
          <h3>{d.test ? 'Cartes d’essai (non publiées)' : 'Cartes écrites'}</h3>
          <ul>{d.cards.map((c, i) => <li key={i}>{c.error ? '✗' : c.issues.length ? '⚠' : '✓'} <span className="muted small">[{RUBRICS[c.rubric] ?? c.rubric}]</span> {c.title}{c.error ? <span className="warn"> : {c.error}</span> : c.issues.length ? <span className="warn"> : {c.issues.join(', ')}</span> : null}{c.photo ? <span className="muted small"> · photo : {c.photo}</span> : null}{c.key_sentence ? <div className="small" style={{ margin: '4px 0 8px 18px' }}><div>{c.key_sentence}</div><ul>{c.facts?.map((f, k) => <li key={k} className="muted" dangerouslySetInnerHTML={{ __html: safeBold(f) }} />)}</ul></div> : null}</li>)}</ul>
        </section>
      ) : null}
      {d.flashes ? (
        <section>
          <h3>Infos proposées par l'IA ({d.flashes.length})</h3>
          {d.flashes.length ? <ul>{d.flashes.map((f, i) => <li key={i}>{f.rejected ? '✗' : '⚡'} {f.title} <span className="muted small">({f.sources.join(', ')}){f.rejected ? ` : écartée, ${f.rejected}` : ''}</span></li>)}</ul> : <p className="muted small">Rien d'assez important et confirmé selon vos réglages.</p>}
        </section>
      ) : null}
      {d.moderation?.length ? (
        <section>
          <h3>Signalements tranchés par l'IA ({d.moderation.length}){d.moderation_ai ? <span className="muted small"> · {fmtTok(d.moderation_ai.input + d.moderation_ai.output)} jetons</span> : null}</h3>
          <ul>{d.moderation.map((m, i) => <li key={i}>{m.decision === 'hide' ? '🚫 masqué' : '✓ gardé'} « {m.text} » <span className="muted small">{m.reason}</span></li>)}</ul>
        </section>
      ) : null}
      {d.left?.length ? (
        <details>
          <summary className="muted">Titres non retenus ({d.left.length}{d.left.length >= 150 ? '+' : ''})</summary>
          <ul>{d.left.map((it, i) => <li key={i} className="muted small">{it.source} : {it.title}</li>)}</ul>
        </details>
      ) : null}
      {d.config ? (
        <details>
          <summary className="muted">Réglages utilisés pour ce passage</summary>
          <dl className="config">{Object.entries(d.config).map(([k, v]) => <Fragment key={k}><dt>{CONFIG_LABEL[k] ?? k}</dt><dd>{v === true ? 'oui' : v === false ? 'non' : String(v)}</dd></Fragment>)}</dl>
        </details>
      ) : null}
      <details open={!d.stories && !d.flashes}>
        <summary className="muted">Journal complet ({r.log.length} lignes)</summary>
        <pre className="log">{r.log.join('\n')}</pre>
      </details>
    </div>
  );
}

/* ---------------- Dernière minute ---------------- */
const emptyFlash = { id: '', title: '', sentence: '', rubric_id: '', src1: '', url1: '', src2: '', url2: '' };
function FlashPage({ say }: { say: (m: string) => void }) {
  const [list, setList] = useState<Flash[]>([]);
  const [form, setForm] = useState(emptyFlash);
  const load = () => api.flashes().then(setList);
  useEffect(() => { load(); }, []);
  const time = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).replace(':', ' h ');
  const edit = (f: Flash) => {
    setForm({ id: f.id, title: f.title, sentence: f.sentence, rubric_id: f.rubric_id ?? '', src1: f.sources[0]?.source ?? '', url1: f.sources[0]?.url ?? '', src2: f.sources[1]?.source ?? '', url2: f.sources[1]?.url ?? '' });
    setTimeout(() => document.querySelector('.addform')?.scrollIntoView({ behavior: 'smooth' }), 0);
  };
  const set = (k: keyof typeof emptyFlash) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  return (
    <>
      <header className="head">
        <div>
          <div className="eyebrow">Dernière minute</div>
          <h1>Infos de la journée</h1>
          <p className="muted">Le moteur passe toutes les 10 minutes, de 6 h à 23 h, et publie seul les infos majeures confirmées par au moins deux médias. Elles restent 24 heures dans l'app. Masquez, corrigez ou ajoutez une info ici.</p>
        </div>
        <div className="actions"><a className="btn" href={FLASH_URL} target="_blank" rel="noreferrer">Lancer maintenant ↗</a></div>
      </header>
      {!list.length && <p className="muted">Aucune info pour l'instant.</p>}
      <div className="flashes">
        {list.map((f) => (
          <div key={f.id} className={`flash panel ${f.status === 'hidden' ? 'off' : ''}`}>
            <div className="flash-time">{time(f.published_at)}</div>
            <div className="flash-body">
              <div className="muted small">
                {f.rubric_id ? RUBRICS[f.rubric_id] : 'Sans rubrique'} · {f.manual ? 'ajoutée à la main' : 'moteur'}
                {f.status === 'hidden' && <span className="pill rejected" style={{ marginLeft: 8 }}>Masquée</span>}
                {f.sensitive && <span className="pill" style={{ marginLeft: 8 }} title="Aucune alerte « sujet suivi » pour cette info">Sensible</span>}
              </div>
              <b>{f.title}</b>
              <p>{f.sentence}</p>
              <div className="muted small">{f.sources.map((s) => <a key={s.url} href={s.url} target="_blank" rel="noreferrer" style={{ marginRight: 12 }}>{s.source} ↗</a>)}</div>
            </div>
            <div className="flash-actions">
              <button className="btn sm" onClick={() => edit(f)}>Modifier</button>
              <button className="btn sm ghost" title="Sujet triste ou choquant : aucune alerte n'est envoyée aux lecteurs qui suivent ce sujet." onClick={async () => { await api.saveFlash({ id: f.id, sensitive: !f.sensitive }); load(); say(f.sensitive ? 'Info non sensible : alertes possibles' : 'Sujet sensible : aucune alerte pour cette info'); }}>{f.sensitive ? 'Pas sensible' : 'Sensible'}</button>
              <button className="btn sm" onClick={async () => { await api.saveFlash({ id: f.id, status: f.status === 'hidden' ? 'published' : 'hidden' }); load(); say(f.status === 'hidden' ? 'Info remise en ligne' : 'Info masquée dans l’app'); }}>{f.status === 'hidden' ? 'Remettre' : 'Masquer'}</button>
            </div>
          </div>
        ))}
      </div>
      <form className="panel addform" onSubmit={async (e) => {
        e.preventDefault();
        const sources = [[form.src1, form.url1], [form.src2, form.url2]].filter(([s]) => s.trim()).map(([source, url]) => ({ source: source.trim(), url: url.trim() }));
        if (sources.some((s) => s.url && !/^https?:\/\//.test(s.url))) return say('Les liens doivent commencer par https://');
        const patch = { title: form.title.trim(), sentence: form.sentence.trim(), rubric_id: form.rubric_id || null, sources };
        await api.saveFlash(form.id ? { id: form.id, ...patch } : patch);
        say(form.id ? 'Info corrigée' : 'Info publiée dans l’app');
        setForm(emptyFlash);
        load();
      }}>
        <h2>{form.id ? 'Corriger l’info' : 'Ajouter une info'}</h2>
        <label>Titre <Count v={form.title} max={90} /><input value={form.title} maxLength={90} onChange={set('title')} required /></label>
        <label>Phrase <Count v={form.sentence} max={220} /><textarea value={form.sentence} maxLength={220} rows={3} onChange={set('sentence')} required /></label>
        <div className="row3">
          <label>Rubrique<select value={form.rubric_id} onChange={set('rubric_id')}><option value="">Aucune</option>{Object.entries(RUBRICS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>Source 1<input value={form.src1} onChange={set('src1')} placeholder="franceinfo" required /></label>
          <label>Lien 1<input value={form.url1} onChange={set('url1')} placeholder="https://…" /></label>
        </div>
        <div className="row3">
          <span />
          <label>Source 2<input value={form.src2} onChange={set('src2')} /></label>
          <label>Lien 2<input value={form.url2} onChange={set('url2')} placeholder="https://…" /></label>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn primary">{form.id ? 'Enregistrer' : 'Publier maintenant'}</button>
          {form.id && <button type="button" className="btn" onClick={() => setForm(emptyFlash)}>Annuler</button>}
        </div>
      </form>
    </>
  );
}

function SourcesPage({ say }: { say: (m: string) => void }) {
  const [list, setList] = useState<Source[]>([]);
  const [form, setForm] = useState({ name: '', url: '', rubric_hint: '' });
  const [edit, setEdit] = useState<Source | null>(null);
  const [only, setOnly] = useState<'all' | 'error' | 'off'>('all');
  const load = () => api.sources().then(setList);
  useEffect(() => { load(); }, []);
  const bad = (s: Source) => !!s.last_error;
  const shown = list.filter((s) => only === 'all' || (only === 'error' ? bad(s) : !s.active));
  const act = async (f: () => Promise<unknown>, msg: string) => {
    try { await f(); await load(); say(msg); } catch (e) { say(e instanceof Error ? e.message : 'Impossible'); }
  };
  const urlOk = (u: string) => /^https?:\/\/\S+$/.test(u.trim());
  return (
    <>
      <p className="muted">Le moteur lit le titre et le chapô de ces flux RSS, jamais l'article complet, plusieurs à la fois et seulement s'ils ont changé. Une source en échec trop de fois d'affilée est mise à l'écart toute seule. Vérifiez que chaque média autorise cet usage.</p>
      <div className="toolbar">
        <div className="tabs" style={{ margin: 0, border: 0 }}>
          {([['all', 'Toutes', list.length], ['error', 'En erreur', list.filter(bad).length], ['off', 'Désactivées', list.filter((s) => !s.active).length]] as const).map(([k, l, n]) => (
            <button key={k} className={only === k ? 'on' : ''} onClick={() => setOnly(k)}>{l} <b>{n}</b></button>
          ))}
        </div>
        <a className="btn" href={SOURCES_URL} target="_blank" rel="noreferrer" title="Ouvre GitHub : bouton « Run workflow ». Lit tous les flux, même désactivés, et note leur état ici. Se fait aussi chaque nuit.">Vérifier toutes les sources ↗</a>
      </div>
      <table className="table">
        <thead><tr><th>Média</th><th>Rubrique</th><th>Activité</th><th>État</th><th /></tr></thead>
        <tbody>
          {shown.map((s) => edit?.id === s.id ? (
            <tr key={s.id} className="edit-row">
              <td><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} aria-label="Nom" /><input value={edit.url} onChange={(e) => setEdit({ ...edit, url: e.target.value })} aria-label="Adresse du flux" /></td>
              <td><select value={edit.rubric_hint ?? ''} onChange={(e) => setEdit({ ...edit, rubric_hint: e.target.value || null })}><option value="">Toutes</option>{Object.entries(RUBRICS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
              <td colSpan={2} className="muted small">Une nouvelle adresse est relue au prochain passage.</td>
              <td className="btns">
                <button className="btn primary sm" disabled={!edit.name.trim() || !urlOk(edit.url)} onClick={() => act(() => api.saveSource({ id: s.id, name: edit.name.trim(), url: edit.url.trim(), rubric_hint: edit.rubric_hint, ...(edit.url !== s.url ? { last_error: null, fail_count: 0, etag: null, last_modified: null } : {}) }).then(() => setEdit(null)), 'Source modifiée')}>Enregistrer</button>
                <button className="btn ghost sm" onClick={() => setEdit(null)}>Annuler</button>
              </td>
            </tr>
          ) : (
            <tr key={s.id} className={s.active ? '' : 'off'}>
              <td><b>{s.name}</b><div className="muted small url">{s.url}</div></td>
              <td>{s.rubric_hint ? RUBRICS[s.rubric_hint] : <span className="muted">Toutes</span>}</td>
              <td className="small">
                {s.items_24h != null ? <div><b>{s.items_24h}</b> titres en 24 h · <b>{s.cards_7d ?? 0}</b> cartes en 7 j</div> : null}
                <div className="muted">Lue {ago(s.last_fetch_at)}{s.last_item_at ? ` · dernière dépêche ${ago(s.last_item_at)}` : ''}</div>
              </td>
              <td>
                {s.last_error ? <span className="pill rejected" title={s.last_error}>Erreur{s.fail_count && s.fail_count > 1 ? ` ×${s.fail_count}` : ''} : {s.last_error}</span>
                  : s.last_fetch_at ? <span className="pill published">OK{s.last_count != null ? ` · ${s.last_count} titres` : ''}</span> : <span className="pill">Pas encore lue</span>}
                {s.disabled_reason && !s.active ? <div className="muted small">{s.disabled_reason}</div> : null}
              </td>
              <td className="btns">
                <button className="btn sm" onClick={() => act(() => api.saveSource({ id: s.id, active: !s.active, ...(!s.active ? { fail_count: 0, disabled_reason: null } : {}) }), s.active ? 'Source désactivée' : 'Source activée')}>{s.active ? 'Désactiver' : 'Activer'}</button>
                <button className="btn sm" onClick={() => setEdit({ ...s })}>Modifier</button>
                <button className="btn ghost sm" onClick={() => confirm(`Supprimer ${s.name} et ses dépêches récentes ? Les cartes déjà écrites restent.`) && act(() => api.deleteSource(s.id), 'Source supprimée')}>Supprimer</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form className="panel addform" onSubmit={async (e) => {
        e.preventDefault();
        if (!urlOk(form.url)) return say('L’adresse doit commencer par https://');
        if (list.some((s) => s.url.trim() === form.url.trim())) return say('Cette adresse est déjà dans la liste');
        await act(() => api.saveSource({ name: form.name.trim(), url: form.url.trim(), rubric_hint: form.rubric_hint || null }), 'Source ajoutée, lue au prochain passage');
        setForm({ name: '', url: '', rubric_hint: '' });
      }}>
        <h2>Ajouter une source</h2>
        <div className="row3">
          <label>Nom du média<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label>Adresse du flux RSS<input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…/rss.xml" required /></label>
          <label>Rubrique<select value={form.rubric_hint} onChange={(e) => setForm({ ...form, rubric_hint: e.target.value })}><option value="">Toutes</option>{Object.entries(RUBRICS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        </div>
        <p className="muted small">Même nom pour plusieurs flux d'un média (Une, Sciences…) : l'IA le compte comme un seul média, et un article présent dans deux flux n'est lu qu'une fois.</p>
        <button className="btn primary">Ajouter</button>
      </form>
    </>
  );
}

/* ---------------- Rubriques : ce que l'IA range dans chacune ---------------- */
function RubricHintsPanel({ say }: { say: (m: string) => void }) {
  const [list, setList] = useState<RubricHint[] | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const load = () => api.rubrics().then(setList).catch(() => setList([]));
  useEffect(() => { load(); }, []);
  if (!list) return <p className="muted">Chargement…</p>;
  return (
    <section className="panel settings">
      <h2>Rubriques : ce que l'IA y range</h2>
      <p className="muted small">L'IA lit ces définitions pour classer chaque sujet. Précisez-les si un type d'info tombe souvent dans la mauvaise rubrique (par exemple « l'immobilier va en Économie »). Vide = définition d'origine.</p>
      {list.map((r) => {
        const val = draft[r.id] ?? r.ai_hint ?? '';
        return (
          <div key={r.id} className="rubric-hint">
            <b>{r.name}</b>
            <input value={val} maxLength={300} placeholder="Définition d'origine" onChange={(e) => setDraft({ ...draft, [r.id]: e.target.value })} aria-label={`Définition de ${r.name}`} />
            <button className="btn sm" disabled={val === (r.ai_hint ?? '')} onClick={async () => {
              try { await api.saveRubricHint(r.id, val); setDraft((d) => { const n = { ...d }; delete n[r.id]; return n; }); await load(); say('Rubrique enregistrée'); }
              catch (e) { say(e instanceof Error ? e.message : 'Enregistrement impossible'); }
            }}>Enregistrer</button>
          </div>
        );
      })}
    </section>
  );
}

/* ---------------- Modération ---------------- */
const until = (iso: string) => new Date(iso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function ModerationPage({ say }: { say: (m: string) => void }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [banned, setBanned] = useState<Profile[]>([]);
  const [tab, setTab] = useState<'reports' | 'recent' | 'banned'>('reports');
  const [autoSuspend, setAutoSuspend] = useState<string | null>(null); // null = réglage réservé aux admins
  const load = () => Promise.all([api.reports().then(setReports), api.comments().then(setComments), api.banned().then(setBanned)]);
  const act = async (f: () => Promise<void>, msg: string) => {
    try { await f(); await load(); say(msg); } catch (e) { say(e instanceof Error ? e.message : 'Action impossible'); }
  };
  const ban = (c?: Comment) => {
    const reason = c && prompt(`Bannir ${c.pseudo ?? 'ce lecteur'} ? Ses commentaires disparaissent de l'app et il ne pourra plus commenter ni signaler.\nMotif (facultatif) :`, '');
    if (c && reason !== null) act(() => api.setBanned(c.user_id, true, reason), `${c.pseudo ?? 'Lecteur'} banni`);
  };
  const suspend = (c?: Comment) => {
    const reason = c && prompt(`Suspendre ${c.pseudo ?? 'ce lecteur'} 7 jours ? Il lit toujours l'app mais ne commente plus.\nMotif (facultatif) :`, '');
    if (c && reason !== null) act(() => api.suspend(c.user_id, 7, reason), `${c.pseudo ?? 'Lecteur'} suspendu 7 jours`);
  };
  useEffect(() => {
    load();
    api.settings().then((l) => setAutoSuspend(l.find((x) => x.key === 'AUTO_SUSPEND')?.value ?? '3')).catch(() => setAutoSuspend(null));
  }, []);
  const grouped = useMemo(() => {
    const m = new Map<string, Report[]>();
    reports.forEach((r) => m.set(r.comment_id, [...(m.get(r.comment_id) ?? []), r]));
    return [...m.values()];
  }, [reports]);
  return (
    <>
      <header className="head"><div><div className="eyebrow">Modération</div><h1>Commentaires</h1><p className="muted">70 caractères maximum, signalables par les lecteurs. Les insultes sont refusées automatiquement (liste modifiable dans Réglages). Un commentaire masqué disparaît de l'app ; un lecteur suspendu ne commente plus pendant quelques jours ; un lecteur banni, plus jamais.</p></div></header>
      <div className="tabs">
        <button className={tab === 'reports' ? 'on' : ''} onClick={() => setTab('reports')}>Signalements <b>{grouped.length}</b></button>
        <button className={tab === 'recent' ? 'on' : ''} onClick={() => setTab('recent')}>Derniers commentaires <b>{comments.length}</b></button>
        <button className={tab === 'banned' ? 'on' : ''} onClick={() => setTab('banned')}>Sanctions <b>{banned.length}</b></button>
      </div>
      {tab === 'reports' ? (
        grouped.length ? grouped.map((rs) => {
          const c = rs[0].comment;
          return (
            <article key={rs[0].comment_id} className="card">
              <div className="body">
                <div className="line"><span className="pill rejected">{rs.length} signalement{rs.length > 1 ? 's' : ''}</span><span className="muted small">{rs.map((r) => r.reason).filter(Boolean).join(' · ')}</span></div>
                <h3>« {c?.text ?? 'Commentaire supprimé'} »</h3>
                <p className="muted small">{c?.pseudo ?? 'anonyme'} · sur « {c?.article_title ?? '…'} » · {ago(c?.created_at ?? null)}</p>
              </div>
              <div className="btns">
                <button className="btn primary sm" onClick={async () => { await api.resolveReport(rs[0], true); load(); say('Commentaire masqué'); }}>Masquer</button>
                <button className="btn sm" onClick={async () => { await api.resolveReport(rs[0], false); load(); say('Signalement classé'); }}>Laisser</button>
                <button className="btn ghost sm" onClick={() => suspend(c)}>Suspendre 7 j</button>
                <button className="btn ghost sm" onClick={() => ban(c)}>Bannir l'auteur</button>
              </div>
            </article>
          );
        }) : <p className="muted empty">Aucun signalement en attente.</p>
      ) : tab === 'banned' ? (
        <>
          {autoSuspend !== null ? (
            <p className="muted small">Suspension automatique : après{' '}
              <select value={autoSuspend} onChange={(e) => { const v = e.target.value; act(() => api.setSetting('AUTO_SUSPEND', v).then(() => setAutoSuspend(v)), 'Réglage enregistré'); }} aria-label="Seuil de suspension automatique">
                {['2', '3', '5', '10'].map((n) => <option key={n} value={n}>{n}</option>)}<option value="0">jamais</option>
              </select>{' '}commentaires masqués en 30 jours, le lecteur est suspendu 7 jours.</p>
          ) : null}
          {banned.length ? banned.map((p) => (
            <article key={p.id} className="card">
              <div className="body">
                <div className="line">{p.banned ? <span className="pill rejected">Banni</span> : <span className="pill ready">Suspendu jusqu'au {until(p.suspended_until!)}</span>}</div>
                <h3>{p.pseudo ?? 'Lecteur sans pseudo'}</h3><p className="muted small">{p.ban_reason ? `Motif : ${p.ban_reason} · ` : ''}compte créé {ago(p.created_at)}</p>
              </div>
              <div className="btns">{p.banned
                ? <button className="btn sm" onClick={() => act(() => api.setBanned(p.id, false), 'Bannissement levé')}>Lever le bannissement</button>
                : <button className="btn sm" onClick={() => act(() => api.suspend(p.id, 0), 'Suspension levée')}>Lever la suspension</button>}</div>
            </article>
          )) : <p className="muted empty">Personne n'est suspendu ni banni.</p>}
        </>
      ) : (
        comments.map((c) => (
          <article key={c.id} className={`card ${c.status === 'hidden' ? 'rejected' : ''}`}>
            <div className="body">
              <h3>« {c.text} »</h3>
              <p className="muted small">{c.pseudo ?? 'anonyme'} · sur « {c.article_title ?? '…'} » · {ago(c.created_at)}{c.status === 'hidden' ? ' · masqué' : ''}</p>
            </div>
            <div className="btns">
              <button className="btn sm" onClick={async () => { await api.setComment(c.id, c.status === 'hidden' ? 'visible' : 'hidden'); load(); say(c.status === 'hidden' ? 'Commentaire rétabli' : 'Commentaire masqué'); }}>{c.status === 'hidden' ? 'Rétablir' : 'Masquer'}</button>
              <button className="btn ghost sm" onClick={() => suspend(c)}>Suspendre 7 j</button>
              <button className="btn ghost sm" onClick={() => ban(c)}>Bannir l'auteur</button>
            </div>
          </article>
        ))
      )}
    </>
  );
}

/* ---------------- Lecteurs (admins) ---------------- */
const FILTERS: [ReaderFilter, string][] = [['all', 'Tous'], ['reported', 'Signalés'], ['suspended', 'Suspendus'], ['banned', 'Bannis'], ['team', 'Équipe'], ['premium', 'Premium']];
function ReadersPage({ say }: { say: (m: string) => void }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ReaderFilter>('all');
  const [page, setPage] = useState(0);
  const [list, setList] = useState<Reader[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(() => api.readers(search.trim(), filter, page).then(setList).catch((e) => { setList([]); say(e instanceof Error ? e.message : 'Lecture impossible'); }), [search, filter, page, say]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  const act = async (f: () => Promise<unknown>, msg: string) => {
    try { await f(); await load(); say(msg); } catch (e) { say(e instanceof Error ? e.message : 'Action impossible'); }
  };
  const total = list?.[0]?.total ?? 0;
  const now = new Date().toISOString();
  return (
    <>
      <header className="head"><div><div className="eyebrow">Lecteurs</div><h1>Tous les comptes</h1><p className="muted">Cliquez sur un compte pour voir sa fiche : commentaires, historique des sanctions, export de ses données. Supprimer un compte efface aussi ses commentaires et ses likes, sans retour possible (droit à l'effacement).</p></div></header>
      <input className="search" placeholder="Chercher un pseudo ou une adresse e-mail" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} aria-label="Chercher un lecteur" />
      <div className="tabs">{FILTERS.map(([k, label]) => <button key={k} className={filter === k ? 'on' : ''} onClick={() => { setFilter(k); setPage(0); }}>{label}{filter === k && list ? <b>{total}</b> : null}</button>)}</div>
      {!list ? <p className="muted">Chargement…</p> : !list.length ? <p className="muted empty">Aucun compte.</p> : (
        <table className="table">
          <thead><tr><th>Lecteur</th><th>Inscrit</th><th>Vu</th><th>Commentaires</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {list.map((p) => (
              <Fragment key={p.id}>
                <tr onClick={() => setOpen(open === p.id ? null : p.id)} style={{ cursor: 'pointer' }}>
                  <td><b>{p.pseudo ?? '—'}</b><div className="muted small">{p.email}</div></td>
                  <td className="muted">{ago(p.created_at)}</td>
                  <td className="muted">{p.last_seen ? dateLabel(p.last_seen) : 'jamais'}</td>
                  <td>{p.comments}{p.hidden ? <span className="muted small"> · {p.hidden} masqué{p.hidden > 1 ? 's' : ''}</span> : null}{p.reports ? <span className="warn small"> · {p.reports} signalement{p.reports > 1 ? 's' : ''}</span> : null}</td>
                  <td>{p.banned ? <span className="pill rejected">Banni</span> : (p.suspended_until ?? '') > now ? <span className="pill ready">Suspendu</span> : p.role !== 'reader' ? <span className="pill published">{ROLE[p.role]}</span> : p.premium ? <span className="pill published">Premium</span> : <span className="muted small">Lecteur</span>}</td>
                  <td className="muted small">{open === p.id ? 'Fermer' : 'Fiche'}</td>
                </tr>
                {open === p.id ? <tr><td colSpan={6}><ReaderSheet p={p} act={act} /></td></tr> : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
      {total > 50 ? (
        <div className="btns">
          <button className="btn sm" disabled={!page} onClick={() => setPage(page - 1)}>Précédents</button>
          <span className="muted small">{page * 50 + 1}–{Math.min(total, page * 50 + 50)} sur {total}</span>
          <button className="btn sm" disabled={(page + 1) * 50 >= total} onClick={() => setPage(page + 1)}>Suivants</button>
        </div>
      ) : null}
    </>
  );
}

function ReaderSheet({ p, act }: { p: Reader; act: (f: () => Promise<unknown>, msg: string) => Promise<void> }) {
  const [d, setD] = useState<ReaderDetail | null>(null);
  const refresh = useCallback(() => api.readerDetail(p.id).then(setD).catch(() => setD(null)), [p.id]);
  useEffect(() => { refresh(); }, [refresh, p]);
  const run = (f: () => Promise<unknown>, msg: string) => act(f, msg).then(refresh);
  const ask = (q: string) => prompt(`${q}\nMotif (facultatif) :`, '');
  const suspended = !p.banned && (p.suspended_until ?? '') > new Date().toISOString();
  const download = async () => {
    const data = await api.exportReader(p.id);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `donnees-${p.pseudo ?? p.id}.json`;
    a.click();
  };
  return (
    <div className="body">
      {p.banned || suspended ? <p className="warn small">{p.banned ? 'Banni' : `Suspendu jusqu'au ${until(p.suspended_until!)}`}{p.ban_reason ? ` · motif : ${p.ban_reason}` : ''}</p> : null}
      {d ? <p className="muted small">{d.days_30} jour{d.days_30 > 1 ? 's' : ''} d'ouverture sur 30 · {d.likes} like{d.likes > 1 ? 's' : ''} donnés · {d.reports_made} signalement{d.reports_made > 1 ? 's' : ''} faits · bloqué par {d.blocked_by} lecteur{d.blocked_by > 1 ? 's' : ''}</p> : <p className="muted small">Chargement…</p>}
      <ReaderTaste uid={p.id} />
      <ReaderSubscription id={p.id} />
      <div className="btns">
        {p.role === 'reader' && !p.banned ? <>
          {suspended ? <button className="btn sm" onClick={() => run(() => api.suspend(p.id, 0), 'Suspension levée')}>Lever la suspension</button>
            : [1, 7, 30].map((n) => <button key={n} className="btn sm" onClick={() => { const r = ask(`Suspendre ${p.pseudo ?? 'ce lecteur'} ${n} jour${n > 1 ? 's' : ''} ?`); if (r !== null) run(() => api.suspend(p.id, n, r), `Suspendu ${n} j`); }}>Suspendre {n} j</button>)}
          <button className="btn sm" onClick={() => { const r = ask(`Bannir ${p.pseudo ?? 'ce lecteur'} ? Ses commentaires disparaissent.`); if (r !== null) run(() => api.setBanned(p.id, true, r), 'Lecteur banni'); }}>Bannir</button>
        </> : null}
        {p.banned ? <button className="btn sm" onClick={() => run(() => api.setBanned(p.id, false), 'Bannissement levé')}>Débannir</button> : null}
        {p.pseudo ? <button className="btn ghost sm" onClick={() => confirm(`Remplacer le pseudo « ${p.pseudo} » par un pseudo neutre ?`) && run(() => api.resetPseudo(p.id), 'Pseudo réinitialisé')}>Réinitialiser le pseudo</button> : null}
        <button className="btn ghost sm" onClick={() => run(download, 'Données exportées')}>Exporter ses données</button>
        {p.role !== 'admin' ? <button className="btn ghost sm" onClick={() => confirm(`Supprimer définitivement le compte ${p.pseudo ?? p.email} et tout ce qu'il a écrit ?`) && act(() => api.deleteUser(p.id), 'Compte supprimé')}>Supprimer</button> : null}
      </div>
      {d?.history.length ? <><h4>Historique</h4>{d.history.map((h, i) => <p key={i} className="muted small">{until(h.at)} · {h.action}{h.detail ? ` (${h.detail})` : ''}</p>)}</> : null}
      {d?.comments.length ? <><h4>Commentaires</h4>{d.comments.map((c) => (
        <p key={c.id} className="small">
          <span className={c.status === 'hidden' ? 'muted' : ''}>« {c.text} »</span>{' '}
          <span className="muted">sur « {c.article} » · {ago(c.created_at)}{c.reports ? ` · ${c.reports} signalement${c.reports > 1 ? 's' : ''}` : ''}{c.status === 'hidden' ? ' · masqué' : ''}</span>{' '}
          <button className="btn ghost sm" onClick={() => run(() => api.setComment(c.id, c.status === 'hidden' ? 'visible' : 'hidden'), c.status === 'hidden' ? 'Commentaire rétabli' : 'Commentaire masqué')}>{c.status === 'hidden' ? 'Rétablir' : 'Masquer'}</button>
        </p>
      ))}</> : null}
    </div>
  );
}

/* ---------------- Journal (admins) ---------------- */
function AuditPage() {
  const [list, setList] = useState<AuditEntry[] | null>(null);
  const [who, setWho] = useState<'all' | 'ia' | 'team'>('all');
  useEffect(() => { api.audit().then(setList).catch(() => setList([])); }, []);
  const when = (iso: string) => new Date(iso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const shown = (list ?? []).filter((e) => who === 'all' || (who === 'ia') === (e.who === 'IA / moteur'));
  return (
    <>
      <header className="head"><div><div className="eyebrow">Journal</div><h1>Qui a fait quoi</h1><p className="muted">Chaque décision importante de l'IA et de l'équipe : publications, commentaires masqués ou rétablis, bannissements, changements de rôle et de réglages.</p></div></header>
      <div className="tabs">
        {([['all', 'Tout'], ['ia', 'IA'], ['team', 'Équipe']] as const).map(([k, l]) => <button key={k} className={who === k ? 'on' : ''} onClick={() => setWho(k)}>{l}</button>)}
      </div>
      {!list ? <p className="muted">Chargement…</p> : !shown.length ? <p className="muted empty">Rien pour l'instant.</p> : (
        <table className="table">
          <thead><tr><th>Quand</th><th>Qui</th><th>Quoi</th></tr></thead>
          <tbody>{shown.map((e, i) => (
            <tr key={i}>
              <td className="muted small">{when(e.at)}</td>
              <td>{e.who}</td>
              <td><b>{e.action}</b>{e.target ? ` : ${e.target}` : ''}{e.detail ? <div className="muted small">{e.detail}</div> : null}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </>
  );
}

/* ---------------- Équipe (admins) ---------------- */
const ROLE: Record<Role, string> = { reader: 'Lecteur', moderator: 'Modération', editor: 'Rédaction', admin: 'Administrateur' };
function TeamPage({ say, me }: { say: (m: string) => void; me: Me }) {
  const [list, setList] = useState<Profile[]>([]);
  const [pseudo, setPseudo] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const load = () => api.team().then(setList);
  useEffect(() => { load(); }, []);
  const admins = list.filter((p) => p.role === 'admin');
  return (
    <>
      <header className="head"><div><div className="eyebrow">Équipe</div><h1>Qui a accès</h1><p className="muted">Modération : les commentaires seulement (masquer, bannir). Rédaction : les infos, la Dernière minute, les sources et la modération. Administrateur : tout, y compris l'équipe et les réglages.</p>
        {admins.length ? <p className="muted">Administrateur{admins.length > 1 ? 's' : ''} : {admins.map((p, i) => <Fragment key={p.id}>{i ? ', ' : ''}<b>{p.email || p.pseudo}</b></Fragment>)}</p> : null}</div></header>
      <table className="table">
        <thead><tr><th>Pseudo</th><th>Adresse e-mail</th><th>Rôle</th><th>Depuis</th></tr></thead>
        <tbody>
          {list.map((p) => (
            <tr key={p.id}>
              <td><b>{p.pseudo ?? '—'}</b></td>
              <td className="muted">{p.email ?? '—'}</td>
              <td>
                <select value={p.role} disabled={p.id === me.id} onChange={async (e) => { await api.setRole(p.id, e.target.value as Role); load(); say('Rôle mis à jour'); }}>
                  {(Object.keys(ROLE) as Role[]).map((r) => <option key={r} value={r}>{r === 'reader' ? 'Retirer l’accès' : ROLE[r]}</option>)}
                </select>
              </td>
              <td className="muted">{ago(p.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <form className="panel addform" onSubmit={async (e) => {
        e.preventDefault();
        const p = await api.findProfile(pseudo.trim());
        if (!p) return say('Aucun compte trouvé. La personne crée d’abord son compte (dans l’app, ou « Créer un compte » sur la page de connexion du back office).');
        await api.setRole(p.id, role);
        setPseudo('');
        load();
        say(`${p.pseudo} rejoint l'équipe (${ROLE[role]})`);
      }}>
        <h2>Ajouter à l'équipe</h2>
        <div className="row3">
          <label>Pseudo ou adresse e-mail du compte<input value={pseudo} onChange={(e) => setPseudo(e.target.value)} required /></label>
          <label>Rôle<select value={role} onChange={(e) => setRole(e.target.value as Role)}>{(['moderator', 'editor', 'admin'] as Role[]).map((r) => <option key={r} value={r}>{ROLE[r]}</option>)}</select></label>
        </div>
        <button className="btn primary">Ajouter</button>
      </form>
    </>
  );
}


