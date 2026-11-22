import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { api, ENGINE_URL, type AuditEntry, type Dashboard, type Reader, type TopArticle, FLASH_URL, PHOTO_TAGS, RUBRICS, type Article, type Comment, type Edition, type Fact, type EngineRun, type Flash, type Setting, type Me, type Profile, type Report, type Role, type Source, type Status } from './data';

type Page = 'dashboard' | 'readers' | 'audit' | 'edition' | 'flash' | 'engine' | 'sources' | 'moderation' | 'team' | 'settings';
const PAGES: [Page, string][] = [['dashboard', 'Tableau de bord'], ['edition', 'Édition'], ['flash', 'Dernière minute'], ['engine', 'Moteur'], ['sources', 'Sources'], ['moderation', 'Modération'], ['readers', 'Lecteurs'], ['team', 'Équipe'], ['audit', 'Journal'], ['settings', 'Réglages']];
const LIMITS = { title: 60, key: 140, fact: 90, summary: 280 };
const SUMMARY_HEADS = ['Contexte', 'Ce qui change', 'Et après'];

const dateLabel = (d: string) => new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(d + 'T12:00:00'));
const ago = (iso: string | null) => {
  if (!iso) return 'jamais';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : `il y a ${Math.round(m / 1440)} j`;
};
// Modération : seulement les commentaires. Rédaction : tout sauf les lecteurs, l'équipe, le journal et les réglages.
const ADMIN_ONLY: Page[] = ['readers', 'team', 'audit', 'settings'];
const allowed = (role: Role, p: Page) => role === 'admin' || (role === 'editor' ? !ADMIN_ONLY.includes(p) : p === 'moderation');
const plain = (s: string) => s.replace(/<\/?b>/g, '');

