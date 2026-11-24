// Algorithme « Mon édition » (sans IA) : réglages, mots-clés, aperçu de l'édition d'un lecteur et statistiques.
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { api, RUBRICS, sb, type Reader } from './data';

type Signals = Record<string, number>;
export type AlgoConf = {
  enabled: boolean; share_essential: number; share_discovery: number;
  w_importance: number; w_affinity: number; w_collective: number; w_fresh: number;
  affinity_start: number; ramp: number; half_life: number; smooth: number; decay_hours: number;
  skip_ms: number; long_ms: number; min_views: number; max_rubric: number; keep_days: number; signals: Signals;
};
type Keyword = { id: number; label: string; words: string[]; active: boolean };
type Stats = { readers_7: number; events_7: Record<string, number>; likes_7: number; dislikes_7: number; resets_7: number; untagged: number; topics: { topic: string; articles: number; reads: number }[] };
type Slot = 'ess' | 'pv' | 'dec';
type ReaderAlgo = { taste: { rubrics: Record<string, number>; topics: Record<string, number>; n: number }; active: string[]; quota: number; edition: { title: string; rubric: string; slot: Slot; reason: string; score: number }[] };

// Mêmes valeurs que algo_defaults() dans la base (migration 0015).
const DEFAULTS: AlgoConf = {
  enabled: true, share_essential: 25, share_discovery: 12,
  w_importance: 45, w_affinity: 35, w_collective: 10, w_fresh: 10,
  affinity_start: 10, ramp: 50, half_life: 21, smooth: 5, decay_hours: 6,
  skip_ms: 2000, long_ms: 12000, min_views: 200, max_rubric: 50, keep_days: 90,
  signals: { click: 3, share: 3, summary_end: 2, like: 2, comment: 2, summary: 1.5, source: 1, long: 1, back: 0.5, skip: -0.5, dislike: -0.5, less: -3 },
};
const SIGNALS: [string, string][] = [
  ['click', "Lien « Lire l'article complet » ou source ouverte"], ['share', 'Partage'], ['summary_end', "Résumé lu jusqu'en bas"],
  ['like', 'Like'], ['comment', 'Commentaire'], ['summary', 'Résumé ouvert (« Lire »)'], ['source', 'Fait retourné pour voir sa source'],
  ['long', 'Carte lue longuement'], ['back', 'Retour en arrière sur une carte'], ['skip', 'Carte passée très vite'],
  ['dislike', 'Dislike (compte peu : souvent « je n’aime pas cette nouvelle »)'], ['less', '« Moins de sujets comme ça »'],
];
const SLOT: Record<Slot, [string, string]> = { ess: ['Majeur', 'ess'], pv: ['Pour vous', 'published'], dec: ['Découverte', 'ready'] };
const int = (n: number) => n.toLocaleString('fr-FR');

/* ---------- Données : Supabase, ou démo en mémoire ---------- */
let demoConf: AlgoConf = DEFAULTS;
let demoWords: Keyword[] = [
  { id: 1, label: 'IA', words: ['intelligence artificielle', 'ChatGPT', 'OpenAI'], active: true },
  { id: 2, label: 'Football', words: ['Ligue 1', 'PSG', 'Ligue des champions'], active: true },
  { id: 3, label: 'Climat', words: ['réchauffement', 'canicule', 'COP'], active: true },
  { id: 4, label: 'Immobilier', words: ['logement', 'loyer'], active: false },
];
const demoStats: Stats = { readers_7: 1284, events_7: { view: 18400, summary: 3920, summary_end: 2210, source: 860, click: 540, share: 190, back: 410, less: 37 }, likes_7: 1630, dislikes_7: 212, resets_7: 4, untagged: 3,
  topics: [{ topic: 'IA', articles: 9, reads: 840 }, { topic: 'Football', articles: 12, reads: 610 }, { topic: 'Climat', articles: 5, reads: 330 }] };
