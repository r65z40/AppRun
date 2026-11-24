// Tous les réglages du moteur, modifiables dans le back office (page Réglages).
// Une valeur absente prend la valeur par défaut ci-dessous. La liste des noms autorisés
// est aussi dans la fonction set_setting de la base (migration 0008).

const num = (k: string, def: number, min: number, max: number) => {
  const v = Number(process.env[k] || NaN);
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
};
const on = (k: string, def: boolean) => (process.env[k] ? process.env[k] === '1' : def);
const text = (k: string) => (process.env[k] ?? '').trim().slice(0, 2000);

function pauseState(): { paused: boolean; until: Date | null } {
  const v = (process.env.ENGINE_PAUSED ?? '').trim();
  if (!v || v === '0') return { paused: false, until: null };
  if (v === '1') return { paused: true, until: null };
  const t = new Date(v);
  // Valeur illisible : on ne bloque pas le moteur pour rien.
  if (Number.isNaN(t.getTime())) return { paused: false, until: null };
  return { paused: t.getTime() > Date.now(), until: t };
}

export const cfg = {
  /**
   * Pause générale : plus aucun passage de l'édition ni de la Dernière minute.
   * Valeur « 1 » = jusqu'à ce qu'on relance ; une date = reprise automatique à cette heure-là.
   */
  paused: () => pauseState().paused,
  pauseUntil: () => pauseState().until,

  // IA
  /** Interrupteur général : plus aucun appel à Claude, nulle part. */
  aiOff: () => on('AI_OFF', false),
  /** Plafonds de dépense en dollars ; 0 = sans limite. */
  budgetDay: () => num('AI_BUDGET_DAY', 0, 0, 10000),
  budgetMonth: () => num('AI_BUDGET_MONTH', 0, 0, 100000),
  /** Plafond d'un seul passage, en dollars ; 0 = sans limite. */
  budgetRun: () => num('AI_BUDGET_RUN', 0, 0, 1000),
  /** Alerte (journal et bandeau du back office) à ce pourcentage d'un plafond. */
  budgetAlert: () => num('AI_BUDGET_ALERT', 80, 50, 99),
  /** Anti-boucle : appels à Claude au plus par passage. */
  maxCalls: () => num('AI_MAX_CALLS', 200, 10, 1000),
  effort: () => (['low', 'medium', 'high'].includes(process.env.TITRE_EFFORT ?? '') ? process.env.TITRE_EFFORT : 'medium') as 'low' | 'medium' | 'high',
  guidelines: () => text('AI_GUIDELINES'),
  avoid: () => text('AI_AVOID'),

  // Cœur des infos : lecture des sources et rythme de l'IA
  aiConcurrency: () => num('AI_CONCURRENCY', 4, 1, 8),
  maxItems: () => num('MAX_ITEMS', 400, 50, 800),
  sourceMaxFails: () => num('SOURCE_MAX_FAILS', 10, 0, 100),
  rawRetentionDays: () => num('RAW_RETENTION_DAYS', 14, 2, 90),
  fetchTimeout: () => num('FETCH_TIMEOUT', 15, 5, 60),

  // Édition : sélection
  windowHours: () => num('WINDOW_HOURS', 30, 6, 48),
  perRubric: () => num('PER_RUBRIC', 8, 1, 20),
  maxCards: () => num('MAX_CARDS', 40, 1, 120),
  maxEssential: () => num('MAX_ESSENTIAL', 4, 0, 10),
  minImportance: () => num('MIN_IMPORTANCE', 1, 1, 10),
  minSources: () => num('MIN_SOURCES', 1, 1, 4),

  // Édition : écriture et publication
  autoPublish: () => on('AUTO_PUBLISH', true),
  autoFix: () => on('AUTO_FIX', true),
  publishFlagged: () => on('PUBLISH_FLAGGED', false),
  publishMinImportance: () => num('PUBLISH_MIN_IMPORTANCE', 1, 1, 10),
  /** Cartes publiées automatiquement par jour, au plus ; 0 = sans limite. */
  publishMaxPerDay: () => num('PUBLISH_MAX_PER_DAY', 80, 0, 500),

  // Garde-fous de publication : ton neutre, rien d'inventé.
  /** Règles gratuites : mots d'opinion ou sensationnels, chiffres absents des sources. */
  guardRules: () => on('GUARD_RULES', true),
  /** Seconde lecture par l'IA de chaque carte avant publication automatique (coût : un petit appel par carte). */
  guardAiCheck: () => on('GUARD_AI_CHECK', true),
  /** Mots à surveiller en plus de la liste de base, un par ligne. */
  guardWords: () => text('GUARD_WORDS'),

  // Mises à jour de l'édition au fil de la journée
  liveUpdates: () => on('LIVE_UPDATES', true),
  liveMinImportance: () => num('LIVE_MIN_IMPORTANCE', 6, 1, 10),
  updateWindowHours: () => num('UPDATE_WINDOW_HOURS', 4, 1, 12),
  /** Cartes ajoutées au plus par mise à jour ; 0 = un quart du plafond de l'édition. */
  liveMaxCards: () => num('LIVE_MAX_CARDS', 0, 0, 40),
  /** Cartes ajoutées au moins par mise à jour, même sous le seuil d'importance (s'il y a du neuf). 0 = aucune garantie. */
  liveMinCards: () => num('LIVE_MIN_CARDS', 1, 0, 10),

  // Dernière minute
  flashEnabled: () => on('FLASH_ENABLED', true),
  flashAutoPublish: () => on('FLASH_AUTO_PUBLISH', true),
  flashMinImportance: () => num('FLASH_MIN_IMPORTANCE', 8, 6, 10),
  flashMinSources: () => num('FLASH_MIN_SOURCES', 2, 1, 4),
  flashMaxPerDay: () => num('FLASH_MAX_PER_DAY', 12, 1, 50),
  flashWindowHours: () => num('FLASH_WINDOW_HOURS', 2, 1, 6),
  /** Minimum d'infos par jour : si la journée est en retard sur ce rythme, le seuil d'importance baisse. 0 = jamais. */
  flashMinPerDay: () => num('FLASH_MIN_PER_DAY', 3, 0, 20),
  /** Importance acceptée quand la journée est en retard sur le minimum. */
  flashRelaxImportance: () => num('FLASH_RELAX_IMPORTANCE', 6, 4, 9),

  // Modération : l'IA tranche les commentaires signalés.
  aiModeration: () => process.env.MODERATION !== 'words', // 'both' (défaut), 'words' ou 'ai'
};