export default function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [page, setPage] = useState<Page>(() => (location.hash.slice(1) as Page) || 'dashboard');
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { api.me().then(setMe); }, []);
  useEffect(() => { location.hash = page; }, [page]);
  const say = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(null), 2400); }, []);

  if (me === undefined) return <div className="center muted">Chargement…</div>;
  if (!me) return <Login onIn={() => api.me().then(setMe)} />;
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
        <div className="logo"><Glyph /> TITRE <span>back office</span></div>
        <nav>
          {PAGES.filter(([p]) => allowed(me.role, p)).map(([p, l]) => (
            <button key={p} className={page === p ? 'on' : ''} onClick={() => setPage(p)}>{l}</button>
          ))}
        </nav>
        <div className="who">
          {api.demo ? <div className="demo">Mode démo : données fictives</div> : null}
          <div className="muted small">{me.email}</div>
          <button className="link" onClick={() => api.signOut().then(() => setMe(null))}>Se déconnecter</button>
        </div>
      </aside>
      <main className="main">
        {!allowed(me.role, page) ? <ModerationPage say={say} /> : null}
        {page === 'dashboard' && allowed(me.role, page) && <DashboardPage go={setPage} />}
        {page === 'edition' && allowed(me.role, page) && <EditionPage say={say} />}
        {page === 'flash' && allowed(me.role, page) && <FlashPage say={say} />}
        {page === 'engine' && allowed(me.role, page) && <EnginePage />}
        {page === 'sources' && allowed(me.role, page) && <SourcesPage say={say} />}
        {page === 'moderation' && <ModerationPage say={say} />}
        {page === 'readers' && allowed(me.role, page) && <ReadersPage say={say} />}
        {page === 'audit' && allowed(me.role, page) && <AuditPage />}
        {page === 'team' && allowed(me.role, page) && <TeamPage say={say} me={me} />}
        {page === 'settings' && allowed(me.role, page) && <SettingsPage say={say} />}
      </main>
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
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
function Login({ onIn }: { onIn: () => void }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [first, setFirst] = useState(false); // installation : aucun administrateur encore
  const [sent, setSent] = useState(false);
  useEffect(() => { api.needsAdmin().then(setFirst).catch(() => {}); }, []);
  const submit = async () => {
    setBusy(true);
    const m = first ? await api.signUp(email, pw) : await api.signIn(email, pw);
    setBusy(false);
    if (m === 'confirm') return setSent(true);
    m ? setErr(m) : onIn();
  };
  if (sent) return (
    <div className="center"><div className="panel narrow">
      <div className="logo big"><Glyph /> TITRE</div>
      <h1>Vérifiez votre boîte mail</h1>
      <p className="muted">Supabase vous a envoyé un lien de confirmation à {email}. Cliquez dessus, puis revenez ici pour vous connecter.</p>
      <button className="btn primary" onClick={() => { setSent(false); setFirst(false); }}>J'ai confirmé, me connecter</button>
    </div></div>
  );
  return (
    <div className="center">
      <form className="panel narrow" onSubmit={async (e) => { e.preventDefault(); await submit(); }}>
        <div className="logo big"><Glyph /> TITRE</div>
        <h1>{first ? 'Bienvenue' : 'Back office'}</h1>
        {first ? <p className="muted">La base est installée. Créez le compte administrateur : c'est le premier compte, il aura tous les droits.</p> : null}
        {api.demo ? <p className="demo">Mode démo : aucune base n'est branchée. Cliquez sur « Se connecter » pour essayer avec des données fictives.</p> : null}
        <label>Adresse e-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required={!api.demo} autoComplete="username" /></label>
        <label>Mot de passe<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required={!api.demo} autoComplete="current-password" /></label>
        {err ? <p className="error">{err}</p> : null}
        <button className="btn primary" disabled={busy}>{busy ? 'Un instant…' : first ? 'Créer le compte administrateur' : 'Se connecter'}</button>
      </form>
    </div>
  );
}

/* ---------------- Édition du jour ---------------- */
type Filter = 'all' | 'review' | 'draft' | 'published' | 'rejected';
/* ---------------- Tableau de bord ---------------- */
const usd = (n: number) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
const int = (n: number) => n.toLocaleString('fr-FR');
// Un passage en panne, bloqué, ou trop ancien (édition : 1 par jour ; Dernière minute : toutes les 10 min de 6 h à 23 h).
function engineAlert(r: Dashboard['last_runs'][number] | undefined, kind: 'edition' | 'flash'): string | null {
  if (!r) return 'Aucun passage enregistré pour l’instant.';
  const h = (Date.now() - new Date(r.started_at).getTime()) / 3600e3;
  if (r.status === 'error') return `Le dernier passage a planté : ${r.summary ?? 'voir la page Moteur'}`;
  if (r.status === 'running' && h > 0.75) return 'Le passage semble bloqué depuis plus de 45 minutes.';
  const parisHour = Number(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric' }).format(new Date()));
  if (kind === 'edition' && h > 26) return `Aucune édition depuis ${Math.round(h)} heures.`;
  if (kind === 'flash' && h > 2 && parisHour >= 7 && parisHour < 23) return `Aucun passage depuis ${Math.round(h)} heures.`;
  return null;
}
function DashboardPage({ go }: { go: (p: Page) => void }) {
  const [d, setD] = useState<Dashboard | null>(null);
  const [top, setTop] = useState<TopArticle[]>([]);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const load = () => Promise.all([api.dashboard().then(setD), api.topArticles().then(setTop)]).catch((e) => setErr(e instanceof Error ? e.message : String(e)));
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
          <button key={k} className={`status-bar ${alert ? 'off' : ''}`} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }} onClick={() => go('engine')}>
            <b>{k === 'edition' ? 'Édition du matin' : 'Dernière minute'} : {alert ? 'problème' : 'tout va bien'}</b>
            <span className="muted small">{alert ?? `Dernier passage ${ago(r!.started_at)} : ${r!.summary ?? 'en cours'}`}</span>
          </button>
        );
      })}
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
        <Tile label="Revenus Premium" value="—" sub={`${int(d.premium)} abonné${d.premium > 1 ? 's' : ''} · s'affichera quand Premium sera branché`} />
        <Tile label="Revenus publicité" value="—" sub="S'affichera quand la publicité sera branchée" />
      </div>
    </>
  );
}

const STATUS_LABEL: Record<Status, string> = { draft: 'Brouillon', published: 'Publiée', rejected: 'Rejetée' };