const demoReader: ReaderAlgo = { taste: { rubrics: { tech: 14.2, eco: 3.1, france: -1.4 }, topics: { IA: 11.5, Smartphones: 2.4, Bourse: 1.2 }, n: 86 }, active: ['france', 'tech', 'eco'], quota: 8,
  edition: [
    { title: 'Le gouvernement présente son budget', rubric: 'france', slot: 'ess', reason: 'Sujet majeur du jour, proposé à tout le monde.', score: 0.81 },
    { title: 'Sommet à Bruxelles sur l’Ukraine', rubric: 'monde', slot: 'ess', reason: 'Sujet majeur du jour, proposé à tout le monde.', score: 0.74 },
    { title: 'OpenAI dévoile une IA', rubric: 'tech', slot: 'pv', reason: 'Vous lisez souvent : IA.', score: 0.71 },
    { title: 'Le CAC 40 recule', rubric: 'eco', slot: 'pv', reason: 'Vous lisez souvent : Bourse.', score: 0.62 },
    { title: 'Le PSG en Ligue des champions', rubric: 'sport', slot: 'dec', reason: 'Pour découvrir la rubrique Sport.', score: 0.55 },
    { title: 'Nouvel iPhone', rubric: 'tech', slot: 'pv', reason: 'Vous lisez souvent : Smartphones.', score: 0.54 },
    { title: 'Le chômage baisse', rubric: 'eco', slot: 'pv', reason: 'Vous suivez la rubrique Économie.', score: 0.5 },
    { title: 'Réforme du lycée', rubric: 'france', slot: 'pv', reason: 'Vous suivez la rubrique France.', score: 0.44 },
  ] };

const ok = <T,>(r: { data: T | null; error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); return r.data as T; };
const real = (sb: SupabaseClient) => ({
  conf: async () => ({ ...DEFAULTS, ...ok(await sb.rpc('algo_conf')) as AlgoConf }),
  saveConf: (c: AlgoConf | null) => api.setSetting('ALGO', c ? JSON.stringify(c) : ''),
  words: async () => ok(await sb.from('algo_keywords').select('id,label,words,active').order('label')) as Keyword[],
  async saveWord(k: Partial<Keyword>) {
    const { id, ...rest } = k;
    ok(id ? await sb.from('algo_keywords').update(rest).eq('id', id) : await sb.from('algo_keywords').insert(rest));
  },
  async removeWord(id: number) { ok(await sb.from('algo_keywords').delete().eq('id', id)); },
  stats: async () => ok(await sb.rpc('algo_stats')) as Stats,
  reader: async (uid: string) => ok(await sb.rpc('admin_reader_algo', { uid })) as ReaderAlgo,
});
const algo = sb ? real(sb) : {
  conf: async () => demoConf,
  async saveConf(c: AlgoConf | null) { demoConf = c ?? DEFAULTS; },
  words: async () => [...demoWords].sort((a, b) => a.label.localeCompare(b.label)),
  async saveWord(k: Partial<Keyword>) {
    if (k.id) demoWords = demoWords.map((w) => (w.id === k.id ? { ...w, ...k } : w));
    else demoWords = [...demoWords, { id: Date.now(), label: k.label ?? '', words: k.words ?? [], active: true }];
  },
  async removeWord(id: number) { demoWords = demoWords.filter((w) => w.id !== id); },
  stats: async () => demoStats,
  reader: async () => demoReader,
};

export function AlgoPage({ say }: { say: (m: string) => void }) {
  const [tab, setTab] = useState<'settings' | 'words' | 'reader' | 'stats'>('settings');
  const TABS: [typeof tab, string][] = [['settings', 'Réglages'], ['words', 'Mots-clés'], ['reader', 'Aperçu par lecteur'], ['stats', 'Statistiques']];
  return (
    <>
      <header className="head">
        <div>
          <div className="eyebrow">Lecteurs</div>
          <h1>Algorithme « Mon édition »</h1>
          <p className="muted">Sans IA : chaque geste du lecteur donne des points à une rubrique et aux mots-clés de l'info. Son édition mélange les sujets majeurs du jour (pour tout le monde), les infos qui lui ressemblent et une découverte. Dans l'app, chaque carte a un « Pourquoi ? » et le lecteur peut remettre ses goûts à zéro ou couper la personnalisation.</p>
        </div>
      </header>
      <div className="tabs">{TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'settings' && <Settings say={say} />}
      {tab === 'words' && <Words say={say} />}
      {tab === 'reader' && <ReaderPreview say={say} />}
      {tab === 'stats' && <StatsView say={say} />}
    </>
  );
}

