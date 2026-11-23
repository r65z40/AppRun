// Reconnaissance des lecteurs : badges affichés à côté des pseudos dans l'app, paliers de lecture,
// statuts donnés à la main (Bienfaiteur…), temps gagné par info lue. Tout se règle ici.
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { api, sb, type Reader } from './data';

export type Kind = 'premium' | 'reads' | 'manual' | 'team' | 'seniority' | 'early' | 'liked' | 'streak' | 'early_bird' | 'explorer' | 'sharer' | 'event';
export type Badge = { id: string; kind: Kind; label: string; description: string; icon: string; color: string; threshold: number; position: number; starts_at?: string | null; ends_at?: string | null; active: boolean };
type Holder = { user_id: string; pseudo: string | null; email: string | null; granted_at: string };
type Conf = { minutes_per_article: number; max_icons: number; color_pseudo: boolean };

/** Ce que récompense chaque type de badge, et l'unité du seuil. */
export const KINDS: Record<Kind, [string, string | null]> = {
  premium: ['Abonnés Premium', null],
  reads: ['Infos lues (palier)', 'infos lues au moins'],
  manual: ['Donné à la main (ex. Bienfaiteur)', null],
  team: ['Membres de l’équipe', null],
  seniority: ['Ancienneté', 'jours depuis l’inscription'],
  early: ['Pionniers', 'premiers comptes'],
  liked: ['Commentaires appréciés', 'likes reçus au moins'],
  streak: ['Série de jours', 'jours d’affilée'],
  early_bird: ['Lève-tôt (lu avant 8 h)', 'matins au moins'],
  explorer: ['Explorateur', 'rubriques lues au moins'],
  sharer: ['Partageur', 'infos partagées au moins'],
  event: ['Événement (venu pendant une période)', null],
};
/** Types à paliers : seul le plus haut atteint s'affiche. */
const TIERS: Kind[] = ['reads', 'seniority', 'liked', 'early', 'streak', 'early_bird', 'explorer', 'sharer'];
const CONF: Conf = { minutes_per_article: 3, max_icons: 3, color_pseudo: true };
const isHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v);

/* ---------- Données : Supabase, ou démo en mémoire ---------- */
let demo: Badge[] = [
  ['premium', 'Premium', 'Abonné Premium : soutient l’app.', '💎', '#C86BFA', 0, 1],
  ['manual', 'Bienfaiteur', 'A proposé des idées pour améliorer l’app.', '💌', '#FFB547', 0, 2],
  ['team', 'Équipe', 'Fait partie de l’équipe.', '🛡️', '#3D7BFF', 0, 3],
  ['reads', 'Curieux', 'A lu plus de 50 infos.', '📖', '#5AD1B5', 50, 10],
  ['reads', 'Assidu', 'A lu plus de 250 infos.', '📚', '#4FB0FF', 250, 11],
  ['reads', 'Érudit', 'A lu plus de 1 000 infos.', '🧠', '#9A7BFF', 1000, 12],
  ['reads', 'Encyclopédie', 'A lu plus de 5 000 infos.', '🏆', '#FFD166', 5000, 13],
  ['early', 'Pionnier', 'Parmi les 1 000 premiers comptes.', '🚀', '#FF8A7A', 1000, 20],
  ['seniority', 'Fidèle', 'Membre depuis plus d’un an.', '🎂', '#FF6B8A', 365, 21],
  ['liked', 'Plume appréciée', 'Ses commentaires ont reçu plus de 100 likes.', '✍️', '#7B5CFF', 100, 22],
  ['streak', 'Série de 7 jours', 'Venu 7 jours d’affilée.', '🔥', '#FF8A3D', 7, 30],
  ['streak', 'Série de 30 jours', 'Venu 30 jours d’affilée.', '⚡', '#FFB547', 30, 31],
  ['streak', 'Série de 100 jours', 'Venu 100 jours d’affilée.', '💯', '#FF6B8A', 100, 32],
  ['early_bird', 'Lève-tôt', 'A lu son édition avant 8 h, 20 matins.', '☀️', '#FFD166', 20, 33],
  ['explorer', 'Explorateur', 'A lu des infos dans les 10 rubriques.', '🧭', '#5AD1B5', 10, 34],
  ['sharer', 'Partageur', 'A partagé 10 infos.', '📣', '#4FB0FF', 10, 35],
  ['event', 'Présent au lancement', 'Était là pendant les deux premiers mois.', '🎉', '#C86BFA', 0, 40],
].map(([kind, label, description, icon, color, threshold, position], i) => ({ id: `b${i}`, kind, label, description, icon, color, threshold, position, active: true, ...(kind === 'event' ? { starts_at: '2026-11-23', ends_at: '2027-01-22' } : {}) } as Badge));
let demoHolders: Record<string, Holder[]> = { b1: [{ user_id: 'u0', pseudo: 'Camille_R', email: 'camille@exemple.fr', granted_at: new Date().toISOString() }] };
let demoConf = CONF;

