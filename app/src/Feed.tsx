import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, Pressable, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
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
import { C, F, GRAD3, SPRING, SPRING_FLICK } from './theme';
import { isAd, type Article, type Card, type Column, type Tag } from './types';
import { AD, MEDIA, TAGS, rubricOf } from './edition';
import { PHOTOS } from './content';
import { Icon, Press, Rich } from './ui';
import { feel } from './feel';

const EXT = 140; // les photos débordent sur les côtés pour se fondre entre rubriques
const MAX_COLS = 8;

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
  onToast: (msg: string) => void;
  onSettings: () => void;
};

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
  const ys = [y0, y1, y2, y3, y4, y5, y6, y7].slice(0, MAX_COLS);

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
    const first = col.cards.findIndex((c) => !isAd(c) && !q.seen.has(c.id));
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
    <View style={StyleSheet.absoluteFill}>
      <GestureDetector gesture={pan}>
        <Animated.View style={[StyleSheet.absoluteFill, rowStyle]}>
          {/* Couche des photos : toutes sous tous les textes, pour un fondu propre */}
          {cols.map((col, ci) => (
            <ColumnStack key={'bg' + col.id} y={ys[ci]} W={W} H={H} ci={ci}>
              {col.cards.map((c, k) => (
                <Background key={c.id} card={c} k={k} ci={ci} W={W} H={H} colX={colX} y={ys[ci]} tiltX={p.tiltX} tiltY={p.tiltY} parallax={p.parallax} />
              ))}
            </ColumnStack>
          ))}
          {cols.map((col, ci) => (
            <ColumnStack key={'fg' + col.id} y={ys[ci]} W={W} H={H} ci={ci}>
              {col.cards.map((c, k) => (
                <CardContent key={c.id} card={c} k={k} W={W} H={H} tag={col.tags[c.id]} api={p} bottom={insets.bottom} tiltX={p.tiltX} tiltY={p.tiltY} />
              ))}
            </ColumnStack>
          ))}
        </Animated.View>
      </GestureDetector>
      <Header api={p} top={insets.top} W={W} goRub={(n) => goRub(n)} />
      <Ticks col={cols[p.ri]} idx={p.idx[cols[p.ri]?.id] ?? 0} />
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
  const photo = isAd(card) ? PHOTOS.lampe : card.photo;
  const grad = isAd(card) ? null : card.grad;
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
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: k * H, left: -EXT, width: W + 2 * EXT, height: H, overflow: 'hidden' }, fade]}>
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
        colors={['rgba(14,11,31,0.6)', 'rgba(14,11,31,0)', 'rgba(14,11,31,0.25)', 'rgba(14,11,31,0.86)', C.night]}
        locations={[0, 0.2, 0.38, 0.62, 0.92]}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