/* ---------- Réglages ---------- */
function Settings({ say }: { say: (m: string) => void }) {
  const [c, setC] = useState<AlgoConf | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { algo.conf().then(setC).catch((e) => say(e.message)); }, []);
  if (!c) return <p className="muted">Chargement…</p>;
  const set = <K extends keyof AlgoConf>(k: K, v: AlgoConf[K]) => setC({ ...c, [k]: v });
  const num = (k: keyof AlgoConf, label: string, help: string, unit = '', step = 1) => (
    <label key={k}>{label}
      <span className="check"><input type="number" step={step} value={Number(c[k])} onChange={(e) => set(k, Number(e.target.value) as never)} style={{ maxWidth: 120 }} />{unit ? <span className="muted small">{unit}</span> : null}</span>
      <span className="muted small" style={{ fontWeight: 400 }}>{help}</span>
    </label>
  );
  const sum = c.w_importance + c.w_affinity + c.w_collective + c.w_fresh;
  const per8 = (pct: number) => Math.max(1, Math.round((8 * pct) / 100));
  const save = async (next: AlgoConf | null) => {
    if (next && sum !== 100) return say(`Les quatre poids du score doivent faire 100 (ils font ${sum}).`);
    setBusy(true);
    try { await algo.saveConf(next); setC(next ?? DEFAULTS); say(next ? 'Algorithme enregistré : il s’applique dès la prochaine ouverture de l’app.' : 'Valeurs par défaut rétablies.'); }
    catch (e) { say(e instanceof Error ? e.message : 'Enregistrement impossible'); }
    finally { setBusy(false); }
  };
  return (
    <>
      <section className="panel settings">
        <h2>Personnalisation</h2>
        <label className="check"><input type="checkbox" checked={c.enabled} onChange={(e) => set('enabled', e.target.checked)} /> Éditions selon les goûts de chaque lecteur</label>
        <p className="muted small">Coupé : tout le monde reçoit la même édition, dans l'ordre de la rédaction (importance), toujours avec la part de découverte.</p>
      </section>
      <section className="panel settings">
        <h2>Composition de l'édition</h2>
        <div className="row2" style={{ alignItems: 'start' }}>
          {num('share_essential', 'Sujets majeurs pour tous', `Sur 8 infos : ${per8(c.share_essential)}. Les plus importants du moment, toujours en tête.`, '%')}
          {num('share_discovery', 'Découverte', c.share_discovery > 0 ? `Sur 8 infos : ${per8(c.share_discovery)}. Un sujet important d'une rubrique peu lue.` : 'Coupée.', '%')}
        </div>
        <p className="muted small">Le reste est choisi selon les goûts (sur 8 infos : {Math.max(0, 8 - per8(c.share_essential) - (c.share_discovery > 0 ? per8(c.share_discovery) : 0))}).</p>
        {num('max_rubric', 'Part maximum d’une rubrique', "Aucune rubrique ne prend plus que cette part de l'édition (sauf si le lecteur n'en suit qu'une ou deux).", '%')}
        {num('decay_hours', 'Une info perd la moitié de son importance en', "Renouvellement de la journée : à chaque mise à jour, les infos fraîches et importantes montent, les dépassées descendent puis sortent vers « Charger plus ». Le nombre d'infos reste celui choisi par le lecteur. Sous les sujets majeurs, l'ordre va du plus pertinent au moins pertinent. 0 = jamais.", 'heures')}
      </section>
      <section className="panel settings">
        <h2>Score d'une info <span className={sum === 100 ? 'muted' : 'error'} style={{ fontWeight: 400, fontSize: 13 }}>· total {sum} / 100</span></h2>
        <div className="row2" style={{ alignItems: 'start' }}>
          {num('w_importance', 'Importance', 'Note de la rédaction (1 à 10).')}
          {num('w_affinity', 'Goûts du lecteur', 'Points de la rubrique et des mots-clés de l’info.')}
          {num('w_collective', 'Intérêt des autres lecteurs', 'Part des lecteurs qui ouvrent ou partagent l’info. Jamais les dislikes ni le nombre de commentaires, pour ne pas récompenser la polémique.')}
          {num('w_fresh', 'Fraîcheur', 'Les infos ajoutées dans la journée remontent.')}
        </div>
      </section>
      <section className="panel settings">
        <h2>Points par geste</h2>
        <p className="muted small">Chaque geste ajoute (ou retire) des points à la rubrique et aux mots-clés de l'info.</p>
        <table className="table"><tbody>
          {SIGNALS.map(([k, l]) => (
            <tr key={k}><td>{l}</td><td style={{ width: 120 }}><input type="number" step={0.5} value={c.signals[k] ?? 0} onChange={(e) => set('signals', { ...c.signals, [k]: Number(e.target.value) })} /></td></tr>
          ))}
        </tbody></table>
        <div className="row2" style={{ alignItems: 'start' }}>
          {num('skip_ms', 'Carte « passée très vite »', 'En dessous de ce temps à l’écran.', 'ms', 100)}
          {num('long_ms', 'Carte « lue longuement »', 'Au-delà de ce temps à l’écran.', 'ms', 500)}
        </div>
      </section>
      <section className="panel settings">
        <h2>Mémoire des goûts</h2>
        <div className="row2" style={{ alignItems: 'start' }}>
          {num('half_life', 'Les points perdent la moitié de leur valeur en', 'Plus court : l’édition suit les envies du moment. Plus long : elle garde les goûts de fond.', 'jours')}
          {num('keep_days', 'Journal de lecture gardé', 'Au-delà, les gestes sont effacés de la base.', 'jours')}
          {num('affinity_start', 'Poids des goûts au départ', "Pour un nouveau lecteur ; ce qui manque va à l'importance.", '/ 100')}
          {num('ramp', 'Poids des goûts complet après', 'Nombre de gestes (en général 3 à 5 jours d’usage).', 'gestes')}
          {num('smooth', 'Lissage', 'Plus haut : il faut plus de gestes pour qu’une rubrique ou un mot-clé pèse.', '', 0.5)}
          {num('min_views', 'Intérêt des autres compté à partir de', 'Lecteurs ayant vu l’info.', 'lecteurs')}
        </div>
      </section>
      <div className="actions">
        <button className="btn primary" disabled={busy} onClick={() => save(c)}>Enregistrer</button>
        <button className="btn ghost" disabled={busy} onClick={() => save(null)}>Revenir aux valeurs par défaut</button>
      </div>
    </>
  );
}

