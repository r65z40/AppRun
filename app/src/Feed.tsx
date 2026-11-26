import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Linking, Platform, StyleSheet, Text, View, Pressable, type AccessibilityActionEvent, type LayoutChangeEvent } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  useReducedMotion,
  cancelAnimation,
  Easing,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, GRAD3, SPRING, SPRING_FLICK, alpha, mix } from './theme';
import { isAd, isArticle, isFlash, type Article, type Card, type Column, type Tag } from './types';
import { rubricOf } from './edition';
import { flashTime } from './dates';
import { PHOTOS } from './content';
import { RULES } from './brand';
import { Icon, Press, Rich } from './ui';
import { feel } from './feel';
import { adHit } from './ads';
import { shareArticle } from './ShareCard';
import type { Signal } from './algo';

const EXT = 140; // les photos débordent sur les côtés pour se fondre entre rubriques
const MAX_COLS = 14; // Mon édition + Dernière minute + 12 rubriques

export type FeedApi = {
  cols: Column[];
  ri: number;
  idx: Record<string, number>;
  seenN: number;
  limit: number;
  reactions: Record<string, -1 | 0 | 1>;
  seen: Set<string>;
  commentCount: (a: Article) => number;
  parallax: boolean;
  tiltX: SharedValue<number>;
  tiltY: SharedValue<number>;
  /** Avant d'afficher une nouvelle info : false si le quota ou la fin de journée l'interdit. */
  canEnter: (c: Card) => boolean;
  /** Bout de colonne atteint en descendant. */
  onEndOfColumn: () => void;
  setPos: (ri: number, colId: string, n: number) => void;
  onRead: (a: Article) => void;
  onComments: (a: Article) => void;
  onReact: (a: Article, v: 1 | -1) => void;
  /** Mode choisi par l'équipe : réactions emoji à la place des commentaires. */
  emojiMode: boolean;
  myEmoji: Record<string, string>;
  onEmoji: (a: Article, e: string | null) => void;
  onToast: (msg: string) => void;
  /** Ce que fait le lecteur, pour l'algorithme « Mon édition » (source, clic, partage). */
  onSignal: (a: Article, k: Signal) => void;
  /** « Moins de sujets comme ça » depuis « Pourquoi cette info ? ». */
  onLess: (a: Article) => void;
  onSettings: () => void;
};

// Le fil est fait d'écrans fixes : le texte y grandit avec le réglage du téléphone, jusqu'à +30 %.
// Le résumé (« Lire ») et les réglages défilent : là, il grandit sans limite.
const MAX_SCALE = 1.3;

/* Projection de l'élan (Apple, « Designing Fluid Interfaces ») */
function project(v: number) {
  'worklet';
  return ((v / 1000) * 0.998) / (1 - 0.998);
}
function rubber(over: number, dim: number) {
  'worklet';
  return (over * dim * 0.55) / (dim + 0.55 * Math.abs(over));
}