function CardContent({ card, k, W, H, tag, api, bottom, tiltX, tiltY }: {
  card: Card; k: number; W: number; H: number; tag?: Tag; api: FeedApi; bottom: number; tiltX: SharedValue<number>; tiltY: SharedValue<number>;
}) {
  // le texte bouge très peu, à l'opposé de la photo : effet de profondeur
  const depth = useAnimatedStyle(() => ({ transform: [{ translateX: -tiltX.value * 0.18 }, { translateY: -tiltY.value * 0.18 }] }));
  const pad = { paddingBottom: Math.max(28, bottom + 14) };
  if (isAd(card)) {
    return (
      <View style={[styles.card, { top: k * H, width: W, height: H }]} pointerEvents="box-none">
        <Animated.View style={[styles.content, pad, depth]}>
          <View style={styles.meta}>
            <View style={[styles.pill, { borderColor: 'rgba(255,255,255,0.2)' }]}><Text style={[styles.pillTxt, { color: C.text2 }]}>SPONSORISÉ</Text></View>
            <Text style={styles.metaTxt}>Maison Lumen</Text>
          </View>
          <Text style={styles.title}>LIRE LE SOIR, SANS FATIGUER VOS YEUX</Text>
          <Text style={styles.key}>Une lampe de lecture rechargeable à lumière chaude, pensée pour les liseuses et les livres papier.</Text>
          <Press onPress={() => api.onToast("Ouvre le site de l'annonceur")} style={styles.adCta}>
            <Text style={{ color: '#fff', fontFamily: F.semi, fontSize: 15 }}>Découvrir l'offre</Text>
          </Press>
          <Text style={styles.sources}>Les pubs financent l'accès gratuit. Premium les retire.</Text>
        </Animated.View>
      </View>
    );
  }
  const a = card;
  const r = api.reactions[a.id] ?? 0;
  return (
    <View style={[styles.card, { top: k * H, width: W, height: H }]} pointerEvents="box-none">
      <Animated.View style={[styles.content, pad, depth]}>
        <View style={styles.meta}>
          <View style={styles.pill}><Text style={styles.pillTxt}>{rubricOf(a).name.toUpperCase()}</Text></View>
          <Text style={styles.metaTxt}>Aujourd'hui · {a.hour}</Text>
          {tag ? (
            <Press onPress={() => { api.onToast(TAGS[tag].why(a)); feel('light'); }} style={styles.why} accessibilityLabel={`Pourquoi cette info ? ${TAGS[tag].label}`}>
              <Text style={styles.whyTxt}>{TAGS[tag].label} <Text style={{ opacity: 0.6 }}>?</Text></Text>
            </Press>
          ) : null}
        </View>
        <Text style={styles.title}>{a.title.toUpperCase()}</Text>
        <Text style={styles.key}>{a.key}</Text>
        <View>
          {a.facts.map((f, i) => (
            <FactRow key={i} text={f.text} source={f.source} doc={f.doc} last={i === a.facts.length - 1} onSource={() => api.onToast('Ouverture de la source officielle')} />
          ))}
        </View>
        <View style={styles.actions}>
          <Press onPress={() => api.onRead(a)} accessibilityLabel="Lire le résumé, 1 minute" style={{ marginRight: 'auto' }}>
            <LinearGradient colors={[C.violet, C.blue]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.read}>
              <Icon name="book" size={18} />
              <Text style={styles.readTxt}>Lire · 1 min</Text>
            </LinearGradient>
          </Press>
          <ReactBtn icon="up" n={a.likes + (r === 1 ? 1 : 0)} on={r === 1} color={C.violet} onPress={() => api.onReact(a, 1)} label="J'aime" />
          <ReactBtn icon="down" on={r === -1} color={C.coral} onPress={() => api.onReact(a, -1)} label="Je n'aime pas" />
          <Press onPress={() => api.onComments(a)} style={styles.ic} accessibilityLabel="Commentaires">
            <Icon name="cmt" size={20} />
            <Text style={styles.icTxt}>{api.commentCount(a)}</Text>
          </Press>
          <Press onPress={() => { api.onToast("Lien de l'info copié"); feel('light'); }} style={styles.ic} accessibilityLabel="Partager">
            <Icon name="share" size={20} />
          </Press>
        </View>
        <Text style={styles.sources}>{MEDIA}</Text>
      </Animated.View>
    </View>
  );
}

function ReactBtn({ icon, n, on, color, onPress, label }: { icon: 'up' | 'down'; n?: number; on: boolean; color: string; onPress: () => void; label: string }) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      onPress={() => {
        onPress();
        // le pouce rebondit quand on aime, se contracte quand on n'aime pas
        s.value = withTiming(icon === 'up' && !on ? 1.32 : 0.78, { duration: 120 }, () => {
          s.value = withSpring(1, { duration: 400, dampingRatio: 0.5 });
        });
      }}
      style={styles.ic}
    >
      <Animated.View style={a}>
        <Icon name={icon} size={20} color={on ? '#fff' : '#fff'} fill={on ? color : 'none'} />
      </Animated.View>
      {n != null ? <Text style={styles.icTxt}>{n}</Text> : null}
    </Pressable>
  );
}