function EditionPage({ say }: { say: (m: string) => void }) {
  const [eds, setEds] = useState<Edition[]>([]);
  const [date, setDate] = useState<string | null>(null);
  const [list, setList] = useState<Article[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [edit, setEdit] = useState<Article | null>(null);
  const [steps, setSteps] = useState<string[] | null>(null);
  const today = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const blank = (): Article => ({
    id: '', edition_date: date ?? today, rubric_id: 'france', status: 'draft', rank: 0, importance: 5, essential: false, title: '', key_sentence: '',
    facts: [0, 1, 2].map(() => ({ text: '', source: '', url: '' })), summary: ['', '', ''], photo_tag: null, photo_url: null, review_notes: [], model: null, published_at: null, created_at: '',
  });
  const runEngine = async () => {
    if (!api.runEngine) return void window.open(ENGINE_URL, '_blank', 'noopener');
    setSteps([]);
    await api.runEngine((s) => setSteps((l) => [...(l ?? []), s]));
    await reload(today);
  };
  const reload = useCallback(async (d = date) => {
    const e = await api.editions();
    setEds(e);
    const dd = d ?? e[0]?.date ?? null;
    setDate(dd);
    setList(dd ? await api.articles(dd) : []);
  }, [date]);
  useEffect(() => { reload(); }, []);

  const ed = eds.find((e) => e.date === date);
  const count = (f: (a: Article) => boolean) => list.filter(f).length;
  const isReview = (a: Article) => a.status === 'draft' && a.review_notes.length > 0;
  const shown = list.filter((a) => filter === 'all' || (filter === 'review' ? isReview(a) : a.status === filter));
  const byRub = Object.keys(RUBRICS).map((r) => [r, shown.filter((a) => a.rubric_id === r).sort((x, y) => x.rank - y.rank)] as const).filter(([, l]) => l.length);

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
    const ok = list.filter((a) => a.status === 'draft' && !a.review_notes.length);
    if (!ok.length) return say('Aucune carte sans alerte à publier');
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
          <div className="eyebrow">Édition</div>
          <h1>{date ? dateLabel(date) : 'Aucune édition'}</h1>
          {ed ? (
            <div className="meta">
              <span className={`pill ${ed.status}`}>{ed.status === 'published' ? 'En ligne' : ed.status === 'ready' ? 'Prête, en attente' : 'En préparation'}</span>
              {ed.stats.fetched != null ? <span className="muted">{String(ed.stats.fetched)} titres lus · {String(ed.stats.stories ?? 0)} sujets retenus{ed.stats.fixed ? ` · ${String(ed.stats.fixed)} corrigées par l’IA` : ''} · modèle {String(ed.stats.model ?? '—')}</span> : null}
            </div>
          ) : null}
        </div>
        <div className="actions">
          <select value={date ?? ''} onChange={(e) => reload(e.target.value)} aria-label="Choisir une édition">
            {eds.map((e) => <option key={e.date} value={e.date}>{dateLabel(e.date)}</option>)}
          </select>
          <button className="btn" onClick={() => setEdit(blank())}>Nouvel article</button>
          <button className="btn" onClick={runEngine} title={api.runEngine ? 'Simulation du moteur (mode démo)' : 'Ouvre GitHub : bouton « Run workflow »'}>Lancer le moteur{api.runEngine ? '' : ' ↗'}</button>
          <button className="btn" onClick={publishClean}>Publier les cartes sans alerte</button>
          <button className={`btn ${ed?.status === 'published' ? '' : 'primary'}`} onClick={toggleEdition}>{ed?.status === 'published' ? 'Retirer l’édition' : 'Mettre l’édition en ligne'}</button>
        </div>
      </header>

      {steps ? (
        <div className="panel engine">
          <div className="engine-head"><b>Moteur</b><button className="btn ghost sm" onClick={() => setSteps(null)}>Fermer</button></div>
          <ol>{steps.map((s, i) => <li key={i} className={i === steps.length - 1 && !s.startsWith('Terminé') && !s.startsWith('Rien') ? 'running' : 'done'}>{s}</li>)}</ol>
        </div>
      ) : null}

      <div className="tabs">
        {([['all', 'Toutes', list.length], ['review', 'À relire', count(isReview)], ['draft', 'Brouillons', count((a) => a.status === 'draft')], ['published', 'Publiées', count((a) => a.status === 'published')], ['rejected', 'Rejetées', count((a) => a.status === 'rejected')]] as [Filter, string, number][]).map(([f, l, n]) => (
          <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{l} <b>{n}</b></button>
        ))}
      </div>

      {!byRub.length ? <p className="muted empty">Rien ici pour l'instant.</p> : null}
      {byRub.map(([r, l]) => (
        <section key={r} className="rub">
          <h2>{RUBRICS[r]} <span className="muted">{l.length}</span></h2>
          {l.map((a, k) => (
            <article key={a.id} className={`card ${a.status}`}>
              <div className="order">
                <button className="ic" onClick={() => move(a, -1)} disabled={k === 0} aria-label="Monter">↑</button>
                <button className="ic" onClick={() => move(a, 1)} disabled={k === l.length - 1} aria-label="Descendre">↓</button>
              </div>
              <div className="body" onClick={() => setEdit(a)}>
                <div className="line">
                  <span className={`pill ${a.status}`}>{STATUS_LABEL[a.status]}</span>
                  {a.essential ? <span className="pill ess">Essentiel</span> : null}
                  <span className="muted small">importance {a.importance}/10</span>
                </div>
                <h3>{a.title}</h3>
                <p className="muted">{a.key_sentence}</p>
                {a.review_notes.length ? <p className="warn">⚠ {a.review_notes.join(' · ')}</p> : null}
              </div>
              <div className="btns">
                {a.status !== 'published' ? <button className="btn primary sm" onClick={() => publish(a)}>Publier</button> : <button className="btn sm" onClick={() => save(a, { status: 'draft', published_at: null }, 'Carte dépubliée')}>Dépublier</button>}
                <button className="btn sm" onClick={() => setEdit(a)}>Modifier</button>
                {a.status !== 'rejected' ? <button className="btn ghost sm" onClick={() => save(a, { status: 'rejected' }, 'Carte rejetée')}>Rejeter</button> : null}
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
  const patch = (): Partial<Article> => ({ title: d.title, key_sentence: d.key_sentence, facts: d.facts, summary: d.summary, rubric_id: d.rubric_id, essential: d.essential, importance: d.importance, photo_tag: d.photo_tag, photo_url: d.photo_url || null, photo_credit: d.photo_url ? d.photo_credit || null : null });
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
            {over ? <p className="warn">Un texte dépasse la longueur conseillée.</p> : null}
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
function SettingsPage({ say }: { say: (m: string) => void }) {
  const [list, setList] = useState<Setting[] | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const load = () => api.settings().then(setList).catch((e) => { setList([]); say(e instanceof Error ? e.message : 'Lecture impossible'); });
  useEffect(() => { load(); }, []);
  const get = (k: string) => list?.find((s) => s.key === k)?.value ?? '';
  const save = async (k: string, v: string, msg = 'Réglage enregistré') => {
    try { await api.setSetting(k, v); setDraft((d) => { const n = { ...d }; delete n[k]; return n; }); await load(); say(msg); }
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
      <label className="setting toggle">
        <div><b>{label}</b><p className="muted small">{help}</p></div>
        <input type="checkbox" checked={on} onChange={(e) => save(k, e.target.checked ? '1' : '0')} />
      </label>
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
  if (!list) return <p className="muted">Chargement…</p>;
  const paused = get('ENGINE_PAUSED') === '1';
  const auto = get('AUTO_PUBLISH') ? get('AUTO_PUBLISH') === '1' : true;
  return (
    <>
      <header className="head">
        <div>
          <div className="eyebrow">Réglages</div>
          <h1>Pilotage de l'IA</h1>
          <p className="muted">Tout se règle ici. Le moteur relit ces réglages à chaque passage, et la page Moteur montre ceux qui ont servi. Les clés sont gardées dans la base et ne sont plus jamais affichées en entier.</p>
        </div>
      </header>
      <div className={`status-bar ${paused ? 'off' : ''}`}>
        <b>{paused ? 'Moteur en pause' : auto ? 'Pilote automatique : l’IA publie seule' : 'Relecture : l’IA prépare, vous publiez'}</b>
        <span className="muted small">{paused ? 'Ni édition ni Dernière minute tant que la pause est active.' : 'Édition chaque matin à 5 h 30, Dernière minute toutes les 10 minutes de 6 h à 23 h.'}</span>
      </div>

      <section className="panel settings">
        <h2>Pilotage</h2>
        {Toggle({ k: 'ENGINE_PAUSED', label: 'Mettre le moteur en pause', help: "Arrêt d'urgence : plus aucune édition ni Dernière minute. Ce qui est déjà en ligne reste visible.", def: false })}
        {Toggle({ k: 'AUTO_PUBLISH', label: 'Pilote automatique', help: "L'IA publie l'édition seule chaque matin. Coupé : les cartes arrivent en brouillon et vous les publiez dans Édition.", def: true })}
      </section>

      <section className="panel settings">
        <h2>Comportement de l'IA</h2>
        {Pick({ k: 'TITRE_MODEL', label: 'Modèle Claude', help: 'Opus écrit le mieux ; Sonnet et Haiku coûtent nettement moins cher.', def: 'claude-opus-5-5', options: MODELS })}
        {Pick({ k: 'TITRE_EFFORT', label: 'Niveau de réflexion', help: "Plus de réflexion = sujets mieux choisis et cartes plus soignées, mais plus lent et plus cher.", def: 'medium', options: [['low', 'Rapide'], ['medium', 'Équilibré'], ['high', 'Approfondi']] })}
        {Text({ k: 'AI_GUIDELINES', label: 'Consignes de la rédaction', help: "Votre ligne éditoriale, donnée à l'IA à chaque passage (choix des sujets, écriture, Dernière minute). Elle ne peut pas l'amener à inventer ou déformer un fait.", placeholder: "Exemples :\n- Ton direct, phrases courtes, pas de jargon.\n- Toujours expliquer l'impact concret pour un jeune actif.\n- Privilégier les sujets européens en Monde." })}
        {Text({ k: 'AI_AVOID', label: 'Sujets à écarter', help: "L'IA ne retiendra jamais ces sujets, ni dans l'édition ni en Dernière minute.", placeholder: "Exemples :\n- Faits divers sans portée nationale\n- Rumeurs de transferts au football\n- Vie privée des célébrités" })}
      </section>

      <section className="panel settings">
        <h2>Édition : choix des sujets</h2>
        {Pick({ k: 'PER_RUBRIC', label: 'Sujets par rubrique', help: 'Nombre maximum de sujets que l’IA retient dans chaque rubrique.', def: '8', options: nums([2, 3, 4, 5, 6, 8, 10, 12, 16, 20]) })}
        {Pick({ k: 'MAX_CARDS', label: "Cartes par édition, au total", help: 'Plafond de cartes écrites chaque matin, toutes rubriques confondues. Au-delà, les sujets les moins importants sont écartés.', def: '40', options: nums([8, 12, 16, 24, 32, 40, 50, 60, 80, 120]) })}
        {Pick({ k: 'MAX_ESSENTIAL', label: 'Sujets « essentiels »', help: 'Les sujets que tout le monde voit en tête de « Mon édition », quelles que soient ses rubriques.', def: '4', options: nums(range(0, 10)) })}
        {Pick({ k: 'MIN_IMPORTANCE', label: 'Importance minimum', help: "L'IA note chaque sujet de 1 (anecdotique) à 10 (majeur). En dessous de ce seuil, le sujet est écarté.", def: '1', options: [['1', '1 (tout garder)'], ...nums(range(2, 8)).map(([v, l]) => [v, `${l} sur 10`] as [string, string])] })}
        {Pick({ k: 'MIN_SOURCES', label: 'Médias minimum par sujet', help: 'Nombre de médias différents qui doivent parler du sujet pour qu’il soit retenu. 2 ou plus = moins de sujets, mais tous recoupés.', def: '1', options: nums([1, 2, 3, 4]) })}
        {Pick({ k: 'WINDOW_HOURS', label: 'Période couverte', help: "Les dépêches publiées dans les dernières heures avant l'édition.", def: '30', options: nums([12, 18, 24, 30, 36, 48], ' h') })}
      </section>

      <section className="panel settings">
        <h2>Édition : écriture et publication</h2>
        {Toggle({ k: 'AUTO_FIX', label: 'Autocorrection', help: "Une carte qui échoue aux contrôles (trop longue, source manquante, phrase reprise d'un média) est réécrite une fois par l'IA.", def: true })}
        {Toggle({ k: 'PUBLISH_FLAGGED', label: 'Publier aussi les cartes avec alerte', help: "Déconseillé. Coupé, une carte encore en défaut attend dans « À relire ».", def: false })}
        {Pick({ k: 'PUBLISH_MIN_IMPORTANCE', label: 'Publication automatique à partir de', help: 'Avec le pilote automatique, seules les cartes au moins aussi importantes sont publiées ; les autres attendent en brouillon.', def: '1', options: [['1', 'Toutes les cartes'], ...nums(range(3, 9)).map(([v, l]) => [v, `Importance ${l} et plus`] as [string, string])] })}
      </section>

      <section className="panel settings">
        <h2>Dernière minute</h2>
        {Toggle({ k: 'FLASH_ENABLED', label: 'Activée', help: 'Le moteur cherche les infos majeures toutes les 10 minutes, de 6 h à 23 h.', def: true })}
        {Toggle({ k: 'FLASH_AUTO_PUBLISH', label: 'Publier sans relecture', help: 'Sinon, les infos arrivent masquées et vous les mettez en ligne depuis la page Dernière minute.', def: true })}
        {Pick({ k: 'FLASH_MIN_IMPORTANCE', label: 'Importance minimum', help: 'Seuil pour publier une info en Dernière minute (sur 10).', def: '8', options: nums(range(6, 10), ' sur 10') })}
        {Pick({ k: 'FLASH_MIN_SOURCES', label: 'Médias minimum', help: 'Nombre de médias différents qui doivent annoncer le fait.', def: '2', options: nums([1, 2, 3, 4]) })}
        {Pick({ k: 'FLASH_MAX_PER_DAY', label: 'Infos par jour, au plus', help: 'Au-delà, le moteur arrête de publier jusqu’au lendemain.', def: '12', options: nums([3, 5, 8, 12, 20, 30, 50]) })}
      </section>

      <section className="panel settings">
        <h2>Modération</h2>
        {Toggle({ k: 'AI_MODERATION', label: "L'IA tranche les signalements", help: "Toutes les 10 minutes, l'IA relit les commentaires signalés : elle masque ce qui enfreint les règles, garde le reste et laisse à l'équipe les cas douteux. Chaque décision est expliquée dans le Journal.", def: true })}
        {Text({ k: 'BANNED_WORDS', label: 'Mots interdits en plus', help: "Les insultes courantes sont déjà bloquées, même déguisées (c0nnard, connnnard). Ajoutez vos mots, séparés par des virgules : un commentaire ou un pseudo qui en contient un est refusé.", placeholder: 'mot1, mot2, une expression' })}
      </section>

      <section className="panel settings">
        <h2>Clés</h2>
        {Key({ k: "ANTHROPIC_API_KEY", label: "Clé Claude", help: "Pour choisir les sujets et écrire les cartes. Elle commence par sk-ant-.", link: ['https://console.anthropic.com/settings/keys', 'Créer une clé'] })}
        {Key({ k: "UNSPLASH_ACCESS_KEY", label: "Clé Unsplash (photos)", help: "Facultatif. Une vraie photo libre de droits par article, créditée à son auteur ; sans clé, les photos d'ambiance de l'app. Collez l'« Access Key ».", link: ['https://unsplash.com/oauth/applications/new', 'Créer une clé gratuite'] })}
        {Key({ k: "PEXELS_API_KEY", label: "Clé Pexels (ancienne)", help: "Seulement si vous en avez déjà une : Pexels ne délivre plus de nouvelles clés. Utilisée si Unsplash ne trouve rien.", link: ['https://www.pexels.com/api/', 'Pexels'] })}
      </section>
    </>
  );
}

/* ---------------- Moteur ---------------- */
function EnginePage() {
  const [runs, setRuns] = useState<EngineRun[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const load = () => api.runs().then((r) => { setRuns(r); setOpen((o) => o ?? r[0]?.id ?? null); }).catch(() => setRuns([]));
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);
  const when = (iso: string) => new Date(iso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  return (
    <>
      <header className="head">
        <div>
          <div className="eyebrow">Moteur</div>
          <h1>Ce que fait l'IA</h1>
          <p className="muted">Chaque passage du moteur, dans l'ordre : sources lues, sujets retenus et les titres qui les composent, cartes écrites, infos écartées et pourquoi. La page se met à jour toute seule.</p>
        </div>
        <div className="actions">
          <a className="btn" href={ENGINE_URL} target="_blank" rel="noreferrer">Lancer l'édition ↗</a>
          <a className="btn" href={FLASH_URL} target="_blank" rel="noreferrer">Lancer Dernière minute ↗</a>
        </div>
      </header>
      {runs && !runs.length ? <p className="muted">Aucun passage enregistré. Appliquez la migration <code>0004_engine_runs.sql</code> dans Supabase, puis lancez le moteur.</p> : null}
      <div className="runs">
        {(runs ?? []).map((r) => (
          <div key={r.id} className={`panel run ${r.status}`}>
            <button className="run-head" onClick={() => setOpen(open === r.id ? null : r.id)}>
              <span className={`pill ${r.status === 'ok' ? 'published' : r.status === 'error' ? 'rejected' : ''}`}>{r.kind === 'edition' ? 'Édition' : 'Dernière minute'}</span>
              <span className="muted small">{when(r.started_at)}</span>
              <span className="run-sum">{r.status === 'running' ? 'En cours…' : r.summary}</span>
              <span className="muted">{open === r.id ? '▾' : '▸'}</span>
            </button>
            {open === r.id ? <RunDetails r={r} /> : null}
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
  publication_auto: 'Publication sans relecture', max_par_jour: 'Infos par jour',
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
              <div><b>{s.label}</b> <span className="muted small">· {RUBRICS[s.rubric] ?? s.rubric} · importance {s.importance}/10{s.essential ? ' · essentiel' : ''}</span></div>
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
          <h3>Cartes écrites</h3>
          <ul>{d.cards.map((c, i) => <li key={i}>{c.error ? '✗' : c.issues.length ? '⚠' : '✓'} <span className="muted small">[{RUBRICS[c.rubric] ?? c.rubric}]</span> {c.title}{c.error ? <span className="warn"> : {c.error}</span> : c.issues.length ? <span className="warn"> : {c.issues.join(', ')}</span> : null}{c.photo ? <span className="muted small"> · photo : {c.photo}</span> : null}</li>)}</ul>
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
          <h3>Signalements tranchés par l'IA ({d.moderation.length})</h3>
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
              </div>
              <b>{f.title}</b>
              <p>{f.sentence}</p>
              <div className="muted small">{f.sources.map((s) => <a key={s.url} href={s.url} target="_blank" rel="noreferrer" style={{ marginRight: 12 }}>{s.source} ↗</a>)}</div>
            </div>
            <div className="flash-actions">
              <button className="btn sm" onClick={() => edit(f)}>Modifier</button>
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
  const load = () => api.sources().then(setList);
  useEffect(() => { load(); }, []);
  return (
    <>
      <header className="head">
        <div>
          <div className="eyebrow">Sources</div>
          <h1>Flux des médias</h1>
          <p className="muted">Le moteur lit chaque matin le titre et le chapô de ces flux RSS, jamais l'article complet. Vérifiez que chaque média autorise cet usage.</p>
        </div>
      </header>
      <table className="table">
        <thead><tr><th>Média</th><th>Rubrique</th><th>Dernière lecture</th><th>État</th><th /></tr></thead>
        <tbody>
          {list.map((s) => (
            <tr key={s.id} className={s.active ? '' : 'off'}>
              <td><b>{s.name}</b><div className="muted small url">{s.url}</div></td>
              <td>{s.rubric_hint ? RUBRICS[s.rubric_hint] : <span className="muted">Toutes</span>}</td>
              <td className="muted">{ago(s.last_fetch_at)}</td>
              <td>{s.last_error ? <span className="pill rejected" title={s.last_error}>Erreur : {s.last_error}</span> : s.last_fetch_at ? <span className="pill published">OK</span> : <span className="pill">Pas encore lue</span>}</td>
              <td><button className="btn sm" onClick={async () => { await api.saveSource({ id: s.id, active: !s.active }); load(); say(s.active ? 'Source désactivée' : 'Source activée'); }}>{s.active ? 'Désactiver' : 'Activer'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <form className="panel addform" onSubmit={async (e) => {
        e.preventDefault();
        if (!/^https?:\/\//.test(form.url)) return say('L’adresse doit commencer par https://');
        await api.saveSource({ name: form.name, url: form.url, rubric_hint: form.rubric_hint || null });
        setForm({ name: '', url: '', rubric_hint: '' });
        load();
        say('Source ajoutée, lue dès demain matin');
      }}>
        <h2>Ajouter une source</h2>
        <div className="row3">
          <label>Nom du média<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label>Adresse du flux RSS<input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…/rss.xml" required /></label>
          <label>Rubrique<select value={form.rubric_hint} onChange={(e) => setForm({ ...form, rubric_hint: e.target.value })}><option value="">Toutes</option>{Object.entries(RUBRICS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        </div>
        <button className="btn primary">Ajouter</button>
      </form>
    </>
  );
}

/* ---------------- Modération ---------------- */
function ModerationPage({ say }: { say: (m: string) => void }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [banned, setBanned] = useState<Profile[]>([]);
  const [tab, setTab] = useState<'reports' | 'recent' | 'banned'>('reports');
  const load = () => Promise.all([api.reports().then(setReports), api.comments().then(setComments), api.banned().then(setBanned)]);
  const ban = async (c?: Comment) => {
    if (!c || !confirm(`Bannir ${c.pseudo ?? 'ce lecteur'} ? Ses commentaires disparaissent de l'app et il ne pourra plus commenter ni signaler.`)) return;
    try { await api.setBanned(c.user_id, true); load(); say(`${c.pseudo ?? 'Lecteur'} banni`); }
    catch (e) { say(e instanceof Error ? e.message : 'Bannissement impossible'); }
  };
  useEffect(() => { load(); }, []);
  const grouped = useMemo(() => {
    const m = new Map<string, Report[]>();
    reports.forEach((r) => m.set(r.comment_id, [...(m.get(r.comment_id) ?? []), r]));
    return [...m.values()];
  }, [reports]);
  return (
    <>
      <header className="head"><div><div className="eyebrow">Modération</div><h1>Commentaires</h1><p className="muted">70 caractères maximum, signalables par les lecteurs. Les insultes sont refusées automatiquement (liste modifiable dans Réglages). Un commentaire masqué disparaît de l'app ; un lecteur banni ne peut plus commenter.</p></div></header>
      <div className="tabs">
        <button className={tab === 'reports' ? 'on' : ''} onClick={() => setTab('reports')}>Signalements <b>{grouped.length}</b></button>
        <button className={tab === 'recent' ? 'on' : ''} onClick={() => setTab('recent')}>Derniers commentaires <b>{comments.length}</b></button>
        <button className={tab === 'banned' ? 'on' : ''} onClick={() => setTab('banned')}>Bannis <b>{banned.length}</b></button>
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
                <button className="btn ghost sm" onClick={() => ban(c)}>Bannir l'auteur</button>
              </div>
            </article>
          );
        }) : <p className="muted empty">Aucun signalement en attente.</p>
      ) : tab === 'banned' ? (
        banned.length ? banned.map((p) => (
          <article key={p.id} className="card">
            <div className="body"><h3>{p.pseudo ?? 'Lecteur sans pseudo'}</h3><p className="muted small">compte créé {ago(p.created_at)}</p></div>
            <div className="btns"><button className="btn sm" onClick={async () => { await api.setBanned(p.id, false); load(); say('Bannissement levé'); }}>Lever le bannissement</button></div>
          </article>
        )) : <p className="muted empty">Personne n'est banni.</p>
      ) : (
        comments.map((c) => (
          <article key={c.id} className={`card ${c.status === 'hidden' ? 'rejected' : ''}`}>
            <div className="body">
              <h3>« {c.text} »</h3>
              <p className="muted small">{c.pseudo ?? 'anonyme'} · sur « {c.article_title ?? '…'} » · {ago(c.created_at)}{c.status === 'hidden' ? ' · masqué' : ''}</p>
            </div>
            <div className="btns">
              <button className="btn sm" onClick={async () => { await api.setComment(c.id, c.status === 'hidden' ? 'visible' : 'hidden'); load(); say(c.status === 'hidden' ? 'Commentaire rétabli' : 'Commentaire masqué'); }}>{c.status === 'hidden' ? 'Rétablir' : 'Masquer'}</button>
              <button className="btn ghost sm" onClick={() => ban(c)}>Bannir l'auteur</button>
            </div>
          </article>
        ))
      )}
    </>
  );
}

/* ---------------- Lecteurs (admins) ---------------- */
function ReadersPage({ say }: { say: (m: string) => void }) {
  const [search, setSearch] = useState('');
  const [list, setList] = useState<Reader[] | null>(null);
  const load = useCallback(() => api.readers(search.trim()).then(setList).catch((e) => { setList([]); say(e instanceof Error ? e.message : 'Lecture impossible'); }), [search, say]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  const act = async (f: () => Promise<void>, msg: string) => {
    try { await f(); await load(); say(msg); } catch (e) { say(e instanceof Error ? e.message : 'Action impossible'); }
  };
  return (
    <>
      <header className="head"><div><div className="eyebrow">Lecteurs</div><h1>Tous les comptes</h1><p className="muted">Les 200 derniers comptes, ou ceux qui correspondent à votre recherche. Supprimer un compte efface aussi ses commentaires et ses likes, sans retour possible (droit à l'effacement).</p></div></header>
      <input className="search" placeholder="Chercher un pseudo ou une adresse e-mail" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Chercher un lecteur" />
      {!list ? <p className="muted">Chargement…</p> : !list.length ? <p className="muted empty">Aucun compte.</p> : (
        <table className="table">
          <thead><tr><th>Lecteur</th><th>Inscrit</th><th>Vu</th><th>Commentaires</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td><b>{p.pseudo ?? '—'}</b><div className="muted small">{p.email}</div></td>
                <td className="muted">{ago(p.created_at)}</td>
                <td className="muted">{p.last_seen ? dateLabel(p.last_seen) : 'jamais'}</td>
                <td>{p.comments}{p.hidden ? <span className="muted small"> · {p.hidden} masqué{p.hidden > 1 ? 's' : ''}</span> : null}{p.reports ? <span className="warn small"> · {p.reports} signalement{p.reports > 1 ? 's' : ''}</span> : null}</td>
                <td>{p.banned ? <span className="pill rejected">Banni</span> : p.role !== 'reader' ? <span className="pill published">{ROLE[p.role]}</span> : p.premium ? <span className="pill published">Premium</span> : <span className="muted small">Lecteur</span>}</td>
                <td className="btns">
                  {p.role === 'reader' ? <button className="btn sm" onClick={() => act(() => api.setBanned(p.id, !p.banned), p.banned ? 'Bannissement levé' : 'Lecteur banni')}>{p.banned ? 'Débannir' : 'Bannir'}</button> : null}
                  {p.role !== 'admin' ? <button className="btn ghost sm" onClick={() => confirm(`Supprimer définitivement le compte ${p.pseudo ?? p.email} et tout ce qu'il a écrit ?`) && act(() => api.deleteUser(p.id), 'Compte supprimé')}>Supprimer</button> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
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
  return (
    <>
      <header className="head"><div><div className="eyebrow">Équipe</div><h1>Qui a accès</h1><p className="muted">Modération : les commentaires seulement (masquer, bannir). Rédaction : les infos, la Dernière minute, les sources et la modération. Administrateur : tout, y compris l'équipe et les réglages.</p></div></header>
      <table className="table">
        <thead><tr><th>Pseudo</th><th>Rôle</th><th>Depuis</th></tr></thead>
        <tbody>
          {list.map((p) => (
            <tr key={p.id}>
              <td><b>{p.pseudo ?? '—'}</b></td>
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
        if (!p) return say('Aucun compte avec ce pseudo. La personne doit d’abord créer un compte dans l’app.');
        await api.setRole(p.id, role);
        setPseudo('');
        load();
        say(`${p.pseudo} rejoint l'équipe (${ROLE[role]})`);
      }}>
        <h2>Ajouter à l'équipe</h2>
        <div className="row3">
          <label>Pseudo du compte TITRE<input value={pseudo} onChange={(e) => setPseudo(e.target.value)} required /></label>
          <label>Rôle<select value={role} onChange={(e) => setRole(e.target.value as Role)}>{(['moderator', 'editor', 'admin'] as Role[]).map((r) => <option key={r} value={r}>{ROLE[r]}</option>)}</select></label>
        </div>
        <button className="btn primary">Ajouter</button>
      </form>
    </>
  );
}


