import React from 'react';
import { Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { C, F, GRAD, GRAD3 } from './theme';
import { BRAND } from './brand';

/* ---------- Icônes (traits fins, style Lucide) ---------- */
type IconName = 'up' | 'down' | 'cmt' | 'share' | 'flag' | 'book' | 'gear' | 'send' | 'smile' | 'close';
const PATHS: Record<IconName, string> = {
  close: 'M18 6 6 18M6 6l12 12',
  up: 'M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3zm0 0 4-8a3 3 0 0 1 3 3v4h5.5a2 2 0 0 1 2 2.3l-1.4 8a2 2 0 0 1-2 1.7H7',
  down: 'M17 14V3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-3zm0 0-4 8a3 3 0 0 1-3-3v-4H4.5a2 2 0 0 1-2-2.3l1.4-8a2 2 0 0 1 2-1.7H17',
  cmt: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z',
  share: 'M12 3v13M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5',
  flag: 'M5 21V4m0 0h11l-2 4 2 4H5',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5zM8 7h7',
  gear: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  send: 'M5 12h14M13 6l6 6-6 6',
  smile: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM8 14.5s1.5 2 4 2 4-2 4-2M9 9.5h.01M15 9.5h.01',
};
export function Icon({ name, size = 22, color = '#fff', fill = 'none' }: { name: IconName; size?: number; color?: string; fill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d={PATHS[name]} />
      {name === 'gear' ? <Circle cx={12} cy={12} r={3} /> : null}
    </Svg>
  );
}

/* ---------- Logo : trois lignes, comme un titre suivi de son résumé ---------- */
export function Glyph({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Rect x={9} y={11} width={30} height={7} rx={3.5} fill="#fff" />
      <Rect x={9} y={21} width={22} height={7} rx={3.5} fill="#fff" opacity={0.8} />
      <Rect x={9} y={31} width={13} height={7} rx={3.5} fill="#fff" opacity={0.6} />
    </Svg>
  );
}
export function AppIcon({ size = 64, glass = false }: { size?: number; glass?: boolean }) {
  const r = size * 0.27;
  // Logo réglé dans le back office (Personnalisation > Identité) à la place de l'icône dessinée.
  if (BRAND.logo) return <Image source={{ uri: BRAND.logo }} contentFit="cover" style={{ width: size, height: size, borderRadius: r }} accessibilityLabel={BRAND.name} />;
  if (glass)
    return (
      <View style={{ width: size, height: size, borderRadius: r, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
        <Glyph size={size * 0.62} />
      </View>
    );
  return (
    <LinearGradient colors={GRAD3} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: r, alignItems: 'center', justifyContent: 'center' }}>
      <Glyph size={size * 0.62} />
    </LinearGradient>
  );
}

/* ---------- Texte avec <b>gras</b> ---------- */
export function Rich({ text, style, boldStyle }: { text: string; style?: StyleProp<TextStyle>; boldStyle?: StyleProp<TextStyle> }) {
  const parts = text.split(/(<b>.*?<\/b>)/g).filter(Boolean);
  return (
    <Text style={style}>
      {parts.map((p, i) =>
        p.startsWith('<b>') ? (
          <Text key={i} style={[{ fontFamily: F.black }, boldStyle]}>
            {p.slice(3, -4)}
          </Text>
        ) : (
          p
        ),
      )}
    </Text>
  );
}

/* ---------- Bouton : retour au toucher immédiat, à l'appui (pas au relâché) ---------- */
export function Press({ style, children, scaleTo = 0.97, ...rest }: PressableProps & { style?: StyleProp<ViewStyle>; children: React.ReactNode; scaleTo?: number }) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        s.value = withTiming(scaleTo, { duration: 100, easing: Easing.bezier(0.23, 1, 0.32, 1) });
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.value = withTiming(1, { duration: 160, easing: Easing.bezier(0.23, 1, 0.32, 1) });
        rest.onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, a]}>{children}</Animated.View>
    </Pressable>
  );
}

export function GradButton({ label, onPress, disabled, style, icon }: { label: string; onPress: () => void; disabled?: boolean; style?: StyleProp<ViewStyle>; icon?: React.ReactNode }) {
  return (
    <Press onPress={onPress} disabled={disabled} style={[{ opacity: disabled ? 0.4 : 1 }, style]} accessibilityRole="button" accessibilityLabel={label}>
      <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.grad}>
        {icon}
        <Text style={st.gradTxt}>{label}</Text>
      </LinearGradient>
    </Press>
  );
}
export function SoftButton({ label, onPress, style }: { label: string; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Press onPress={onPress} style={[st.soft, style]} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={st.softTxt}>{label}</Text>
    </Press>
  );
}

export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Press onPress={onPress} scaleTo={0.94} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={label}>
      {on ? (
        <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.chip}>
          <Text style={[st.chipTxt, { color: '#fff' }]}>{label}</Text>
        </LinearGradient>
      ) : (
        <View style={[st.chip, { borderWidth: 1, borderColor: C.line }]}>
          <Text style={st.chipTxt}>{label}</Text>
        </View>
      )}
    </Press>
  );
}

export function Toggle({ on, onPress, label }: { on: boolean; onPress: () => void; label: string }) {
  const x = useSharedValue(on ? 20 : 0);
  React.useEffect(() => {
    x.value = withTiming(on ? 20 : 0, { duration: 260, easing: Easing.bezier(0.23, 1, 0.32, 1) });
  }, [on]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <Pressable onPress={onPress} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={label} hitSlop={8}>
      <View style={[st.sw, { backgroundColor: on ? C.violet : 'rgba(255,255,255,0.18)' }]}>
        <Animated.View style={[st.knob, knob]} />
      </View>
    </Pressable>
  );
}

export const st = StyleSheet.create({
  grad: { height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 22 },
  gradTxt: { color: '#fff', fontFamily: F.black, fontSize: 16 },
  soft: { height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface2, paddingHorizontal: 18 },
  softTxt: { color: '#fff', fontFamily: F.semi, fontSize: 15 },
  chip: { height: 40, paddingHorizontal: 16, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  chipTxt: { fontFamily: F.semi, fontSize: 14, color: C.text2 },
  sw: { width: 50, height: 30, borderRadius: 15, padding: 3 },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff' },
  label: { fontFamily: F.semi, fontSize: 11, letterSpacing: 1.6, color: C.text3, textTransform: 'uppercase' },
});
