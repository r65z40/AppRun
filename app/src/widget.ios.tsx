// Widget iPhone (SwiftUI). Le dessin ne peut rien lire hors de lui-même : tout passe par les props.
import { createWidget } from 'expo-widgets';
import { Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, frame, lineLimit } from '@expo/ui/swift-ui/modifiers';
import type { WidgetProps } from './headline';

const TitreDuJour = (p: WidgetProps) => {
  'widget';
  return (
    <VStack alignment="leading" spacing={6} modifiers={[frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' }), containerBackground(p.bg, 'widget')]}>
      <Text modifiers={[font({ size: 11, weight: 'heavy' }), foregroundStyle(p.accent), lineLimit(1)]}>{`${p.brand} · ${p.day}`}</Text>
      <Text modifiers={[font({ size: 16, weight: 'bold' }), foregroundStyle('#FFFFFF'), lineLimit(5)]}>{p.title}</Text>
      <Spacer />
    </VStack>
  );
};

const widget = createWidget<WidgetProps>('TitreDuJour', TitreDuJour);

export function pushWidget(p: WidgetProps): void {
  widget.updateSnapshot(p);
}