export function Feed(p: FeedApi & { W: number; H: number }) {
  const { W, H, cols } = p;
  const insets = useSafeAreaInsets();

  // Un ressort horizontal (rubriques) et un ressort vertical par rubrique.
  const colX = useSharedValue(-p.ri * W);
  const y0 = useSharedValue(0), y1 = useSharedValue(0), y2 = useSharedValue(0), y3 = useSharedValue(0);
  const y4 = useSharedValue(0), y5 = useSharedValue(0), y6 = useSharedValue(0), y7 = useSharedValue(0);
  const y8 = useSharedValue(0), y9 = useSharedValue(0), y10 = useSharedValue(0), y11 = useSharedValue(0);
  const y12 = useSharedValue(0), y13 = useSharedValue(0);
  const ys = [y0, y1, y2, y3, y4, y5, y6, y7, y8, y9, y10, y11, y12, y13].slice(0, MAX_COLS);

  // Ce que le fil du geste (thread UI) doit savoir de l'état.
  const sRi = useSharedValue(p.ri);
  const sCount = useSharedValue(cols[p.ri]?.cards.length ?? 1);
  const sIdx = useSharedValue(p.idx[cols[p.ri]?.id] ?? 0);
  const sCols = useSharedValue(cols.length);
  const axis = useSharedValue(0);
  const start = useSharedValue({ x: 0, y: 0 });

  useEffect(() => {
    sRi.value = p.ri;
    sCount.value = cols[p.ri]?.cards.length ?? 1;
    sIdx.value = p.idx[cols[p.ri]?.id] ?? 0;
    sCols.value = cols.length;
  }, [p.ri, p.idx, cols]);

  // Reconstruction du fil (réglages) : on replace tout sans animation.
  const colsKey = cols.map((c) => c.id + c.cards.length).join('|');
  useEffect(() => {
    colX.value = -p.ri * W;
    cols.forEach((c, ci) => {
      if (ys[ci]) ys[ci].value = -(p.idx[c.id] ?? 0) * H;
    });
  }, [colsKey, W, H]);

  const latest = useRef(p);
  latest.current = p;

  function releaseY(n: number, v: number) {
    const q = latest.current;
    const col = q.cols[q.ri];
    const i = q.idx[col.id] ?? 0;
    const yv = ys[q.ri];
    if (n >= col.cards.length) {
      yv.value = withSpring(-i * H, { ...SPRING, velocity: v });
      q.onEndOfColumn();
      return;
    }
    if (n > i && !q.canEnter(col.cards[n])) {
      yv.value = withSpring(-i * H, { ...SPRING, velocity: v });
      return;
    }
    yv.value = withSpring(-n * H, { ...(Math.abs(v) > 350 ? SPRING_FLICK : SPRING), velocity: v });
    if (n !== i) {
      feel('light'); // la vibration part quand la carte s'accroche
      q.setPos(q.ri, col.id, n);
    }
  }
  function releaseX(n: number, v: number) {
    const q = latest.current;
    if (n < 0 || n >= q.cols.length || n === q.ri) {
      colX.value = withSpring(-q.ri * W, { ...SPRING, velocity: v });
      return;
    }
    goRub(n, v);
  }
  function goRub(n: number, v = 0) {
    const q = latest.current;
    const col = q.cols[n];
    const first = col.cards.findIndex((c) => isArticle(c) && !q.seen.has(c.id));
    if (first >= 0) {
      if (!q.canEnter(col.cards[first])) {
        colX.value = withSpring(-q.ri * W, { ...SPRING, velocity: v });
        return;
      }
      ys[n].value = -first * H;
    }
    colX.value = withSpring(-n * W, { ...(Math.abs(v) > 350 ? SPRING_FLICK : SPRING), velocity: v });
    feel('select', 'tick');
    q.setPos(n, col.id, first >= 0 ? first : q.idx[col.id] ?? 0);
  }

  // Une info plus bas (d = 1) ou plus haut (d = -1), comme le geste : molette, flèches, lecteur d'écran.
  const stepY = (d: number) => { const q = latest.current; releaseY(Math.max(0, (q.idx[q.cols[q.ri].id] ?? 0) + d), 0); };

  // Ordinateur : la molette et les flèches du clavier font comme les gestes, seulement si rien n'est ouvert par-dessus le fil.
  const root = useRef<unknown>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onTop = () => (root.current as unknown as HTMLElement)?.contains(document.elementFromPoint(innerWidth / 2, innerHeight / 2));
    let until = 0;
    const wheel = (e: WheelEvent) => {
      if (!onTop()) return;
      e.stopPropagation(); // sinon le geste du fil prend aussi la molette pour un petit glissé et revient en arrière
      if (Math.abs(e.deltaY) < 15 || Date.now() < until) return;
      until = Date.now() + 700; // un cran de molette = une info, même avec l'élan d'un pavé tactile
      stepY(Math.sign(e.deltaY));
    };
    const key = (e: KeyboardEvent) => {
      if (!onTop() || /INPUT|TEXTAREA/.test((e.target as HTMLElement)?.tagName ?? '')) return;
      const d = { ArrowDown: [0, 1], ArrowUp: [0, -1], ArrowRight: [1, 0], ArrowLeft: [-1, 0] }[e.key];
      if (!d) return;
      e.preventDefault();
      if (d[1]) stepY(d[1]); else releaseX(latest.current.ri + d[0], 0);
    };
    addEventListener('wheel', wheel, true); // en capture, avant le geste du fil
    addEventListener('keydown', key);
    return () => { removeEventListener('wheel', wheel, true); removeEventListener('keydown', key); };
  }, []);

  const pan = usePanGesture({
    minDistance: 10,
    onBegin: () => {
      'worklet';
      const yv = ys[sRi.value];
      cancelAnimation(colX);
      cancelAnimation(yv); // on attrape le fil là où il est
      start.value = { x: colX.value, y: yv.value };
      axis.value = 0;
    },
    onUpdate: (e) => {
      'worklet';
      if (axis.value === 0) {
        if (Math.abs(e.translationX) + Math.abs(e.translationY) < 10) return;
        axis.value = Math.abs(e.translationX) > Math.abs(e.translationY) ? 1 : 2;
      }
      if (axis.value === 2) {
        const i = sIdx.value;
        const lo = -Math.min(sCount.value - 1, i + 1) * H;
        const hi = -Math.max(0, i - 1) * H;
        let raw = start.value.y + e.translationY;
        if (raw > hi) raw = hi + rubber(raw - hi, H);
        else if (raw < lo) raw = lo - rubber(lo - raw, H);
        ys[sRi.value].value = raw;
      } else {
        const r = sRi.value;
        const lo = -Math.min(sCols.value - 1, r + 1) * W;
        const hi = -Math.max(0, r - 1) * W;
        let raw = start.value.x + e.translationX;
        if (raw > hi) raw = hi + rubber(raw - hi, W);
        else if (raw < lo) raw = lo - rubber(lo - raw, W);
        colX.value = raw;
      }
    },
    onDeactivate: (e) => {
      'worklet';
      if (axis.value === 2) {
        const i = sIdx.value;
        const d = -(ys[sRi.value].value + project(e.velocityY)) / H - i;
        let n = i + (d > 0.3 ? 1 : d < -0.3 ? -1 : 0);
        if (n < 0) n = 0;
        scheduleOnRN(releaseY, n, e.velocityY);
      } else if (axis.value === 1) {
        const d = -(colX.value + project(e.velocityX)) / W - sRi.value;
        scheduleOnRN(releaseX, sRi.value + (d > 0.3 ? 1 : d < -0.3 ? -1 : 0), e.velocityX);
      }
    },
  });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: colX.value }] }));

  return (
    <View ref={root as never} style={StyleSheet.absoluteFill}>
      {/* Le geste est posé sur un cadre fixe : la rangée qui glisse sort de l'écran et ne recevrait plus les doigts. */}
      <GestureDetector gesture={pan}>
        <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, rowStyle]}>
          {/* Couche des photos : toutes sous tous les textes, pour un fondu propre */}
          {cols.slice(0, MAX_COLS).map((col, ci) => (
            <ColumnStack key={'bg' + col.id} y={ys[ci]} W={W} H={H} ci={ci}>
              {col.cards.map((c, k) => (
                <Background key={c.id} card={c} k={k} ci={ci} W={W} H={H} colX={colX} y={ys[ci]} tiltX={p.tiltX} tiltY={p.tiltY} parallax={p.parallax} />
              ))}
            </ColumnStack>
          ))}
          {cols.slice(0, MAX_COLS).map((col, ci) => (
            <ColumnStack key={'fg' + col.id} y={ys[ci]} W={W} H={H} ci={ci}>
              {col.cards.map((c, k) => (
                <CardContent key={c.id} card={c} k={k} here={ci === p.ri && k === (p.idx[col.id] ?? 0)} step={stepY} W={W} H={H} tag={col.tags[c.id]} why={col.why?.[c.id]} api={p} bottom={insets.bottom} tiltX={p.tiltX} tiltY={p.tiltY} />
              ))}
            </ColumnStack>
          ))}
        </Animated.View>
        </View>
      </GestureDetector>
      <Header api={p} top={insets.top} W={W} goRub={(n) => goRub(n)} />
    </View>
  );
}

