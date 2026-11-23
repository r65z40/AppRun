// Palette validée dans le cahier des charges (§5.1) : violet / bleu, mode sombre par défaut.
// Les couleurs de base se règlent dans le back office (Personnalisation > Identité) : brand.ts les applique
// au démarrage, avant le premier affichage. Les teintes dérivées (soft, link…) se recalculent avec elles.

/** Mélange deux couleurs #rrggbb (t = 0 : a, t = 1 : b). */
export function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
/** #rrggbb + opacité -> rgba(). */
export function alpha(h: string, o: number): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${o})`;
}

export const BASE = { night: '#0E0B1F', violet: '#7B5CFF', blue: '#3D7BFF', pink: '#C86BFA', coral: '#FF6B8A', like: '#34D399', dislike: '#FF6B8A' };
export type BaseColors = typeof BASE;

const derive = (b: BaseColors) => ({
  ...b,
  night2: mix(b.night, b.violet, 0.1),
  night3: mix(b.night, b.violet, 0.04),
  deep: mix(b.night, '#000000', 0.5),
  soft: mix(b.violet, '#FFFFFF', 0.55), // titres et liens clairs sur fond sombre
  soft2: mix(b.violet, '#FFFFFF', 0.75),
  link: mix(b.blue, '#FFFFFF', 0.78),
  sky: mix(b.blue, '#FFFFFF', 0.25),
  text: '#FFFFFF',
  text2: 'rgba(255,255,255,0.72)',
  text3: 'rgba(255,255,255,0.6)',
  surface: 'rgba(255,255,255,0.08)',
  surface2: 'rgba(255,255,255,0.14)',
  line: 'rgba(255,255,255,0.14)',
});

export const C = derive(BASE);

export const GRAD: [string, string, ...string[]] = [C.violet, C.blue];
export const GRAD3: [string, string, ...string[]] = [C.pink, C.violet, C.blue];

/** Applique une palette (avant le premier affichage : les styles sont calculés à l'import des écrans). */
export function setColors(b: BaseColors) {
  Object.assign(C, derive(b));
  GRAD.splice(0, GRAD.length, C.violet, C.blue);
  GRAD3.splice(0, GRAD3.length, C.pink, C.violet, C.blue);
}

// Une seule famille, trois graisses (§5.2). Réglable dans le back office (Personnalisation > Identité).
export const F = {
  regular: 'Archivo_400Regular',
  semi: 'Archivo_600SemiBold',
  black: 'Archivo_900Black',
};

// Courbes et ressorts (règles Emil Kowalski / Apple).
export const SPRING = { duration: 420, dampingRatio: 1 } as const; // repositionnement, sans rebond
export const SPRING_FLICK = { duration: 420, dampingRatio: 0.82 } as const; // seulement après un lancer
export const DRAWER_MS = 500; // volets : cubic-bezier(0.32, 0.72, 0, 1)
