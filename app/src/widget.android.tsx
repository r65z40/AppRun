// Widget Android (Jetpack Compose, composants limités). Le dessin ne peut rien lire hors de lui-même : tout passe par les props.
import { createWidget } from 'expo-widgets';
import { Column, Text } from '@expo/ui/jetpack-compose';
import { background, fillMaxSize, paddingAll } from '@expo/ui/jetpack-compose/modifiers';
import type { WidgetProps } from './headline';

const TitreDuJour = (p: WidgetProps) => {
  'widget';
  return (
    <Column verticalArrangement={{ spacedBy: 6 }} modifiers={[fillMaxSize(), background(p.bg), paddingAll(16)]}>
      <Text maxLines={1} color={p.accent} style={{ fontSize: 12, fontWeight: '800' }}>{`${p.brand} · ${p.day}`}</Text>
      <Text maxLines={5} color="#FFFFFF" style={{ fontSize: 16, fontWeight: 'bold' }}>{p.title}</Text>
    </Column>
  );
};

const widget = createWidget<WidgetProps>('TitreDuJour', TitreDuJour);

export function pushWidget(p: WidgetProps): void {
  widget.updateSnapshot(p);
}
