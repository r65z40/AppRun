// Tous les réglages du moteur, modifiables dans le back office (page Réglages).
// Une valeur absente prend la valeur par défaut ci-dessous. La liste des noms autorisés
// est aussi dans la fonction set_setting de la base (migration 0008).

const num = (k: string, def: number, min: number, max: number) => {
  const v = Number(process.env[k] || NaN);
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
};
const on = (k: string, def: boolean) => (process.env[k] ? process.env[k] === '1' : def);
const text = (k: string) => (process.env[k] ?? '').trim().slice(0, 2000);

export const cfg = {
  /** Pause générale : plus aucun passage de l'édition ni de la Dernière minute. */
  paused: () => on('ENGINE_PAUSED', false),

  // IA
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

  // Mises à jour de l'édition au fil de la journée
  liveUpdates: () => on('LIVE_UPDATES', true),
  liveMinImportance: () => num('LIVE_MIN_IMPORTANCE', 6, 1, 10),
  updateWindowHours: () => num('UPDATE_WINDOW_HOURS', 4, 1, 12),
  /** Cartes ajoutées au plus par mise à jour ; 0 = un quart du plafond de l'édition. */
  liveMaxCards: () => num('LIVE_MAX_CARDS', 0, 0, 40),

  // Dernière minute
  flashEnabled: () => on('FLASH_ENABLED', true),
  flashAutoPublish: () => on('FLASH_AUTO_PUBLISH', true),
  flashMinImportance: () => num('FLASH_MIN_IMPORTANCE', 8, 6, 10),
  flashMinSources: () => num('FLASH_MIN_SOURCES', 2, 1, 4),
  flashMaxPerDay: () => num('FLASH_MAX_PER_DAY', 12, 1, 50),
  flashWindowHours: () => num('FLASH_WINDOW_HOURS', 2, 1, 6),

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
        fenetre_mise_a_jour_h: cfg.updateWindowHours(), cartes_max_mise_a_jour: cfg.liveMaxCards() || 'auto',
        depeches_max: cfg.maxItems(), ia_en_parallele: cfg.aiConcurrency(),
      }
    : {
        ...common, active: cfg.flashEnabled(), publication_auto: cfg.flashAutoPublish(), importance_min: cfg.flashMinImportance(),
        medias_min: cfg.flashMinSources(), max_par_jour: cfg.flashMaxPerDay(), fenetre_h: cfg.flashWindowHours(),
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
