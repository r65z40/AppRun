import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ENGINE_URL, PHOTO_TAGS, RUBRICS, type Article, type Comment, type Edition, type Fact, type Flash, type Me, type Profile, type Report, type Role, type Source, type Status } from './data';

type Page = 'edition' | 'flash' | 'sources' | 'moderation' | 'team';
const PAGES: [Page, string][] = [['edition', 'Édition'], ['flash', 'Dernière minute'], ['sources', 'Sources'], ['moderation', 'Modération'], ['team', 'Équipe']];
const LIMITS = { title: 60, key: 140, fact: 90, summary: 280 };
const SUMMARY_HEADS = ['Contexte', 'Ce qui change', 'Et après'];

const dateLabel = (d: string) => new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(d + 'T12:00:00'));
const ago = (iso: string | null) => {
  if (!iso) return 'jamais';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : `il y a ${Math.round(m / 1440)} j`;
};
const plain = (s: string) => s.replace(/<\/?b>/g, '');

export default function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [page, setPage] = useState<Page>(() => (location.hash.slice(1) as Page) || 'edition');
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
          {PAGES.filter(([p]) => p !== 'team' || me.role === 'admin').map(([p, l]) => (
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
        {page === 'edition' && <EditionPage say={say} />}
        {page === 'flash' && <FlashPage say={say} />}
        {page === 'sources' && <SourcesPage say={say} />}
        {page === 'moderation' && <ModerationPage say={say} />}
        {page === 'team' && me.role === 'admin' && <TeamPage say={say} me={me} />}
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
  return (
    <div className="center">
      <form className="panel narrow" onSubmit={async (e) => { e.preventDefault(); setBusy(true); const m = await api.signIn(email, pw); setBusy(false); m ? setErr(m) : onIn(); }}>
        <div className="logo big"><Glyph /> TITRE</div>
        <h1>Back office</h1>
        {api.demo ? <p className="demo">Mode démo : aucune base n'est branchée. Cliquez sur « Se connecter » pour essayer avec des données fictives.</p> : null}
        <label>Adresse e-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required={!api.demo} autoComplete="username" /></label>
        <label>Mot de passe<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required={!api.demo} autoComplete="current-password" /></label>
        {err ? <p className="error">{err}</p> : null}
        <button className="btn primary" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
      </form>
    </div>
  );
}

/* ---------------- Édition du jour ---------------- */
type Filter = 'all' | 'review' | 'draft' | 'published' | 'rejected';
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
              {ed.stats.fetched != null ? <span className="muted">{String(ed.stats.fetched)} titres lus · {String(ed.stats.stories ?? 0)} sujets retenus · modèle {String(ed.stats.model ?? '—')}</span> : null}
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
  const set = <K extends keyof Article>(k: K, v: Article[K]) => setD((x) => ({ ...x, [k]: v }));
  const setFact = (i: number, k: keyof Fact, v: string) => setD((x) => ({ ...x, facts: x.facts.map((f, j) => (j === i ? { ...f, [k]: v } : f)) }));
  const over = plain(d.title).length > LIMITS.title || d.key_sentence.length > LIMITS.key || d.facts.some((f) => plain(f.text).length > LIMITS.fact) || d.summary.some((s) => s.length > LIMITS.summary);
  const patch = (): Partial<Article> => ({ title: d.title, key_sentence: d.key_sentence, facts: d.facts, summary: d.summary, rubric_id: d.rubric_id, essential: d.essential, importance: d.importance, photo_tag: d.photo_tag, photo_url: d.photo_url || null });
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
            <label>Ou adresse d'une photo libre de droits<input placeholder="https://…" value={d.photo_url ?? ''} onChange={(e) => set('photo_url', e.target.value)} /></label>
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
          <p className="muted">Le moteur passe toutes les 20 minutes, de 6 h à 23 h, et publie seul les infos majeures confirmées par au moins deux médias. Elles restent 24 heures dans l'app. Masquez, corrigez ou ajoutez une info ici.</p>
        </div>
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
  const [tab, setTab] = useState<'reports' | 'recent'>('reports');
  const load = () => Promise.all([api.reports().then(setReports), api.comments().then(setComments)]);
  useEffect(() => { load(); }, []);
  const grouped = useMemo(() => {
    const m = new Map<string, Report[]>();
    reports.forEach((r) => m.set(r.comment_id, [...(m.get(r.comment_id) ?? []), r]));
    return [...m.values()];
  }, [reports]);
  return (
    <>
      <header className="head"><div><div className="eyebrow">Modération</div><h1>Commentaires</h1><p className="muted">70 caractères maximum, signalables par les lecteurs. Un commentaire masqué disparaît de l'app.</p></div></header>
      <div className="tabs">
        <button className={tab === 'reports' ? 'on' : ''} onClick={() => setTab('reports')}>Signalements <b>{grouped.length}</b></button>
        <button className={tab === 'recent' ? 'on' : ''} onClick={() => setTab('recent')}>Derniers commentaires <b>{comments.length}</b></button>
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
              </div>
            </article>
          );
        }) : <p className="muted empty">Aucun signalement en attente.</p>
      ) : (
        comments.map((c) => (
          <article key={c.id} className={`card ${c.status === 'hidden' ? 'rejected' : ''}`}>
            <div className="body">
              <h3>« {c.text} »</h3>
              <p className="muted small">{c.pseudo ?? 'anonyme'} · sur « {c.article_title ?? '…'} » · {ago(c.created_at)}{c.status === 'hidden' ? ' · masqué' : ''}</p>
            </div>
            <div className="btns">
              <button className="btn sm" onClick={async () => { await api.setComment(c.id, c.status === 'hidden' ? 'visible' : 'hidden'); load(); say(c.status === 'hidden' ? 'Commentaire rétabli' : 'Commentaire masqué'); }}>{c.status === 'hidden' ? 'Rétablir' : 'Masquer'}</button>
            </div>
          </article>
        ))
      )}
    </>
  );
}

/* ---------------- Équipe (admins) ---------------- */
function TeamPage({ say, me }: { say: (m: string) => void; me: Me }) {
  const [list, setList] = useState<Profile[]>([]);
  const [pseudo, setPseudo] = useState('');
  const load = () => api.team().then(setList);
  useEffect(() => { load(); }, []);
  const ROLE: Record<Role, string> = { reader: 'Lecteur', editor: 'Rédaction', admin: 'Administrateur' };
  return (
    <>
      <header className="head"><div><div className="eyebrow">Équipe</div><h1>Qui a accès</h1><p className="muted">La rédaction valide les cartes et modère. Les administrateurs gèrent aussi l'équipe.</p></div></header>
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
        await api.setRole(p.id, 'editor');
        setPseudo('');
        load();
        say(`${p.pseudo} rejoint la rédaction`);
      }}>
        <h2>Ajouter à la rédaction</h2>
        <div className="row3"><label>Pseudo du compte TITRE<input value={pseudo} onChange={(e) => setPseudo(e.target.value)} required /></label></div>
        <button className="btn primary">Ajouter</button>
      </form>
    </>
  );
}