/* ---------- Mots-clés ---------- */
function Words({ say }: { say: (m: string) => void }) {
  const [list, setList] = useState<Keyword[] | null>(null);
  const [label, setLabel] = useState('');
  const [words, setWords] = useState('');
  const load = () => algo.words().then(setList).catch((e) => say(e.message));
  useEffect(() => { load(); }, []);
  const split = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
  const run = (p: Promise<void>, msg: string) => p.then(() => { say(msg); load(); }).catch((e) => say(e instanceof Error ? e.message : 'Action impossible'));
  if (!list) return <p className="muted">Chargement…</p>;
  return (
    <>
      <p className="muted">Les mots-clés sont cherchés dans le titre et le texte de chaque info (une fois dans le titre compte double ; 6 mots-clés au plus par info, les plus fréquents). Ajoutez les variantes, séparées par des virgules. Les infos des 90 derniers jours sont réétiquetées dès que vous enregistrez. Évitez les partis, candidats et religions : on ne range pas les lecteurs par opinion.</p>
      <section className="panel settings">
        <h2>Ajouter un mot-clé</h2>
        <div className="row3">
          <label>Mot-clé<input value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. Cybersécurité" /></label>
          <label>Variantes<input value={words} onChange={(e) => setWords(e.target.value)} placeholder="cyberattaque, piratage, rançongiciel" /></label>
          <button className="btn primary" style={{ alignSelf: 'end' }} disabled={label.trim().length < 2}
            onClick={() => run(algo.saveWord({ label: label.trim(), words: split(words) }), 'Mot-clé ajouté').then(() => { setLabel(''); setWords(''); })}>Ajouter</button>
        </div>
      </section>
      <table className="table">
        <thead><tr><th>Mot-clé</th><th>Variantes cherchées</th><th>Actif</th><th /></tr></thead>
        <tbody>
          {list.map((k) => (
            <tr key={k.id} className={k.active ? '' : 'off'}>
              <td><b>{k.label}</b></td>
              <td><input defaultValue={k.words.join(', ')} onBlur={(e) => { if (e.target.value !== k.words.join(', ')) run(algo.saveWord({ id: k.id, words: split(e.target.value) }), 'Variantes enregistrées'); }} /></td>
              <td><input type="checkbox" checked={k.active} onChange={(e) => run(algo.saveWord({ id: k.id, active: e.target.checked }), e.target.checked ? 'Mot-clé activé' : 'Mot-clé désactivé')} /></td>
              <td><button className="btn sm ghost" onClick={() => run(algo.removeWord(k.id), 'Mot-clé supprimé')}>Supprimer</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/* ---------- Aperçu par lecteur ---------- */
function ReaderPreview({ say }: { say: (m: string) => void }) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Reader[]>([]);
  const [who, setWho] = useState<Reader | null>(null);
  const [d, setD] = useState<ReaderAlgo | null>(null);
  useEffect(() => {
    const t = setTimeout(() => api.readers(q).then((l) => setFound(l.slice(0, 8))).catch(() => setFound([])), 250);
    return () => clearTimeout(t);
  }, [q]);
  const open = (r: Reader) => { setWho(r); setD(null); algo.reader(r.id).then(setD).catch((e) => say(e.message)); };
  const top = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]);
  return (
    <>
      <input className="search" placeholder="Chercher un lecteur (pseudo ou e-mail)" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="actions" style={{ marginBottom: 18 }}>
        {found.map((r) => <button key={r.id} className={`btn sm ${who?.id === r.id ? 'primary' : ''}`} onClick={() => open(r)}>{r.pseudo ?? r.email}</button>)}
      </div>
      {who && !d ? <p className="muted">Calcul de son édition…</p> : null}
      {who && d ? (
        <>
          <section className="panel settings">
            <h2>Goûts de {who.pseudo ?? who.email} <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>· {int(d.taste.n)} gestes pris en compte</span></h2>
            <p className="muted small">Rubriques suivies : {d.active.map((r) => RUBRICS[r] ?? r).join(', ') || '—'} · {d.quota} infos par jour.</p>
            <div className="row2" style={{ alignItems: 'start' }}>
              <div><div className="lbl">Rubriques</div>{top(d.taste.rubrics).map(([k, v]) => <div key={k} className="meta"><span>{RUBRICS[k] ?? k}</span><b style={{ color: v < 0 ? 'var(--coral)' : undefined }}>{v > 0 ? '+' : ''}{v}</b></div>)}{!Object.keys(d.taste.rubrics).length ? <p className="muted small">Pas encore de geste.</p> : null}</div>
              <div><div className="lbl">Mots-clés</div>{top(d.taste.topics).slice(0, 12).map(([k, v]) => <div key={k} className="meta"><span>{k}</span><b style={{ color: v < 0 ? 'var(--coral)' : undefined }}>{v > 0 ? '+' : ''}{v}</b></div>)}{!Object.keys(d.taste.topics).length ? <p className="muted small">Pas encore de geste.</p> : null}</div>
            </div>
          </section>
          <h2>Son édition maintenant</h2>
          {d.edition.length ? d.edition.map((e, i) => (
            <div key={i} className="card">
              <b className="muted">{i + 1}</b>
              <div className="body" style={{ cursor: 'default' }}>
                <div className="line"><span className={`pill ${SLOT[e.slot][1]}`}>{SLOT[e.slot][0]}</span><span className="muted small">{RUBRICS[e.rubric] ?? e.rubric} · score {e.score}</span></div>
                <div>{e.title}</div>
                <div className="muted small">Pourquoi : {e.reason}</div>
              </div>
            </div>
          )) : <p className="muted">Aucune édition publiée pour l'instant.</p>}
        </>
      ) : null}
    </>
  );
}

/* ---------- Statistiques ---------- */
function StatsView({ say }: { say: (m: string) => void }) {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => { algo.stats().then(setS).catch((e) => say(e.message)); }, []);
  if (!s) return <p className="muted">Chargement…</p>;
  const ev = (k: string) => s.events_7[k] ?? 0;
  const views = ev('view');
  const pct = (n: number) => (views ? `${((n / views) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} % des cartes vues` : '—');
  const Tile = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
    <div className="panel tile"><div className="muted small">{label}</div><div className="tile-v">{value}</div>{sub ? <div className="muted small">{sub}</div> : null}</div>
  );
  return (
    <>
      <p className="muted">Sur les 7 derniers jours.</p>
      <div className="tiles">
        <Tile label="Lecteurs suivis" value={int(s.readers_7)} sub="avec ou sans compte" />
        <Tile label="Cartes vues" value={int(views)} />
        <Tile label="Résumés ouverts" value={int(ev('summary'))} sub={pct(ev('summary'))} />
        <Tile label="Résumés lus jusqu’au bout" value={int(ev('summary_end'))} />
        <Tile label="Articles complets ouverts" value={int(ev('click'))} sub={`${int(ev('share'))} partages`} />
        <Tile label="Likes / dislikes" value={`${int(s.likes_7)} / ${int(s.dislikes_7)}`} />
        <Tile label="« Moins de sujets comme ça »" value={int(ev('less'))} sub={`${int(s.resets_7)} remise${s.resets_7 > 1 ? 's' : ''} à zéro des goûts`} />
        <Tile label="Infos sans mot-clé" value={int(s.untagged)} sub="à couvrir dans l’onglet Mots-clés" />
      </div>
      <h2>Mots-clés les plus lus</h2>
      <table className="table">
        <thead><tr><th>Mot-clé</th><th>Infos</th><th>Lectures (résumé, article, partage)</th></tr></thead>
        <tbody>{s.topics.map((t) => <tr key={t.topic}><td><b>{t.topic}</b></td><td>{int(t.articles)}</td><td>{int(t.reads)}</td></tr>)}</tbody>
      </table>
    </>
  );
}

/** Goûts d'un lecteur, sur sa fiche (page Lecteurs) : rubriques et mots-clés qu'il aime ou évite. */
export function ReaderTaste({ uid }: { uid: string }) {
  const [d, setD] = useState<ReaderAlgo | null | false>(null);
  useEffect(() => { setD(null); algo.reader(uid).then(setD).catch(() => setD(false)); }, [uid]);
  if (d === false) return null;
  if (!d) return <p className="muted small">Goûts : chargement…</p>;
  const fmt = (o: Record<string, number>, name: (k: string) => string, n: number) => {
    const e = Object.entries(o).sort((a, b) => b[1] - a[1]);
    const likes = e.filter(([, v]) => v > 0).slice(0, n).map(([k]) => name(k));
    const avoids = e.filter(([, v]) => v < 0).slice(-3).reverse().map(([k]) => name(k));
    return { likes, avoids };
  };
  const r = fmt(d.taste.rubrics, (k) => RUBRICS[k] ?? k, 4);
  const t = fmt(d.taste.topics, (k) => k, 8);
  return (
    <>
      <h4>Goûts</h4>
      {d.taste.n ? (
        <>
          <p className="small"><span className="muted">Aime :</span> {[...r.likes, ...t.likes].join(', ') || '—'}</p>
          {r.avoids.length || t.avoids.length ? <p className="small"><span className="muted">Évite :</span> {[...r.avoids, ...t.avoids].join(', ')}</p> : null}
          <p className="muted small">{int(d.taste.n)} gestes pris en compte · rubriques suivies : {d.active.map((x) => RUBRICS[x] ?? x).join(', ') || '—'} · {d.quota} infos par jour. Détail et édition du jour : Algorithme &gt; Aperçu par lecteur.</p>
        </>
      ) : <p className="muted small">Pas encore assez de lectures pour connaître ses goûts.</p>}
    </>
  );
}