function ColumnStack({ y, W, H, ci, children }: { y: SharedValue<number>; W: number; H: number; ci: number; children: React.ReactNode }) {
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View pointerEvents="box-none" style={[{ position: 'absolute', top: 0, left: ci * W, width: W, height: H }, a]}>
      {children}
    </Animated.View>
  );
}

function Background({ card, k, ci, W, H, colX, y, tiltX, tiltY, parallax }: {
  card: Card; k: number; ci: number; W: number; H: number; colX: SharedValue<number>; y: SharedValue<number>; tiltX: SharedValue<number>; tiltY: SharedValue<number>; parallax: boolean;
}) {
  const photo = isAd(card) ? (card.c.image_url ? { uri: card.c.image_url } : PHOTOS.livre) : isFlash(card) ? null : card.photo;
  const grad = isArticle(card) ? card.grad : isFlash(card) ? FLASH_GRAD : null;
  const a = useAnimatedStyle(() => {
    const ox = ci * W + colX.value;
    const o = k * H + y.value; // position de la carte à l'écran
    const tx = parallax ? tiltX.value : 0;
    const ty = parallax ? tiltY.value : 0;
    return {
      // la photo défile à 40 % de la vitesse du texte, et suit l'inclinaison
      transform: [{ translateX: tx - ox * 0.3 }, { translateY: -o * 0.6 + ty }],
    };
  });
  const fade = useAnimatedStyle(() => {
    const ox = ci * W + colX.value;
    return { opacity: interpolate(Math.abs(ox), [0, W], [1, 0], Extrapolation.CLAMP) };
  });
  return (
    // Le cadre coupe en haut et en bas (une carte par écran) mais déborde sur les côtés
    <Animated.View pointerEvents="none" aria-hidden style={[{ position: 'absolute', top: k * H, left: -EXT, width: W + 2 * EXT, height: H, overflow: 'hidden' }, fade]}>
      <Animated.View style={[{ position: 'absolute', left: -30, right: -30, top: -H * 0.25, bottom: -H * 0.25 }, a]}>
        {photo ? (
          <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={8} />
        ) : (
          <LinearGradient colors={[grad?.[2] ?? C.night2, grad?.[3] ?? C.night]} style={StyleSheet.absoluteFill} />
        )}
        {!photo && grad ? (
          <>
            <View style={[styles.blob, { backgroundColor: grad[0], left: '5%', top: '18%' }]} />
            <View style={[styles.blob, { backgroundColor: grad[1], right: '0%', top: '42%' }]} />
          </>
        ) : null}
        {/* teinte violette, comme dans la charte */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: photo ? 'rgba(40,24,110,0.42)' : 'transparent' }]} />
      </Animated.View>
      <LinearGradient
        colors={[alpha(C.night, 0.6), alpha(C.night, 0), alpha(C.night, 0.25), alpha(C.night, 0.86), C.night]}
        locations={[0, 0.2, 0.38, 0.62, 0.92]}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

