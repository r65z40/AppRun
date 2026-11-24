import { useRef } from 'react';
import type { SpendDay } from './data';

/*
 * Estimation du coût de l'IA selon les réglages en cours, sans appel à l'IA.
 * Prix Claude par million de jetons (même tarif que run_cost dans la base) ; jetons par appel estimés d'après les
 * consignes et dépêches envoyées par le moteur (backend/src/ai.ts). Calée sur les dépenses réelles quand il y en a.
 */
const PRICE: Record<string, [number, number]> = { opus: [4, 20], sonnet: [2, 10], haiku: [0.1, 0.5] };
const EFFORT: Record<string, number> = { low: 0.6, medium: 1, high: 1.7 }; // la réflexion se paie en jetons écrits
const EUR = 0.86; // shortcut: taux $ → € fixe, à mettre à jour s'il bouge beaucoup
const UPDATES_PER_DAY = 14; // une mise à jour par heure de 9 h à 22 h
const FLASH_RUNS_PER_DAY = 60; // toutes les 10 min de 6 h à 23 h, GitHub en saute une partie, et rien n'est appelé sans dépêche nouvelle

export type Parts = { morning: number; updates: number; flash: number; review: number };

/** Dollars par jour, par poste. get = valeur d'un réglage ('' = défaut). */
export function estimate(get: (k: string) => string): Parts {
  const n = (k: string, d: number) => Number(get(k) || d);
  const on = (k: string, d: boolean) => (get(k) ? get(k) === '1' : d);
  const m = get('TITRE_MODEL') || 'claude-opus-5-5';
  const [pi, po] = PRICE[Object.keys(PRICE).find((p) => m.includes(p)) ?? 'opus'];
  const eff = EFFORT[get('TITRE_EFFORT') || 'medium'] ?? 1;
  const call = (input: number, output: number) => (input * pi + output * po) / 1e6;

  const fix = on('AUTO_FIX', true) ? 1.15 : 1; // environ 15 % des cartes réécrites une fois
  const card = call(3000, 1500 * eff) * fix;
  const check = on('GUARD_AI_CHECK', true) ? call(1500, 300) : 0;

  const cards = Math.min(n('MAX_CARDS', 40), n('PER_RUBRIC', 8) * 10);
  const morning = call(2000 + n('MAX_ITEMS', 400) * 90, (3000 + 60 * cards) * eff) + cards * card;

  const cap = n('LIVE_MAX_CARDS', 0) || Math.max(1, Math.ceil(n('MAX_CARDS', 40) / 4));
  const perUpdate = Math.min(cap, Math.max(n('LIVE_MIN_CARDS', 1), (10 - n('LIVE_MIN_IMPORTANCE', 6)) / 2));
  const live = on('LIVE_UPDATES', true) ? UPDATES_PER_DAY : 0;
  const updates = live * (call(2000 + n('UPDATE_WINDOW_HOURS', 4) * 15 * 90, 2000 * eff) + perUpdate * card);

  const flashOn = on('FLASH_ENABLED', true);
  const items = Math.min(250, n('FLASH_WINDOW_HOURS', 2) * 60);
  const flashes = Math.min(n('FLASH_MAX_PER_DAY', 12), Math.max(n('FLASH_MIN_PER_DAY', 3), 3));
  const flash = flashOn ? FLASH_RUNS_PER_DAY * call(1500 + items * 80, 800) : 0;

  const review = check * (cards + live * perUpdate + (flashOn ? flashes : 0));
  return { morning, updates, flash, review };
}

const eur = (usd: number) => `${(usd * EUR).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const fit = (real: number, est: number) => (real > 0 && est > 0 ? Math.min(10, Math.max(0.1, real / est)) : 1);

export function CostEstimate({ get, history }: { get: (k: string) => string; history: SpendDay[] | null }) {
  const p = estimate(get);
  // Jours complets passés (sans aujourd'hui) : leur moyenne réelle sert à caler l'estimation, édition et Dernière minute à part.
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
  const days = (history ?? []).filter((d) => d.day < today).slice(0, 7);
  const avg = (f: (d: SpendDay) => number) => (days.length ? days.reduce((s, d) => s + f(d), 0) / days.length : 0);
  const realEd = avg((d) => d.edition), realFl = avg((d) => d.flash);
  // Calage figé à l'ouverture de la page : un réglage changé ensuite fait bouger l'estimation à partir du réel.
  const k = useRef<{ ed: number; fl: number } | null>(null);
  if (!k.current && history) k.current = days.length >= 3 ? { ed: fit(realEd, p.morning + p.updates + p.review), fl: fit(realFl, p.flash) } : { ed: 1, fl: 1 };
  const { ed, fl } = k.current ?? { ed: 1, fl: 1 };
  const parts: [string, number][] = [['Édition du matin', p.morning * ed], ['Mises à jour', p.updates * ed], ['Dernière minute', p.flash * fl], ['Seconde lecture', p.review * ed]];
  const day = parts.reduce((s, [, v]) => s + v, 0);
  return (
    <section className="panel settings">
      <h2>Coût estimé avec ces réglages</h2>
      <p>Environ <b>{eur(day)} par jour</b>, soit <b>{eur(day * 30)} par mois</b> <span className="muted">(entre {eur(day * 30 * 0.7)} et {eur(day * 30 * 1.5)} selon l’actualité)</span>.</p>
      <p className="small cost-parts">{parts.filter(([, v]) => v > 0.005).map(([l, v]) => <span key={l}>{l} <b>{eur(v)}</b></span>)}</p>
      <p className="muted small">
        {days.length ? <>Réel : <b>{eur(realEd + realFl)} par jour</b> en moyenne sur les {days.length} derniers jours{days.length >= 3 ? ', estimation calée dessus' : ''}. </> : 'Pas encore de dépense réelle : estimation d’après le fonctionnement du moteur. '}
        Recalculée à chaque réglage changé (onglets Pilotage, Édition, Dernière minute). Prix Claude en dollars, convertis à {String(EUR).replace(".", ",")} € le dollar ; la facture exacte est sur console.anthropic.com.
      </p>
    </section>
  );
}
