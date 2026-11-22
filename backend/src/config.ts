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

  // Dernière minute
  flashEnabled: () => on('FLASH_ENABLED', true),
  flashAutoPublish: () => on('FLASH_AUTO_PUBLISH', true),
  flashMinImportance: () => num('FLASH_MIN_IMPORTANCE', 8, 6, 10),
  flashMinSources: () => num('FLASH_MIN_SOURCES', 2, 1, 4),
  flashMaxPerDay: () => num('FLASH_MAX_PER_DAY', 12, 1, 50),

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
      }
    : {
        ...common, active: cfg.flashEnabled(), publication_auto: cfg.flashAutoPublish(), importance_min: cfg.flashMinImportance(),
        medias_min: cfg.flashMinSources(), max_par_jour: cfg.flashMaxPerDay(),
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