/* Un fait : un tap le retourne et montre sa source (≈ 280 ms) */
function FactRow({ text, source, doc, last, onSource }: { text: string; source: string; doc: string; last: boolean; onSource: () => void }) {
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
    setBack(!back);
    feel('select');
  };
  return (
    <Pressable onPress={flip} accessibilityRole="button" accessibilityHint="Affiche la source de ce fait">
      <Animated.View style={[styles.fact, last && styles.factLast, front]}>
        <Rich text={text} style={styles.factTxt} />
      </Animated.View>
      <Animated.View style={[styles.factBack, rear]} pointerEvents={back ? 'auto' : 'none'}>
        <Text style={styles.backTxt} numberOfLines={2}>
          ↳ {source} · <Text style={{ color: C.text2 }}>{doc}</Text>
        </Text>
        <Pressable onPress={onSource} hitSlop={10}>
          <Text style={styles.backLink}>Voir ›</Text>
        </Pressable>
      </Animated.View>
    </Pressable>
  );
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
  return (
    <View style={[styles.head, { paddingTop: top + 8 }]} pointerEvents="box-none">
      <View style={styles.headRow}>
        <Text style={styles.logo}>TITRE</Text>
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
                <Text style={[styles.rubTxt, i === api.ri && styles.rubOn]}>{c.name}</Text>
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
        <Text style={styles.progTxt}>
          <Text style={{ color: '#fff' }}>{api.seenN}</Text> / {api.limit}
        </Text>
      </View>
    </View>
  );
}

function Ticks({ col, idx }: { col?: Column; idx: number }) {
  if (!col) return null;
  return (
    <View style={styles.ticks} pointerEvents="none">
      {col.cards.map((c, k) => (
        <View key={c.id} style={[styles.tick, k === idx && styles.tickOn, isAd(c) && k !== idx && { opacity: 0.4 }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  blob: { position: 'absolute', width: '70%', aspectRatio: 1, borderRadius: 999, opacity: 0.55 },
  card: { position: 'absolute', left: 0 },
  content: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 28, gap: 18 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pill: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  pillTxt: { color: '#fff', fontFamily: F.semi, fontSize: 10, letterSpacing: 1.8 },
  metaTxt: { color: C.text2, fontFamily: F.regular, fontSize: 12 },
  why: { marginLeft: 'auto', backgroundColor: 'rgba(123,92,255,0.25)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  whyTxt: { color: '#d6ccff', fontFamily: F.semi, fontSize: 11 },
  title: { color: '#fff', fontFamily: F.black, fontSize: 33, lineHeight: 33, letterSpacing: -0.4 },
  key: { color: 'rgba(255,255,255,0.82)', fontFamily: F.regular, fontSize: 16.5, lineHeight: 24, marginTop: -4 },
  fact: { borderTopWidth: StyleSheet.hairlineWidth * 2, borderColor: C.line, paddingVertical: 12, minHeight: 46, justifyContent: 'center' },
  factLast: { borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  factTxt: { color: 'rgba(255,255,255,0.92)', fontFamily: F.regular, fontSize: 15, lineHeight: 20 },
  factBack: { position: 'absolute', left: -6, right: -6, top: 4, bottom: 4, borderRadius: 12, backgroundColor: 'rgba(123,92,255,0.3)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  backTxt: { flex: 1, color: '#fff', fontFamily: F.regular, fontSize: 13 },
  backLink: { color: '#cfe0ff', fontFamily: F.semi, fontSize: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  read: { height: 48, paddingHorizontal: 20, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 8 },
  readTxt: { color: '#fff', fontFamily: F.semi, fontSize: 15 },
  ic: { width: 46, height: 48, alignItems: 'center', justifyContent: 'center', gap: 1 },
  icTxt: { color: C.text2, fontFamily: F.semi, fontSize: 10 },
  sources: { color: C.text3, fontFamily: F.regular, fontSize: 11 },
  adCta: { height: 46, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  head: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 22, gap: 10 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { color: '#b9a8ff', fontFamily: F.black, fontSize: 19, letterSpacing: -0.3, width: 62 },
  rubs: { flex: 1, height: 36, overflow: 'hidden' },
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

export { AD };
