// Widget « Titre du jour » sur l'écran d'accueil du téléphone (iOS et Android).
// L'app lui envoie l'info principale à chaque chargement de l'édition.
// Jamais un sujet sensible sur l'écran d'accueil (même règle que la notification du matin).
import { BRAND } from './brand';
import { RUBRICS } from './content';
import { C } from './theme';
import { pushWidget } from './widget';

export type WidgetProps = { brand: string; day: string; title: string; bg: string; accent: string };

export function syncWidget(): void {
  const top = RUBRICS.flatMap((r) => r.items)
    .filter((a) => !a.sensitive)
    .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))[0];
  const day = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  try {
    pushWidget({ brand: BRAND.name, day, title: top?.title ?? 'Votre édition du jour est prête.', bg: C.night, accent: C.soft });
  } catch {
    // Pas de widget dans ce build (Expo Go, web) : rien à faire.
  }
}
