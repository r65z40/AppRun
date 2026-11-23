// Sujets suivis : les lecteurs suivent un sujet (« Ukraine », « Budget »…), reçoivent une alerte quand il bouge
// et voient sa frise dans l'app. Ici : réglages des alertes, sujets proposés, statistiques.
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { api, sb } from './data';

export type FollowConf = {
  enabled: boolean; max_follows: number;
  alerts: boolean; flashes: boolean; min_importance: number; max_per_day: number; cooldown_hours: number;
  quiet_start: number; quiet_end: number; lookback_hours: number;
  timeline_days: number; timeline_max: number;
  alert_title: string; alert_body: string; suggested: string[];
};
type TopicRow = { topic: string; followable: boolean; active: boolean; followers: number; alerts_7: number; items_30: number };
type Stats = { followers: number; follows: number; phones: number; alerts_today: number; alerts_7: number; topics: TopicRow[]; recent: { topic: string; title: string; at: string; readers: number }[] };

// Mêmes valeurs que follow_defaults() dans la base (migration 0024).
const DEFAULTS: FollowConf = {
  enabled: true, max_follows: 20,
  alerts: true, flashes: true, min_importance: 6, max_per_day: 3, cooldown_hours: 4,
  quiet_start: 22, quiet_end: 8, lookback_hours: 3,
  timeline_days: 30, timeline_max: 20,
  alert_title: '{sujet}', alert_body: '{titre}',
  suggested: ['Ukraine', 'Budget', 'IA', 'Climat', 'Élections', 'Football'],
};
const int = (n: number) => n.toLocaleString('fr-FR');
const fmt = (iso: string) => new Intl.DateTimeFormat('fr-FR', { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

/* ---------- Données : Supabase, ou démo en mémoire ---------- */
let demoConf = DEFAULTS;
let demoStats: Stats = {
  followers: 412, follows: 1036, phones: 351, alerts_today: 188, alerts_7: 1420,
  topics: [
    { topic: 'Ukraine', followable: true, active: true, followers: 214, alerts_7: 520, items_30: 41 },
    { topic: 'Budget', followable: true, active: true, followers: 167, alerts_7: 310, items_30: 22 },
    { topic: 'IA', followable: true, active: true, followers: 151, alerts_7: 260, items_30: 35 },
    { topic: 'Football', followable: true, active: true, followers: 133, alerts_7: 190, items_30: 48 },
    { topic: 'Climat', followable: true, active: true, followers: 98, alerts_7: 140, items_30: 17 },
    { topic: 'Sécurité', followable: false, active: true, followers: 0, alerts_7: 0, items_30: 26 },
  ],
  recent: [
    { topic: 'Ukraine', title: 'Sommet à Kiev sur la paix', at: new Date(Date.now() - 40 * 60e3).toISOString(), readers: 198 },
    { topic: 'Budget', title: 'Le budget adopté au Parlement', at: new Date(Date.now() - 3 * 3600e3).toISOString(), readers: 151 },
  ],
};
const ok = <T,>(r: { data: T | null; error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); return r.data as T; };
const real = (sb: SupabaseClient) => ({
  conf: async () => ({ ...DEFAULTS, ...(ok(await sb.rpc('follow_conf')) as FollowConf) }),
  saveConf: (c: FollowConf | null) => api.setSetting('FOLLOW', c ? JSON.stringify(c) : ''),
  stats: async () => ok(await sb.rpc('follow_stats')) as Stats,
  async setFollowable(topic: string, on: boolean) { ok(await sb.from('algo_keywords').update({ followable: on }).eq('label', topic)); },
});
const data = sb ? real(sb) : {
  conf: async () => demoConf,
  async saveConf(c: FollowConf | null) { demoConf = c ?? DEFAULTS; },
  stats: async () => demoStats,
  async setFollowable(topic: string, on: boolean) { demoStats = { ...demoStats, topics: demoStats.topics.map((t) => (t.topic === topic ? { ...t, followable: on } : t)) }; },
};

export function FollowPage({ say }: { say: (m: string) => void }) {
  const [c, setC] = useState<FollowConf | null>(null);
  const [s, setS] = useState<Stats | null>(null);
  const [busy, setBusy] = useState(false);
  const [sugg, setSugg] = useState('');
  const loadStats = () => data.stats().then(setS).catch((e) => say(e.message));
  useEffect(() => {
    data.conf().then((x) => { setC(x); setSugg(x.suggested.join(', ')); }).catch((e) => say(e.message));
    loadStats();
  }, []);
  if (!c) return <p className="muted">Chargement…</p>;
  const set = <K extends keyof FollowConf>(k: K, v: FollowConf[K]) => setC({ ...c, [k]: v });
  const num = (k: keyof FollowConf, label: string, help: string, unit = '') => (
    <label key={k}>{label}
      <span className="check"><input type="number" min={0} value={Number(c[k])} onChange={(e) => set(k, Number(e.target.value) as never)} style={{ maxWidth: 120 }} />{unit ? <span className="muted small">{unit}</span> : null}</span>
      <span className="muted small" style={{ fontWeight: 400 }}>{help}</span>
    </label>
  );
  const save = async (next: FollowConf | null) => {
    if (next) {
      next = { ...next, suggested: sugg.split(',').map((x) => x.trim()).filter(Boolean) };
      if ([next.quiet_start, next.quiet_end].some((h) => h < 0 || h > 24)) return say('Les heures calmes vont de 0 à 24 h.');
      if (next.max_follows < 1 || next.max_per_day < 0 || next.timeline_max < 1 || next.timeline_days < 1) return say('Vérifiez les nombres : ils doivent être positifs.');
    }
    setBusy(true);
    try {
      await data.saveConf(next);
      const v = next ?? DEFAULTS;
      setC(v); setSugg(v.suggested.join(', '));
      say(next ? 'Réglages enregistrés : ils s’appliquent dès le prochain passage du moteur.' : 'Valeurs par défaut rétablies.');
    } catch (e) { say(e instanceof Error ? e.message : 'Enregistrement impossible'); }
    finally { setBusy(false); }
  };
  const example = (t: string) => t.replaceAll('{sujet}', 'Ukraine').replaceAll('{titre}', 'Sommet à Kiev sur la paix');
  return (
    <>
      <header className="head">
        <div>
          <div className="eyebrow">Lecteurs</div>
          <h1>Sujets suivis</h1>
          <p className="muted">Le lecteur suit un sujet (« Ukraine », « Budget »…) depuis un article ou depuis ses réglages. Il reçoit une alerte quand le sujet bouge et voit sa frise : toutes les infos et Dernière minute qui en parlent. Les sujets sont les mots-clés de Lecteurs &gt; Algorithme. Jamais d'alerte pour un sujet sensible.</p>
        </div>
      </header>

      {s ? (
        <div className="tiles">
          <div className="panel tile"><div className="muted small">Lecteurs qui suivent un sujet</div><div className="tile-v">{int(s.followers)}</div></div>
          <div className="panel tile"><div className="muted small">Sujets suivis (au total)</div><div className="tile-v">{int(s.follows)}</div></div>
          <div className="panel tile"><div className="muted small">Téléphones qui acceptent les alertes</div><div className="tile-v">{int(s.phones)}</div></div>
          <div className="panel tile"><div className="muted small">Alertes aujourd'hui · 7 jours</div><div className="tile-v">{int(s.alerts_today)} · {int(s.alerts_7)}</div></div>
        </div>
      ) : null}

      <section className="panel settings">
        <h2>Suivi</h2>
        <label className="check"><input type="checkbox" checked={c.enabled} onChange={(e) => set('enabled', e.target.checked)} /> Les lecteurs peuvent suivre des sujets</label>
        <div className="row2" style={{ alignItems: 'start' }}>
          {num('max_follows', 'Sujets suivis au plus', 'Par lecteur.', 'sujets')}
          <label>Sujets proposés en premier
            <input value={sugg} onChange={(e) => setSugg(e.target.value)} placeholder="Ukraine, Budget, IA" />
            <span className="muted small" style={{ fontWeight: 400 }}>Séparés par des virgules. Un sujet qui n'est pas un mot-clé actif n'apparaît pas.</span>
          </label>
        </div>
      </section>

      <section className="panel settings">
        <h2>Alertes</h2>
        <label className="check"><input type="checkbox" checked={c.alerts} onChange={(e) => set('alerts', e.target.checked)} /> Envoyer une alerte quand un sujet suivi bouge</label>
        <label className="check"><input type="checkbox" checked={c.flashes} onChange={(e) => set('flashes', e.target.checked)} /> Les infos Dernière minute déclenchent aussi une alerte</label>
        <div className="row2" style={{ alignItems: 'start' }}>
          {num('min_importance', 'Importance minimum de l’info', 'Note de 1 à 10 donnée par l’IA ou la rédaction.', '/ 10')}
          {num('max_per_day', 'Alertes par lecteur et par jour', 'Tous sujets confondus. Une seule par passage du moteur.', 'au plus')}
          {num('cooldown_hours', 'Délai entre deux alertes du même sujet', 'Évite une rafale sur un sujet chaud.', 'heures')}
          {num('lookback_hours', 'Une info alerte pendant', 'Après sa publication. Au-delà, elle ne part plus.', 'heures')}
          {num('quiet_start', 'Heures calmes : à partir de', 'Heure de Paris. Aucune alerte, et une info publiée pendant ces heures n’en déclenche pas (l’édition du matin a déjà sa notification).', 'h')}
          {num('quiet_end', 'Heures calmes : jusqu’à', 'Même valeur au début et à la fin : pas d’heures calmes.', 'h')}
        </div>
        <div className="row2" style={{ alignItems: 'start' }}>
          <label>Titre de l'alerte<input value={c.alert_title} maxLength={120} onChange={(e) => set('alert_title', e.target.value)} />
            <span className="muted small" style={{ fontWeight: 400 }}>{'{sujet}'} = le sujet suivi, {'{titre}'} = le titre de l'info. Exemple : « {example(c.alert_title)} »</span></label>
          <label>Texte de l'alerte<input value={c.alert_body} maxLength={240} onChange={(e) => set('alert_body', e.target.value)} />
            <span className="muted small" style={{ fontWeight: 400 }}>Exemple : « {example(c.alert_body)} »</span></label>
        </div>
        <p className="muted small">Les alertes partent à chaque passage du moteur (mises à jour de la journée et Dernière minute). Elles demandent l'app installée sur le téléphone (pas la version web) et l'accord du lecteur. Une info marquée « sujet sensible » n'envoie jamais d'alerte.</p>
      </section>

      <section className="panel settings">
        <h2>Frise</h2>
        <div className="row2" style={{ alignItems: 'start' }}>
          {num('timeline_days', 'Remonter jusqu’à', 'Ancienneté des infos montrées dans la frise.', 'jours')}
          {num('timeline_max', 'Étapes au plus', 'Les plus récentes.', 'infos')}
        </div>
      </section>

      <div className="actions">
        <button className="btn primary" disabled={busy} onClick={() => save(c)}>Enregistrer</button>
        <button className="btn ghost" disabled={busy} onClick={() => save(null)}>Revenir aux valeurs par défaut</button>
      </div>

      {s ? (
        <>
          <h2 style={{ marginTop: 32 }}>Sujets</h2>
          <p className="muted small">Décochez « Proposé » pour qu'un mot-clé serve à l'algorithme sans pouvoir être suivi (ses lecteurs ne reçoivent plus d'alerte). Pour ajouter un sujet : Lecteurs &gt; Algorithme &gt; Mots-clés.</p>
          <table className="table">
            <thead><tr><th>Sujet</th><th>Lecteurs</th><th>Alertes (7 j)</th><th>Infos (30 j)</th><th>Proposé</th></tr></thead>
            <tbody>
              {s.topics.map((t) => (
                <tr key={t.topic} className={t.followable && t.active ? '' : 'off'}>
                  <td><b>{t.topic}</b>{t.active ? null : <span className="muted small"> · mot-clé inactif</span>}</td>
                  <td>{int(t.followers)}</td><td>{int(t.alerts_7)}</td><td>{int(t.items_30)}</td>
                  <td><input type="checkbox" checked={t.followable} onChange={(e) => data.setFollowable(t.topic, e.target.checked).then(() => { say(e.target.checked ? `${t.topic} peut être suivi` : `${t.topic} n'est plus proposé au suivi`); loadStats(); }).catch((x) => say(x.message))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <h2 style={{ marginTop: 32 }}>Dernières alertes</h2>
          {s.recent.length ? (
            <table className="table">
              <thead><tr><th>Quand</th><th>Sujet</th><th>Info</th><th>Lecteurs prévenus</th></tr></thead>
              <tbody>{s.recent.map((r, i) => <tr key={i}><td>{fmt(r.at)}</td><td>{r.topic}</td><td>{r.title}</td><td>{int(r.readers)}</td></tr>)}</tbody>
            </table>
          ) : <p className="muted">Aucune alerte ces 7 derniers jours.</p>}
        </>
      ) : null}
    </>
  );
}