function CardContent({ card, k, here, step, W, H, tag, why, api, bottom, tiltX, tiltY }: {
  card: Card; k: number; here: boolean; step: (d: number) => void; W: number; H: number; tag?: Tag; why?: string; api: FeedApi; bottom: number; tiltX: SharedValue<number>; tiltY: SharedValue<number>;
}) {
  // le texte bouge très peu, à l'opposé de la photo : effet de profondeur
  const depth = useAnimatedStyle(() => ({ transform: [{ translateX: -tiltX.value * 0.18 }, { translateY: -tiltY.value * 0.18 }] }));
  const pad = { paddingBottom: Math.max(28, bottom + 14) };
  const [pick, setPick] = useState(false); // choix d'un emoji ouvert
  const [whyOpen, setWhyOpen] = useState(false); // « Pourquoi cette info ? » ouvert
  // Lecteur d'écran (VoiceOver, TalkBack) : seule l'info à l'écran est lue ; on passe à la suivante par les actions du titre.
  const titleRef = useRef<React.ComponentRef<typeof Text>>(null);
  // Seulement si le lecteur d'écran est allumé : sinon cet appel fait parfois planter l'app sur iPhone (glissé, like, retour d'article).
  useEffect(() => {
    if (!here || Platform.OS === 'web') return;
    AccessibilityInfo.isScreenReaderEnabled().then((on) => {
      if (on && titleRef.current) AccessibilityInfo.sendAccessibilityEvent(titleRef.current, 'focus');
    }).catch(() => {});
  }, [here]);
  const nav = {
    ref: titleRef,
    accessibilityActions: [{ name: 'next', label: 'Info suivante' }, { name: 'prev', label: 'Info précédente' }],
    onAccessibilityAction: (e: AccessibilityActionEvent) => step(e.nativeEvent.actionName === 'next' ? 1 : -1),
  };
  const box = [styles.card, { top: k * H, width: W, height: H }];
  if (isFlash(card)) {
    return (
      <View style={box} pointerEvents="box-none" aria-hidden={!here}>
        <Animated.View style={[styles.content, pad, depth]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <LiveDot size={8} />
            <Text maxFontSizeMultiplier={MAX_SCALE} style={styles.kicker}><Text maxFontSizeMultiplier={MAX_SCALE} style={{ color: C.coral }}>EN DIRECT</Text> · {flashTime(card.at).toUpperCase()}</Text>
          </View>
          <Text maxFontSizeMultiplier={MAX_SCALE} style={[styles.title, { marginTop: 14 }]} {...nav}>{card.title}</Text>
          <Text maxFontSizeMultiplier={MAX_SCALE} style={styles.key}>{card.sentence}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 6 }}>
            {card.sources.map((s) => (
              <Pressable key={s.url} onPress={() => (s.url.startsWith('http') ? Linking.openURL(s.url) : api.onToast(`Ouvre l'article : ${s.source}`))} hitSlop={8} accessibilityRole="link">
                <Text maxFontSizeMultiplier={MAX_SCALE} style={styles.flashSrc}>{s.source} ↗</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </View>
    );
  }
  if (isAd(card)) {
    return (
      <View style={box} pointerEvents="box-none" aria-hidden={!here}>
        <Animated.View style={[styles.content, pad, depth]}>
          <Text maxFontSizeMultiplier={MAX_SCALE} style={styles.kicker}>SPONSORISÉ · {card.c.advertiser.toUpperCase()}</Text>
          <Text maxFontSizeMultiplier={MAX_SCALE} style={styles.title} {...nav}>{card.c.title.toUpperCase()}</Text>
          {card.c.body ? <Text maxFontSizeMultiplier={MAX_SCALE} style={styles.key}>{card.c.body}</Text> : null}
          <Press
            onPress={() => {
              if (!card.c.url) return api.onToast("Ouvre le site de l'annonceur");
              adHit(card, true);
              Linking.openURL(card.c.url).catch(() => api.onToast('Lien indisponible'));
            }}
            style={styles.adCta}
          >
            <Text maxFontSizeMultiplier={MAX_SCALE} style={{ color: '#fff', fontFamily: F.semi, fontSize: 15 }}>{card.c.cta}</Text>
          </Press>
        </Animated.View>
      </View>
    );
  }
  const a = card;
  const r = api.reactions[a.id] ?? 0;
  const mine = api.myEmoji[a.id];
  const emo = (e: string) => (a.emojis?.[e] ?? 0) + (mine === e ? 1 : 0);
  const emoTotal = RULES.emojis.reduce((n, e) => n + emo(e), 0);
  return (
    <View style={box} pointerEvents="box-none" aria-hidden={!here}>
      <Animated.View style={[styles.content, pad, depth]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text maxFontSizeMultiplier={MAX_SCALE} style={styles.kicker}>{rubricOf(a).name.toUpperCase()}</Text>
          {tag ? (
            <Pressable onPress={() => { setWhyOpen(!whyOpen); feel('select'); }} hitSlop={10} accessibilityRole="button" accessibilityLabel="Pourquoi cette info ?" style={{ marginLeft: 'auto' }}>
              <Text maxFontSizeMultiplier={MAX_SCALE} style={styles.whyLink}>Pourquoi ?</Text>
            </Pressable>
          ) : null}
        </View>
        {whyOpen ? (
          <View style={styles.whyBox}>
            <Text maxFontSizeMultiplier={MAX_SCALE} style={styles.whyTxt}>{why ?? 'Choisie pour votre édition du jour.'}</Text>
            {tag !== 'ess' ? (
              <Pressable onPress={() => { setWhyOpen(false); api.onLess(a); }} hitSlop={8} accessibilityRole="button">
                <Text maxFontSizeMultiplier={MAX_SCALE} style={styles.whyLess}>Moins de sujets comme ça</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {/* Toucher le grand titre (ou la phrase clé) ouvre l'article, comme le bouton « Lire ». */}
        <Text maxFontSizeMultiplier={MAX_SCALE} style={styles.title} onPress={() => api.onRead(a)} suppressHighlighting accessibilityRole="button" accessibilityHint="Ouvre le résumé de l'info" {...nav}>{a.title.toUpperCase()}</Text>
        <Text maxFontSizeMultiplier={MAX_SCALE} style={styles.key} onPress={() => api.onRead(a)} suppressHighlighting>{a.key}</Text>
        {/* Sans fait (aucun n'apportait d'info nouvelle), un peu d'air entre la phrase clé et les boutons. */}
        <View style={!a.facts.length && { height: 16 }}>
          {a.facts.map((f, i) => (
            <FactRow key={i} text={f.text} source={f.source} doc={f.doc} last={i === a.facts.length - 1} onFlip={() => api.onSignal(a, 'source')} onSource={() => { api.onSignal(a, 'click'); if (/^https?:\/\//.test(f.doc)) Linking.openURL(f.doc).catch(() => api.onToast('Lien indisponible')); else api.onToast('Ouverture de la source officielle'); }} />
          ))}
        </View>
        <View style={styles.actions}>
          {pick ? (
            <EmojiPicker mine={mine} count={emo} onPick={(e) => { setPick(false); api.onEmoji(a, e === mine ? null : e); }} />
          ) : null}
          <Press onPress={() => api.onRead(a)} accessibilityLabel="Lire le résumé, 1 minute" style={[styles.read, { marginRight: 'auto' }]}>
            <Text maxFontSizeMultiplier={MAX_SCALE} style={styles.readTxt}>Lire · 1 min</Text>
          </Press>
          <ReactBtn icon="up" n={a.likes + (r === 1 ? 1 : 0)} on={r === 1} color={C.like} ratio={shares(a, r).up} onPress={() => api.onReact(a, 1)} label="J'aime" />
          <ReactBtn icon="down" on={r === -1} color={C.dislike} ratio={shares(a, r).down} onPress={() => api.onReact(a, -1)} label="Je n'aime pas" />
          {api.emojiMode ? (
            <Press onPress={() => { setPick(!pick); feel('select'); }} style={styles.ic} accessibilityLabel="Réagir avec un emoji">
              {mine ? <Text maxFontSizeMultiplier={MAX_SCALE} style={{ fontSize: 20 }}>{mine}</Text> : <Icon name="smile" size={20} />}
              <Text maxFontSizeMultiplier={MAX_SCALE} style={styles.icTxt}>{emoTotal}</Text>
            </Press>
          ) : (
            <Press onPress={() => api.onComments(a)} style={styles.ic} accessibilityLabel="Commentaires">
              <Icon name="cmt" size={20} />
              <Text maxFontSizeMultiplier={MAX_SCALE} style={styles.icTxt}>{api.commentCount(a)}</Text>
            </Press>
          )}
          <Press onPress={() => { feel('light'); onShare(a, api); }} style={styles.ic} accessibilityLabel="Partager en image">
            <Icon name="share" size={20} />
          </Press>
        </View>
      </Animated.View>
    </View>
  );
}

/** Partage : carte image (ShareCard.tsx), sinon texte ; le signal ne part que si l'info a vraiment été envoyée. */
async function onShare(a: Article, api: FeedApi) {
  const r = await shareArticle(a);
  if (r === 'cancel') return;
  api.onSignal(a, 'share');
  if (r === 'download') api.onToast('Image téléchargée : prête à publier');
  else if (r === 'copied') api.onToast("Titre et lien de l'info copiés");
}

/**
 * Part des lecteurs qui ont vu l'info et l'ont aimée (up) ou pas (down), vote du lecteur compris.
 * 100 % des lecteurs aiment : pouce plein ; la moitié : pouce rempli à moitié.
 */
export function shares(a: Article, r: number) {
  const up = a.likes + (r === 1 ? 1 : 0);
  const down = (a.dislikes ?? 0) + (r === -1 ? 1 : 0);
  const seen = Math.max(a.views ?? 0, up + down, 1);
  return { up: up / seen, down: down / seen };
}

/**
 * Like / dislike : le pouce s'écrase puis rebondit, une gerbe d'éclats part autour (vers le haut pour un like,
 * vers le bas pour un dislike) et un anneau s'élargit. Annuler son vote : le pouce se contracte simplement.
 */
export function ReactBtn({ icon, n, on, color, ratio, onPress, label, row }: { icon: 'up' | 'down'; n?: number; on: boolean; color: string; ratio: number; onPress: () => void; label: string; row?: boolean }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(1);
  const rot = useSharedValue(0);
  const burst = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }, { rotate: `${rot.value}deg` }] }));
  const ring = useAnimatedStyle(() => ({ opacity: burst.value < 1 ? 0.7 * (1 - burst.value) : 0, transform: [{ scale: 0.5 + burst.value * 1.3 }] }));
  // Remplissage du pouce, du bas vers le haut, selon la part de lecteurs (glisse quand elle change).
  const level = Math.max(0, Math.min(1, ratio));
  const fill = useSharedValue(level);
  useEffect(() => { fill.value = reduce ? level : withTiming(level, { duration: 420, easing: Easing.out(Easing.cubic) }); }, [level]);
  const filled = useAnimatedStyle(() => ({ height: 20 * fill.value }));
  const play = () => {
    if (on) {
      s.value = withSequence(withTiming(0.8, { duration: 90 }), withSpring(1, { duration: 300, dampingRatio: 0.7 }));
      return;
    }
    s.value = withSequence(withTiming(0.7, { duration: 90 }), withSpring(1, { duration: 520, dampingRatio: 0.38 }));
    rot.value = withSequence(withTiming(icon === 'up' ? -16 : 16, { duration: 110 }), withSpring(0, { duration: 500, dampingRatio: 0.45 }));
    if (!reduce) {
      burst.value = 0;
      burst.value = withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) });
    }
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${Math.round(level * 100)} % des lecteurs`}
      accessibilityState={{ selected: on }}
      onPress={() => { play(); onPress(); }}
      style={row ? styles.icRow : styles.ic}
    >
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View pointerEvents="none" style={[styles.ring, { borderColor: color }, ring]} />
        {Array.from({ length: 8 }, (_, i) => <Spark key={i} i={i} t={burst} color={i % 2 ? color : C.pink} down={icon === 'down'} />)}
        <Animated.View style={[a, { width: 20, height: 20 }]}>
          <Icon name={icon} size={20} color={on ? color : '#fff'} />
          <Animated.View pointerEvents="none" style={[styles.fillClip, filled]}>
            <View style={styles.fillIcon}><Icon name={icon} size={20} color={on ? color : '#fff'} fill={color} /></View>
          </Animated.View>
        </Animated.View>
      </View>
      {n != null ? <Text maxFontSizeMultiplier={MAX_SCALE} style={row ? styles.footTxt : styles.icTxt}>{n}</Text> : null}
    </Pressable>
  );
}
function Spark({ i, t, color, down }: { i: number; t: SharedValue<number>; color: string; down: boolean }) {
  // éventail de 8 éclats sur 220°, ouvert vers le haut (like) ou vers le bas (dislike)
  const ang = ((-200 + i * (220 / 7)) * Math.PI) / 180 * (down ? -1 : 1);
  const st = useAnimatedStyle(() => {
    const d = 8 + t.value * 22;
    return {
      opacity: t.value < 1 ? 1 - t.value : 0,
      transform: [{ translateX: Math.cos(ang) * d }, { translateY: Math.sin(ang) * d }, { scale: 1 - t.value * 0.6 }],
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.spark, { backgroundColor: color }, st]} />;
}

/** Les six réactions emoji, au-dessus des boutons ; la mienne est entourée. */
function EmojiPicker({ mine, count, onPick }: { mine?: string; count: (e: string) => number; onPick: (e: string) => void }) {
  return (
    <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={styles.picker}>
      {RULES.emojis.map((e) => (
        <Press key={e} scaleTo={0.85} onPress={() => { feel('light', 'pop'); onPick(e); }} style={[styles.pickBtn, mine === e && styles.pickOn]} accessibilityLabel={`Réagir ${e}`}>
          <Text maxFontSizeMultiplier={MAX_SCALE} style={{ fontSize: 24 }}>{e}</Text>
          <Text maxFontSizeMultiplier={MAX_SCALE} style={styles.icTxt}>{count(e)}</Text>
        </Press>
      ))}
    </Animated.View>
  );
}

/* Un fait : un tap le retourne et montre sa source (≈ 280 ms) */
function FactRow({ text, source, doc, last, onSource, onFlip }: { text: string; source: string; doc: string; last: boolean; onSource: () => void; onFlip: () => void }) {
  const rot = useSharedValue(0);
  const [back, setBack] = useState(false);
  const front = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateX: `${rot.value}deg` }],
    opacity: rot.value < 90 ? 1 : 0,
  }));
  const rear = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateX: `${rot.value - 180}deg` }],
    opacity: rot.value >= 90 ? 1 : 0,
  }));
  const flip = () => {
    const to = back ? 0 : 180;
    rot.value = withTiming(to, { duration: 280, easing: Easing.bezier(0.23, 1, 0.32, 1) });
    if (!back) onFlip();
    setBack(!back);
    feel('select');
  };
  return (
    <Pressable onPress={flip} accessibilityRole="button" accessibilityHint="Affiche la source de ce fait">
      <Animated.View style={[styles.fact, last && styles.factLast, front]}>
        <Rich text={text} style={styles.factTxt} maxScale={MAX_SCALE} />
      </Animated.View>
      <Animated.View style={[styles.factBack, rear]} pointerEvents={back ? 'auto' : 'none'}>
        <Text maxFontSizeMultiplier={MAX_SCALE} style={styles.backTxt} numberOfLines={2}>
          ↳ {source}{/^https?:\/\//.test(doc) ? null : <Text maxFontSizeMultiplier={MAX_SCALE} style={{ color: C.text2 }}> · {doc}</Text>}
        </Text>
        <Pressable onPress={onSource} hitSlop={10} accessibilityRole="link" accessibilityLabel={`Voir la source : ${source}`}>
          <Text maxFontSizeMultiplier={MAX_SCALE} style={styles.backLink}>Voir ›</Text>
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

/** Point « en direct » : un halo corail qui s'élargit et s'efface, en boucle. */
function LiveDot({ size }: { size: number }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    t.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false);
    return () => cancelAnimation(t);
  }, [reduce]);
  const halo = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - t.value), transform: [{ scale: 1 + t.value * 1.8 }] }));
  const dot = { width: size, height: size, borderRadius: size / 2, backgroundColor: C.coral };
  return (
    <View style={dot}>
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: size / 2, backgroundColor: C.coral }, halo]} />
    </View>
  );
}

/** Nom de rubrique qui s'efface en approchant des bords du bandeau, au lieu d'être coupé net. */
function TabFade({ x, w, tx, boxW, children }: { x?: number; w?: number; tx: SharedValue<number>; boxW: number; children: React.ReactNode }) {
  const a = useAnimatedStyle(() => {
    if (x == null || w == null || !boxW) return { opacity: 1 };
    const d = Math.abs(x + w / 2 + tx.value - boxW / 2);
    return { opacity: interpolate(d, [boxW * 0.3, boxW * 0.56], [1, 0.15], Extrapolation.CLAMP) };
  });
  return <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: 7 }, a]}>{children}</Animated.View>;
}

function Header({ api, top, W, goRub }: { api: FeedApi; top: number; W: number; goRub: (n: number) => void }) {
  const [lay, setLay] = useState<Record<number, { x: number; w: number }>>({});
  const [boxW, setBoxW] = useState(0);
  const tx = useSharedValue(0);
  const pos = lay[api.ri];
  useEffect(() => {
    if (pos && boxW) tx.value = withTiming(boxW / 2 - (pos.x + pos.w / 2), { duration: 420, easing: Easing.bezier(0.23, 1, 0.32, 1) });
  }, [api.ri, pos?.x, pos?.w, boxW]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));
  const prog = useSharedValue(0);
  useEffect(() => {
    prog.value = withTiming(Math.min(1, api.seenN / api.limit), { duration: 500, easing: Easing.bezier(0.23, 1, 0.32, 1) });
  }, [api.seenN, api.limit]);
  const bar = useAnimatedStyle(() => ({ width: `${prog.value * 100}%` }));
  // Nouvelle info en Dernière minute depuis le dernier passage : l'onglet passe en corail.
  const flashCol = api.cols.find((c) => c.id === 'flash');
  const newest = flashCol?.cards[0] && isFlash(flashCol.cards[0]) ? flashCol.cards[0].at : '';
  const [flashSeen, setFlashSeen] = useState('');
  useEffect(() => { if (api.cols[api.ri]?.id === 'flash') setFlashSeen(newest); }, [api.ri, newest]);
  const flashFresh = !!newest && newest > flashSeen;
  return (
    <View style={[styles.head, { paddingTop: top + 8 }]} pointerEvents="box-none">
      <View style={styles.headRow}>
        <View style={{ width: 44 }} />
        <View style={styles.rubs} onLayout={(e: LayoutChangeEvent) => setBoxW(e.nativeEvent.layout.width)}>
          <Animated.View style={[{ flexDirection: 'row', position: 'absolute', left: 0, top: 0 }, a]}>
            {api.cols.map((c, i) => (
              <Pressable
                key={c.id}
                onPress={() => i !== api.ri && goRub(i)}
                onLayout={(e) => {
                  const { x, width } = e.nativeEvent.layout;
                  setLay((l) => (l[i]?.x === x && l[i]?.w === width ? l : { ...l, [i]: { x, w: width } }));
                }}
                style={styles.rub}
                accessibilityRole="tab"
                accessibilityState={{ selected: i === api.ri }}
              >
                <TabFade x={lay[i]?.x} w={lay[i]?.w} tx={tx} boxW={boxW}>
                  {c.id === 'flash' ? <LiveDot size={7} /> : null}
                  <Text maxFontSizeMultiplier={MAX_SCALE} style={[styles.rubTxt, c.extra && { opacity: 0.55 }, c.id === 'flash' && flashFresh && i !== api.ri && { color: C.coral }, i === api.ri && styles.rubOn]}>{c.name}</Text>
                </TabFade>
                {i === api.ri ? <View style={styles.rubDot} /> : null}
              </Pressable>
            ))}
          </Animated.View>
        </View>
        <Press onPress={api.onSettings} style={styles.gear} accessibilityLabel="Réglages">
          <Icon name="gear" size={21} />
        </Press>
      </View>
      <View style={styles.prog}>
        <View style={styles.progBar}>
          <Animated.View style={[{ height: '100%', borderRadius: 1, overflow: 'hidden' }, bar]}>
            <LinearGradient colors={GRAD3} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
        </View>
        <Text maxFontSizeMultiplier={MAX_SCALE} style={styles.progTxt}>
          {api.cols[api.ri]?.id === 'flash' ? (
            'Mise à jour en continu'
          ) : (
            <>
              {api.cols[api.ri]?.id === 'edition' ? 'Sélection selon vos choix · ' : ''}
              <Text maxFontSizeMultiplier={MAX_SCALE} style={{ color: '#fff' }}>{api.seenN}</Text> / {api.limit}
            </>
          )}
        </Text>
      </View>
    </View>
  );
}

const FLASH_GRAD = [C.coral, C.violet, mix(C.night, C.pink, 0.22), C.night];

const styles = StyleSheet.create({
  flashSrc: { color: C.text2, fontFamily: F.semi, fontSize: 14 },
  blob: { position: 'absolute', width: '70%', aspectRatio: 1, borderRadius: 999, opacity: 0.55 },
  card: { position: 'absolute', left: 0 },
  content: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 28, gap: 18 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pill: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  pillTxt: { color: '#fff', fontFamily: F.semi, fontSize: 10, letterSpacing: 1.8 },
  metaTxt: { color: C.text2, fontFamily: F.regular, fontSize: 12 },
  whyLink: { color: C.text3, fontFamily: F.semi, fontSize: 11 },
  whyBox: { marginTop: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  whyTxt: { color: C.text, fontFamily: F.regular, fontSize: 13, lineHeight: 18 },
  whyLess: { color: C.soft2, fontFamily: F.semi, fontSize: 13 },
  kicker: { color: C.text2, fontFamily: F.semi, fontSize: 11, letterSpacing: 2 },
  title: { color: '#fff', fontFamily: F.black, fontSize: 33, lineHeight: 33, letterSpacing: -0.4 },
  key: { color: 'rgba(255,255,255,0.82)', fontFamily: F.regular, fontSize: 16.5, lineHeight: 24, marginTop: -4 },
  fact: { borderTopWidth: StyleSheet.hairlineWidth * 2, borderColor: C.line, paddingVertical: 12, minHeight: 46, justifyContent: 'center' },
  factLast: { borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  factTxt: { color: 'rgba(255,255,255,0.92)', fontFamily: F.regular, fontSize: 15, lineHeight: 20 },
  factBack: { position: 'absolute', left: -6, right: -6, top: 4, bottom: 4, borderRadius: 12, backgroundColor: alpha(C.violet, 0.3), flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  backTxt: { flex: 1, color: '#fff', fontFamily: F.regular, fontSize: 13 },
  backLink: { color: C.link, fontFamily: F.semi, fontSize: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  read: { height: 46, paddingHorizontal: 22, borderRadius: 999, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  readTxt: { color: '#fff', fontFamily: F.semi, fontSize: 15 },
  ic: { width: 46, height: 48, alignItems: 'center', justifyContent: 'center', gap: 1 },
  icTxt: { color: C.text2, fontFamily: F.semi, fontSize: 10 },
  icRow: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 44 },
  footTxt: { color: C.text2, fontFamily: F.semi, fontSize: 14 },
  fillClip: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  fillIcon: { position: 'absolute', left: 0, bottom: 0 },
  ring: { position: 'absolute', width: 34, height: 34, borderRadius: 17, borderWidth: 2 },
  spark: { position: 'absolute', width: 5, height: 5, borderRadius: 3 },
  picker: { position: 'absolute', right: 0, bottom: 56, flexDirection: 'row', gap: 2, padding: 6, borderRadius: 22, backgroundColor: 'rgba(30,24,64,0.96)', borderWidth: 1, borderColor: C.line },
  pickBtn: { width: 46, alignItems: 'center', paddingVertical: 4, borderRadius: 14 },
  pickOn: { backgroundColor: alpha(C.violet, 0.35) },
  sources: { color: C.text3, fontFamily: F.regular, fontSize: 11 },
  adCta: { height: 46, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  head: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 22, gap: 10 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { color: C.soft, fontFamily: F.black, fontSize: 19, letterSpacing: -0.3, width: 62 },
  rubs: { flex: 1, height: 36, overflow: 'hidden', ...(Platform.OS === 'web' ? ({ maskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)' } as object) : null) },
  rub: { height: 36, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  rubTxt: { color: C.text2, fontFamily: F.semi, fontSize: 12.5 },
  rubOn: { color: '#fff', fontFamily: F.black },
  rubDot: { position: 'absolute', bottom: 2, width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff' },
  gear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  prog: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progBar: { flex: 1, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' },
  progTxt: { color: C.text2, fontFamily: F.semi, fontSize: 11 },
  ticks: { position: 'absolute', right: 7, top: '45%', gap: 6, alignItems: 'flex-end' },
  tick: { width: 3, height: 12, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
  tickOn: { height: 26, backgroundColor: '#fff' },
});

