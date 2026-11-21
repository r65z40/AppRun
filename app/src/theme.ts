// Palette validée dans le cahier des charges (§5.1) : violet / bleu, mode sombre par défaut.
export const C = {
  night: '#0E0B1F',
  night2: '#171233',
  violet: '#7B5CFF',
  blue: '#3D7BFF',
  pink: '#C86BFA',
  coral: '#FF6B8A',
  text: '#FFFFFF',
  text2: 'rgba(255,255,255,0.72)',
  text3: 'rgba(255,255,255,0.6)',
  surface: 'rgba(255,255,255,0.08)',
  surface2: 'rgba(255,255,255,0.14)',
  line: 'rgba(255,255,255,0.14)',
};

export const GRAD = [C.violet, C.blue] as const;
export const GRAD3 = [C.pink, C.violet, C.blue] as const;

// Une seule famille, deux graisses principales (§5.2).
export const F = {
  regular: 'Archivo_400Regular',
  semi: 'Archivo_600SemiBold',
  black: 'Archivo_900Black',
};

// Courbes et ressorts (règles Emil Kowalski / Apple).
export const SPRING = { duration: 420, dampingRatio: 1 } as const; // repositionnement, sans rebond
export const SPRING_FLICK = { duration: 420, dampingRatio: 0.82 } as const; // seulement après un lancer
export const DRAWER_MS = 500; // volets : cubic-bezier(0.32, 0.72, 0, 1)