/** Photo des réglages utilisés, gardée dans le journal de chaque passage. */
export function snapshot(kind: 'edition' | 'flash') {
  const common = { modele: process.env.TITRE_MODEL || 'claude-opus-5-5', effort: cfg.effort(), consignes: cfg.guidelines() || '—', a_eviter: cfg.avoid() || '—' };
  return kind === 'edition'
    ? {
        ...common, fenetre_h: cfg.windowHours(), par_rubrique: cfg.perRubric(), cartes_max: cfg.maxCards(), essentiels_max: cfg.maxEssential(),
        importance_min: cfg.minImportance(), medias_min: cfg.minSources(), pilote_auto: cfg.autoPublish(), autocorrection: cfg.autoFix(),
        publier_alertes: cfg.publishFlagged(), importance_min_publication: cfg.publishMinImportance(),
        mises_a_jour: cfg.liveUpdates(), importance_min_mise_a_jour: cfg.liveMinImportance(),
        fenetre_mise_a_jour_h: cfg.updateWindowHours(), cartes_max_mise_a_jour: cfg.liveMaxCards() || 'auto', cartes_min_mise_a_jour: cfg.liveMinCards(),
        depeches_max: cfg.maxItems(), ia_en_parallele: cfg.aiConcurrency(),
        publications_max_jour: cfg.publishMaxPerDay() || 'sans limite', regles_ton: cfg.guardRules(), relecture_ia: cfg.guardAiCheck(),
      }
    : {
        ...common, active: cfg.flashEnabled(), publication_auto: cfg.flashAutoPublish(), importance_min: cfg.flashMinImportance(),
        medias_min: cfg.flashMinSources(), max_par_jour: cfg.flashMaxPerDay(), fenetre_h: cfg.flashWindowHours(),
        min_par_jour: cfg.flashMinPerDay(), importance_si_retard: cfg.flashRelaxImportance(),
        regles_ton: cfg.guardRules(), relecture_ia: cfg.guardAiCheck(),
      };
}

/** Consignes de la rédaction ajoutées aux instructions de l'IA. */
export function editorialNotes(withAvoid = true): string {
  const g = cfg.guidelines(), a = withAvoid ? cfg.avoid() : '';
  return [
    g ? `\n\nConsignes de la rédaction (à respecter en priorité, sauf si elles contredisent l'exactitude des faits) :\n${g}` : '',
    a ? `\n\nSujets à écarter (ne les retiens jamais) :\n${a}` : '',
  ].join('');
}