const ok = <T,>(r: { data: T | null; error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); return r.data as T; };
const real = (sb: SupabaseClient) => ({
  list: async () => ok(await sb.from('badges').select('*').order('position').order('threshold')) as Badge[],
  async save(b: Partial<Badge>) {
    const { id, ...rest } = b;
    ok(id ? await sb.from('badges').update(rest).eq('id', id) : await sb.from('badges').insert(rest));
  },
  async remove(id: string) { ok(await sb.from('badges').delete().eq('id', id)); },
  holders: async (id: string) => ok(await sb.rpc('badge_holders', { bid: id })) as Holder[],
  async grant(uid: string, id: string, give: boolean) { ok(await sb.rpc('grant_badge', { uid, bid: id, give })); },
  conf: async () => ({ ...CONF, ...(ok(await sb.rpc('recognition_conf')) as Partial<Conf>) }),
  saveConf: (c: Conf) => api.setSetting('RECOGNITION', JSON.stringify(c)),
});
const data = sb ? real(sb) : {
  list: async () => [...demo].sort((a, b) => a.position - b.position || a.threshold - b.threshold),
  async save(b: Partial<Badge>) {
    if (b.id) demo = demo.map((x) => (x.id === b.id ? { ...x, ...b } : x));
    else demo = [...demo, { id: `b${Date.now()}`, kind: 'manual', label: '', description: '', icon: '⭐', color: '#7B5CFF', threshold: 0, position: 30, active: true, ...b }];
  },
  async remove(id: string) { demo = demo.filter((x) => x.id !== id); },
  holders: async (id: string) => demoHolders[id] ?? [],
  async grant(uid: string, id: string, give: boolean) {
    const r = (await api.readers('', 'all')).find((x) => x.id === uid);
    const list = (demoHolders[id] ?? []).filter((h) => h.user_id !== uid);
    demoHolders = { ...demoHolders, [id]: give ? [{ user_id: uid, pseudo: r?.pseudo ?? null, email: r?.email ?? null, granted_at: new Date().toISOString() }, ...list] : list };
  },
  conf: async () => demoConf,
  async saveConf(c: Conf) { demoConf = c; },
};

