// Ressenti (§6) : vibration et son partent au même moment que l'animation.
import * as Haptics from 'expo-haptics';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

export type Sound = 'tick' | 'pop' | 'thud' | 'whoosh' | 'ding' | 'chord' | 'soft';
export type Haptic = 'light' | 'medium' | 'select' | 'success' | null;

const SOURCES: Record<Sound, number> = {
  tick: require('../assets/sounds/tick.wav'),
  pop: require('../assets/sounds/pop.wav'),
  thud: require('../assets/sounds/thud.wav'),
  whoosh: require('../assets/sounds/whoosh.wav'),
  ding: require('../assets/sounds/ding.wav'),
  chord: require('../assets/sounds/chord.wav'),
  soft: require('../assets/sounds/soft.wav'),
};

let players: Partial<Record<Sound, AudioPlayer>> = {};
export const prefs = { sound: true, haptic: true };

export async function initFeel() {
  try {
    // Les sons respectent le mode silencieux du téléphone et se mêlent à la musique en cours sans la couper.
    await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' });
  } catch {}
  (Object.keys(SOURCES) as Sound[]).forEach((k) => {
    try {
      const p = createAudioPlayer(SOURCES[k]);
      p.volume = 0.6;
      players[k] = p;
    } catch {}
  });
}

export function feel(haptic: Haptic, sound?: Sound | null) {
  if (prefs.haptic && haptic) {
    if (haptic === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    else if (haptic === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    else if (haptic === 'select') Haptics.selectionAsync().catch(() => {});
    else if (haptic === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }
  if (prefs.sound && sound) {
    const p = players[sound];
    if (p) {
      try {
        p.seekTo(0);
        p.play();
      } catch {}
    }
  }
}