export function BadgesPage({ say }: { say: (m: string) => void }) {
  const [list, setList] = useState<Badge[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const load = () => data.list().then(setList).catch((e) => { setList([]); say(e.message); });
  useEffect(() => { load(); }, []);
  const add = async () => {
    try { await data.save({ kind: 'manual', label: 'Nouveau statut', description: '', icon: '⭐', color: '#7B5CFF', threshold: 0, position: (list?.length ?? 0) + 30 }); await load(); say('Badge ajouté : réglez-le ci-dessous.'); }
    catch (e) { say(e instanceof Error ? e.message : 'Ajout impossible'); }
  };
  return (
    <>
      <header className="head">
        <div>
          <div className="eyebrow">Lecteurs</div>
          <h1>Reconnaissance</h1>
          <p className="muted">Les badges apparaissent à côté du pseudo sous les commentaires. En touchant un pseudo, on voit tous ses badges, ses infos lues et le temps qu’il a gagné. Chaque lecteur peut cacher les siens (Mon compte). Les badges automatiques se calculent seuls ; ceux « donnés à la main » (Bienfaiteur, par exemple pour une suggestion reçue par e-mail) s’attribuent ici.</p>
        </div>
        <button className="btn primary" onClick={add}>Ajouter un badge</button>
      </header>
      <ConfPanel say={say} />
      {!list ? <p className="muted">Chargement…</p> : (
        <div className="settings">
          {list.map((b) => <BadgeRow key={b.id} b={b} open={open === b.id} onOpen={() => setOpen(open === b.id ? null : b.id)} say={say} reload={load} />)}
        </div>
      )}
    </>
  );
}

function ConfPanel({ say }: { say: (m: string) => void }) {
  const [c, setC] = useState<Conf | null>(null);
  useEffect(() => { data.conf().then(setC).catch(() => setC(CONF)); }, []);
  if (!c) return null;
  const save = async () => {
    try { await data.saveConf(c); say('Réglages enregistrés : ils s’appliquent à la prochaine ouverture de l’app.'); }
    catch (e) { say(e instanceof Error ? e.message : 'Enregistrement impossible'); }
  };
  return (
    <section className="panel settings" style={{ marginBottom: 18 }}>
      <h2>Réglages</h2>
      <div className="row3">
        <label>Minutes gagnées par info lue
          <input type="number" min={0} max={60} step={0.5} value={c.minutes_per_article} onChange={(e) => setC({ ...c, minutes_per_article: Number(e.target.value) })} />
          <span className="muted small" style={{ fontWeight: 400 }}>Par rapport à un article classique. 500 infos lues = {Math.round((500 * c.minutes_per_article) / 60)} h gagnées.</span>
        </label>
        <label>Icônes à côté du pseudo
          <input type="number" min={0} max={6} value={c.max_icons} onChange={(e) => setC({ ...c, max_icons: Number(e.target.value) })} />
          <span className="muted small" style={{ fontWeight: 400 }}>Les autres se voient en touchant le pseudo. 0 = aucune.</span>
        </label>
        <label className="check" style={{ alignSelf: 'center' }}><input type="checkbox" checked={c.color_pseudo} onChange={(e) => setC({ ...c, color_pseudo: e.target.checked })} /> Pseudo à la couleur de son premier badge</label>
      </div>
      <div><button className="btn primary sm" onClick={save}>Enregistrer</button></div>
    </section>
  );
}

function BadgeRow({ b, open, onOpen, say, reload }: { b: Badge; open: boolean; onOpen: () => void; say: (m: string) => void; reload: () => void }) {
  const [d, setD] = useState(b);
  useEffect(() => setD(b), [b]);
  const unit = KINDS[d.kind][1];
  const bad = !d.label.trim() || !d.icon.trim() || !isHex(d.color) || (d.kind === 'event' && (!d.starts_at || !d.ends_at || d.ends_at < d.starts_at));
  const run = async (f: () => Promise<unknown>, msg: string) => {
    try { await f(); reload(); say(msg); } catch (e) { say(e instanceof Error ? e.message : 'Action impossible'); }
  };
  return (
    <div className="panel" style={{ padding: 16, opacity: d.active ? 1 : 0.6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 22, width: 40, height: 40, borderRadius: 20, display: 'grid', placeItems: 'center', background: `${d.color}38`, border: `1px solid ${d.color}99` }}>{d.icon}</span>
        <b style={{ color: d.color }}>{d.label || 'Sans nom'}</b>
        <span className="muted small">{KINDS[d.kind][0]}{unit ? ` · ${d.threshold.toLocaleString('fr-FR')} ${unit}` : ''}{d.kind === 'event' ? ` · du ${d.starts_at ?? '?'} au ${d.ends_at ?? '?'}` : ''}{d.active ? '' : ' · désactivé'}</span>
        <button className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={onOpen}>{open ? 'Fermer' : 'Modifier'}</button>
      </div>
      {open ? (
        <div className="addform" style={{ marginTop: 14 }}>
          <div className="row3">
            <label>Nom<input value={d.label} maxLength={30} onChange={(e) => setD({ ...d, label: e.target.value })} /></label>
            <label>Icône (un emoji)<input value={d.icon} maxLength={8} onChange={(e) => setD({ ...d, icon: e.target.value })} /></label>
            <label>Couleur
              <span className="check"><input type="color" value={isHex(d.color) ? d.color : '#7B5CFF'} onChange={(e) => setD({ ...d, color: e.target.value })} style={{ width: 48 }} /><input value={d.color} maxLength={7} onChange={(e) => setD({ ...d, color: e.target.value.trim() })} className={isHex(d.color) ? '' : 'invalid'} /></span>
            </label>
          </div>
          <label>Ce qu’il récompense (affiché dans l’app)<input value={d.description} maxLength={200} onChange={(e) => setD({ ...d, description: e.target.value })} /></label>
          <div className="row3">
            <label>Type<select value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value as Kind })}>{(Object.keys(KINDS) as Kind[]).map((k) => <option key={k} value={k}>{KINDS[k][0]}</option>)}</select></label>
            {unit ? <label>Seuil ({unit})<input type="number" min={0} value={d.threshold} onChange={(e) => setD({ ...d, threshold: Math.max(0, Math.round(Number(e.target.value))) })} /></label> : <span />}
            <label>Ordre d’affichage<input type="number" value={d.position} onChange={(e) => setD({ ...d, position: Math.round(Number(e.target.value)) })} /></label>
          </div>
          {d.kind === 'event' ? (
            <div className="row3">
              <label>Du<input type="date" value={d.starts_at ?? ''} onChange={(e) => setD({ ...d, starts_at: e.target.value || null })} /></label>
              <label>Au (inclus)<input type="date" value={d.ends_at ?? ''} onChange={(e) => setD({ ...d, ends_at: e.target.value || null })} /></label>
              <span className="muted small" style={{ alignSelf: 'center' }}>Tout lecteur connecté qui ouvre l’app pendant ces dates le reçoit, et le garde.</span>
            </div>
          ) : null}
          {TIERS.includes(d.kind) ? <p className="muted small">Paliers : un lecteur ne montre que le plus haut palier atteint de ce type (par exemple Érudit plutôt que Curieux).</p> : null}
          <label className="check"><input type="checkbox" checked={d.active} onChange={(e) => setD({ ...d, active: e.target.checked })} /> Actif (visible dans l’app)</label>
          <div className="btns">
            <button className="btn primary sm" disabled={bad} onClick={() => run(() => data.save({ id: d.id, kind: d.kind, label: d.label.trim(), description: d.description.trim(), icon: d.icon.trim(), color: d.color, threshold: d.threshold, position: d.position, starts_at: d.starts_at ?? null, ends_at: d.ends_at ?? null, active: d.active }), 'Badge enregistré')}>Enregistrer</button>
            <button className="btn ghost sm" onClick={() => confirm(`Supprimer le badge « ${b.label} » ? Ceux qui l’ont reçu à la main le perdent.`) && run(() => data.remove(b.id), 'Badge supprimé')}>Supprimer</button>
          </div>
          {b.kind === 'manual' ? <Holders b={b} say={say} /> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Qui a reçu ce statut, et l'attribuer à quelqu'un (pseudo ou adresse e-mail). */
function Holders({ b, say }: { b: Badge; say: (m: string) => void }) {
  const [list, setList] = useState<Holder[] | null>(null);
  const [q, setQ] = useState('');
  const load = () => data.holders(b.id).then(setList).catch((e) => { setList([]); say(e.message); });
  useEffect(() => { load(); }, [b.id]);
  const give = async () => {
    const v = q.trim().toLowerCase();
    const found = (await api.readers(q.trim(), 'all').catch(() => [] as Reader[])).find((r) => r.email?.toLowerCase() === v || r.pseudo?.toLowerCase() === v);
    if (!found) return say('Aucun compte avec ce pseudo ou cette adresse.');
    try { await data.grant(found.id, b.id, true); setQ(''); load(); say(`${b.label} attribué à ${found.pseudo ?? found.email}`); }
    catch (e) { say(e instanceof Error ? e.message : 'Attribution impossible'); }
  };
  return (
    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, display: 'grid', gap: 8 }}>
      <h4 style={{ margin: 0 }}>Lecteurs qui l’ont reçu {list ? <span className="muted">({list.length})</span> : null}</h4>
      <form className="check" onSubmit={(e) => { e.preventDefault(); give(); }}>
        <input placeholder="Pseudo ou adresse e-mail" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 320 }} />
        <button className="btn sm" disabled={!q.trim()}>Attribuer</button>
      </form>
      {list?.map((h) => (
        <div key={h.user_id} className="check small">
          <b>{h.pseudo ?? '—'}</b> <span className="muted">{h.email} · depuis le {new Date(h.granted_at).toLocaleDateString('fr-FR')}</span>
          <button className="btn ghost sm" onClick={async () => { try { await data.grant(h.user_id, b.id, false); load(); say('Statut retiré'); } catch (e) { say(e instanceof Error ? e.message : 'Action impossible'); } }}>Retirer</button>
        </div>
      ))}
      {list && !list.length ? <p className="muted small">Personne pour l’instant.</p> : null}
    </div>
  );
}
