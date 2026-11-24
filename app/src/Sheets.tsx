import React, { useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TextInput, View, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import Animated, { Easing, interpolate, Extrapolation, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming, withSpring, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, DRAWER_MS, GRAD3, alpha } from './theme';
import { BRAND, RULES } from './brand';
import type { Article, Comment, ReaderCard } from './types';
import { BadgeIcons, ReaderCardView, pseudoColor } from './Badges';
import { rubricOf, summaryOf } from './edition';
import { Icon, Press } from './ui';
import { ReactBtn, shares } from './Feed';
import { feel } from './feel';
import { todayLabel, yearLabel } from './dates';

const DRAWER = Easing.bezier(0.32, 0.72, 0, 1);

/** Volet du bas : il suit le doigt, se ferme à la distance OU à la vitesse, le voile suit le volet. */
export function Sheet({ open, onClose, H, children, bg, header, full }: {
  open: boolean; onClose: () => void; H: number; children: React.ReactNode; bg: Article | null; header: React.ReactNode;
  /** Plein écran (lecture d'un article) : l'en-tête flotte au-dessus du contenu au lieu de le pousser. */
  full?: boolean;
}) {
  const h = full ? H : H * 0.9;
  const y = useSharedValue(h);
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      y.value = withTiming(0, { duration: DRAWER_MS, easing: DRAWER });
    } else {
      y.value = withTiming(h, { duration: 380, easing: DRAWER }, (done) => {
        if (done) scheduleOnRN(setMounted, false);
      });
    }
  }, [open, h]);
  const pan = usePanGesture({
    onUpdate: (e) => {
      'worklet';
      y.value = e.translationY > 0 ? e.translationY : -Math.sqrt(-e.translationY) * 3;
    },
    onDeactivate: (e) => {
      'worklet';
      if (y.value > h * 0.35 || e.velocityY > 600) scheduleOnRN(onClose);
      else y.value = withSpring(0, { duration: 400, dampingRatio: 0.85, velocity: e.velocityY });
    },
  });
  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const scrim = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [0, h], [1, 0], Extrapolation.CLAMP) }));
  if (!mounted) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,6,20,0.55)' }, scrim]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer" />
      </Animated.View>
      <Animated.View style={[styles.sheet, full && styles.full, { height: h }, sheet]}>
        {bg?.photo ? <Image source={bg.photo} style={StyleSheet.absoluteFill} blurRadius={40} contentFit="cover" /> : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: alpha(C.night, full ? 0.92 : 0.82) }]} />
        {full ? children : null}
        <GestureDetector gesture={pan}>
          <View style={full ? styles.float : null}>
            {full ? null : <View style={styles.grab}><View style={styles.grabBar} /></View>}
            {header}
          </View>
        </GestureDetector>
        {full ? null : children}
      </Animated.View>
    </View>
  );
}

export function SummarySheet({ a, open, onClose, H, reaction, onReact, onComments, commentCount, emojiMode, onSignal, extra }: {
  a: Article | null; open: boolean; onClose: () => void; H: number; reaction: number; onReact: (v: 1 | -1) => void; onComments: () => void; commentCount: number;
  /** Commentaires remplacés par les emoji : pas de bouton commentaires. */
  emojiMode?: boolean;
  /** Résumé lu jusqu'en bas, lien vers l'article complet : pour l'algorithme « Mon édition ». */
  onSignal: (k: 'summary_end' | 'click') => void;
  /** Au-dessus des sources : « Suivre ce sujet ». */
  extra?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const heads = ['Contexte', 'Ce qui change', 'Et après'];
  const endSent = useRef<string | null>(null);
  // Lecture plein écran : grande photo en haut (nette), titre posé dessus, le texte remonte par-dessus en défilant.
  const heroH = Math.round(H * 0.46);
  const sy = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => { sy.value = e.contentOffset.y; },
    // Tirer vers le bas depuis le haut de l'article le ferme aussi.
    onEndDrag: (e) => { if (e.contentOffset.y < -90) scheduleOnRN(onClose); },
  });
  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: sy.value > 0 ? sy.value * 0.5 : sy.value },
      { scale: sy.value < 0 ? 1 + -sy.value / heroH : 1 },
    ],
  }));
  // La barre du haut se teinte quand le texte passe dessous.
  const barStyle = useAnimatedStyle(() => ({ opacity: interpolate(sy.value, [heroH - 140, heroH - 60], [0, 1], Extrapolation.CLAMP) }));
  useEffect(() => { if (open) sy.value = 0; }, [open, a?.id]);
  return (
    <Sheet open={open} onClose={onClose} H={H} bg={a} full header={
      <View style={{ paddingTop: insets.top + 14 }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: alpha(C.night, 0.94), borderBottomWidth: 1, borderColor: C.line }, barStyle]} />
        <View style={styles.readBar}>
          <Text style={styles.readBrand} numberOfLines={1}>{BRAND.name}</Text>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Fermer">
            <Icon name="close" size={18} />
          </Pressable>
        </View>
      </View>
    }>
      {a ? (
        <>
          <Animated.ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 30 }}
            onScroll={onScroll}
            scrollEventThrottle={16}
            // Résumé lu jusqu'en bas (80 %) : un signal fort pour l'algorithme, envoyé une fois.
            onMomentumScrollEnd={({ nativeEvent: e }) => {
              if (a && endSent.current !== a.id && e.contentOffset.y + e.layoutMeasurement.height >= e.contentSize.height * 0.8) { endSent.current = a.id; onSignal('summary_end'); }
            }}
          >
            <View style={{ height: heroH, overflow: 'visible' }}>
              <Animated.View style={[StyleSheet.absoluteFill, heroStyle]}>
                {a.photo ? <Image source={a.photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                  : <LinearGradient colors={(a.grad as [string, string, ...string[]]) ?? GRAD3} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
                <LinearGradient colors={[alpha(C.night, 0.55), alpha(C.night, 0), alpha(C.night, 0.35), C.night]} locations={[0, 0.3, 0.62, 1]} style={StyleSheet.absoluteFill} />
              </Animated.View>
              <View style={styles.heroText}>
                {rubricOf(a)?.name ? <Text style={styles.kick}>{rubricOf(a).name.toUpperCase()}</Text> : null}
                <Text style={styles.h2}>{a.title.toUpperCase()}</Text>
                <Text style={styles.date}>{a.day ?? `${todayLabel()} ${yearLabel()}`} · {a.hour} · lecture 1 min</Text>
              </View>
            </View>
            <View style={{ paddingHorizontal: 30, paddingTop: 22, backgroundColor: C.night }}>
            {summaryOf(a).map((t, i) => (
              <View key={i} style={{ marginBottom: 26 }}>
                <Text style={styles.blkH}>{heads[i].toUpperCase()}</Text>
                <Text style={styles.blkP}>{t}</Text>
              </View>
            ))}
            {a.matters && RULES.show_matters ? (
              <View style={{ marginBottom: 26 }}>
                <Text style={styles.blkH}>POURQUOI C'EST IMPORTANT</Text>
                <Text style={styles.blkP}>{a.matters}</Text>
              </View>
            ) : null}
            {extra}
            <Angles a={a} />
            <View style={styles.srcList}>
              <Text style={styles.lbl}>SOURCES CONSULTÉES</Text>
              {[...new Map(a.facts.map((f) => [f.source, f.doc])).entries()].map(([m, url]) => (
                <Text key={m} style={styles.srcLink} accessibilityRole="link" onPress={() => { onSignal('click'); if (typeof url === 'string' && url.startsWith('http')) Linking.openURL(url); }}>Lire l'article complet sur {m} ›</Text>
              ))}
              {a.credit ? <Text style={[styles.srcLink, { color: C.text3, fontSize: 12, marginTop: 8 }]}>Photo : {a.credit}</Text> : null}
            </View>
            </View>
          </Animated.ScrollView>
          <View style={[styles.foot, { paddingBottom: Math.max(18, insets.bottom + 6) }]}>
            <ReactBtn row icon="up" n={a.likes + (reaction === 1 ? 1 : 0)} on={reaction === 1} color={C.like} ratio={shares(a, reaction).up} onPress={() => onReact(1)} label="J'aime" />
            <ReactBtn row icon="down" on={reaction === -1} color={C.dislike} ratio={shares(a, reaction).down} onPress={() => onReact(-1)} label="Je n'aime pas" />
            {emojiMode ? null : (
              <Press style={styles.footBtn} onPress={onComments} accessibilityLabel="Commentaires">
                <Icon name="cmt" size={20} />
                <Text style={styles.footTxt}>{commentCount}</Text>
              </Press>
            )}
            <Press style={styles.footBtn} onPress={() => feel('light')} accessibilityLabel="Partager">
              <Icon name="share" size={20} />
            </Press>
          </View>
        </>
      ) : null}
    </Sheet>
  );
}

/** « Voir les angles » : un lien discret, déplié seulement à la demande, et seulement quand 2 médias ou plus divergent. */
function Angles({ a }: { a: Article }) {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [a.id]);
  if ((a.angles?.length ?? 0) < 2) return null;
  return (
    <View style={{ marginBottom: 22 }}>
      <Text style={styles.srcLink} onPress={() => { feel('light'); setOpen(!open); }} accessibilityRole="button">
        {open ? 'Masquer les angles ‹' : 'Voir les angles des médias ›'}
      </Text>
      {open ? a.angles!.map((g) => (
        <Text key={g.source} style={[styles.blkP, { fontSize: 15, lineHeight: 22, marginTop: 12 }]}>
          <Text style={{ fontFamily: F.semi }}>{g.source}</Text> · {g.text}
        </Text>
      )) : null}
    </View>
  );
}

export function CommentsSheet({ a, open, onClose, H, comments, total, loading, onSend, onVote, onFlag, onDelete, onBlock, loadCard }: {
  a: Article | null; open: boolean; onClose: () => void; H: number; comments: Comment[]; total: number; loading?: boolean;
  /** Envoie le commentaire ; renvoie son id (pour l'animer) ou null si l'envoi n'a pas eu lieu. */
  onSend: (text: string) => Promise<string | null>;
  onVote: (c: Comment, v: -1 | 0 | 1) => void; onFlag: (c: Comment) => void; onDelete: (c: Comment) => void; onBlock: (c: Comment) => void;
  /** Fiche de l'auteur, en touchant son pseudo. */
  loadCard: (c: Comment) => Promise<ReaderCard | null>;
}) {
  const insets = useSafeAreaInsets();
  const [sort, setSort] = useState<'pert' | 'rec'>('pert');
  const [txt, setTxt] = useState('');
  const [sending, setSending] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [card, setCard] = useState<{ who: string; data: ReaderCard | null | undefined } | null>(null);
  const openCard = (c: Comment) => {
    feel('select');
    setCard({ who: c.who, data: undefined });
    loadCard(c).then((data) => setCard((x) => (x && x.who === c.who ? { ...x, data } : x)));
  };
  useEffect(() => { if (!open) setCard(null); }, [open]);
  const list = [...comments].sort((x, y) =>
    sort === 'pert' ? y.likes - y.dislikes + y.mine - (x.likes - x.dislikes + x.mine) || x.order - y.order : x.order - y.order,
  );
  const vote = (c: Comment, v: 1 | -1) => {
    onVote(c, c.mine === v ? 0 : v);
    if (c.mine !== v) feel(v === 1 ? 'medium' : 'light', v === 1 ? 'pop' : 'thud');
  };
  const send = async () => {
    const v = txt.trim();
    if (!v || sending) return;
    setSending(true);
    const id = await onSend(v).finally(() => setSending(false));
    if (!id) return;
    setSort('rec');
    setFresh(id);
    setTxt('');
    feel('success', 'ding');
  };
  return (
    <Sheet open={open} onClose={onClose} H={H} bg={a} header={
      <View style={styles.sheetHead}>
        <Text style={{ color: '#fff', fontFamily: F.black, fontSize: 17 }}>{total} commentaire{total > 1 ? 's' : ''}</Text>
        <View style={styles.sort}>
          {(['pert', 'rec'] as const).map((k) => (
            <Pressable key={k} onPress={() => setSort(k)} style={[styles.sortBtn, sort === k && styles.sortOn]} accessibilityRole="button" accessibilityState={{ selected: sort === k }}>
              <Text style={[styles.sortTxt, sort === k && { color: '#fff' }]}>{k === 'pert' ? 'Pertinence' : 'Récents'}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    }>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={H * 0.1}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24 }}>
          {loading && !comments.length ? <Text style={[styles.voteTxt, { textAlign: 'center', paddingVertical: 30 }]}>Chargement…</Text> : null}
          {!loading && !comments.length ? <Text style={[styles.voteTxt, { textAlign: 'center', paddingVertical: 30, fontSize: 14 }]}>Aucun commentaire pour l’instant. Donnez le premier avis.</Text> : null}
          {list.map((c) => (
            <CommentRow key={c.id} c={c} fresh={c.id === fresh} onWho={() => openCard(c)} onVote={(v) => vote(c, v)} onFlag={() => (c.own ? onDelete(c) : onFlag(c))} onBlock={() => onBlock(c)} />
          ))}
        </ScrollView>
        <View style={[styles.compose, { paddingBottom: Math.max(16, insets.bottom + 4) }]}>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <TextInput
              value={txt}
              onChangeText={setTxt}
              maxLength={70}
              placeholder="Votre avis en 70 caractères"
              placeholderTextColor={C.text3}
              style={styles.input}
              returnKeyType="send"
              onSubmitEditing={send}
              accessibilityLabel="Votre commentaire, 70 caractères maximum"
            />
            <Text style={[styles.count, 70 - txt.length <= 10 && { color: C.coral }]}>{70 - txt.length}</Text>
          </View>
          <Press onPress={send} disabled={!txt.trim() || sending} style={{ opacity: txt.trim() && !sending ? 1 : 0.35 }} accessibilityLabel="Envoyer">
            <LinearGradient colors={[C.violet, C.blue]} style={styles.send}>
              <Icon name="send" size={20} />
            </LinearGradient>
          </Press>
        </View>
      </KeyboardAvoidingView>
      {card ? <ReaderCardView who={card.who} card={card.data} onClose={() => setCard(null)} /> : null}
    </Sheet>
  );
}

function CommentRow({ c, fresh, onWho, onVote, onFlag, onBlock }: { c: Comment; fresh: boolean; onWho: () => void; onVote: (v: 1 | -1) => void; onFlag: () => void; onBlock: () => void }) {
  const t = useSharedValue(fresh ? 60 : 0);
  useEffect(() => {
    if (fresh) t.value = withSpring(0, { duration: 500, dampingRatio: 0.8 });
  }, [fresh]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: t.value }], opacity: interpolate(t.value, [0, 60], [1, 0]) }));
  return (
    <Animated.View style={[styles.cmt, a]}>
      <View style={styles.cmtTop}>
        <Pressable onPress={onWho} hitSlop={8} style={styles.cmtWho} accessibilityRole="button" accessibilityHint="Affiche les reconnaissances de ce lecteur">
          <View style={[styles.av, { backgroundColor: c.color }]}><Text style={styles.avTxt}>{c.who[0].toUpperCase()}</Text></View>
          <Text style={[styles.who, { color: pseudoColor(c.badges) }]}>{c.who}</Text>
          {/* Ancienne base, sans badges : la pastille Premium d'avant. */}
          {c.badges ? <BadgeIcons badges={c.badges} /> : c.premium ? <View style={styles.prem}><Text style={styles.premTxt}>PREMIUM</Text></View> : null}
        </Pressable>
        <Text style={styles.ago}>{c.ago}</Text>
      </View>
      <Text style={styles.cmtTxt}>{c.text}</Text>
      <View style={styles.cmtAct}>
        <Pressable accessibilityRole="button" onPress={() => onVote(1)} style={styles.vote} hitSlop={8} accessibilityLabel="J'aime ce commentaire">
          <Icon name="up" size={15} color={c.mine === 1 ? C.soft : C.text2} fill={c.mine === 1 ? C.violet : 'none'} />
          <Text style={styles.voteTxt}>{c.likes + (c.mine === 1 ? 1 : 0)}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => onVote(-1)} style={styles.vote} hitSlop={8} accessibilityLabel="Je n'aime pas ce commentaire">
          <Icon name="down" size={15} color={c.mine === -1 ? C.coral : C.text2} fill={c.mine === -1 ? C.coral : 'none'} />
          <Text style={styles.voteTxt}>{c.dislikes + (c.mine === -1 ? 1 : 0)}</Text>
        </Pressable>
        {c.own ? null : (
          <Pressable accessibilityRole="button" onPress={onBlock} style={[styles.vote, { marginLeft: 'auto' }]} hitSlop={8} accessibilityLabel={`Ne plus voir les commentaires de ${c.who}`}>
            <Text style={styles.voteTxt}>Bloquer</Text>
          </Pressable>
        )}
        <Pressable onPress={onFlag} style={[styles.vote, c.own ? { marginLeft: 'auto' } : null]} hitSlop={8} accessibilityRole="button">
          {c.own ? null : <Icon name="flag" size={15} color={C.text2} />}
          <Text style={styles.voteTxt}>{c.own ? 'Supprimer' : 'Signaler'}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  grab: { paddingTop: 10, paddingBottom: 4, alignItems: 'center' },
  grabBar: { width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 26, paddingTop: 6, paddingBottom: 14 },
  logo: { color: C.soft, fontFamily: F.black, fontSize: 19 },
  close: { color: C.link, fontFamily: F.semi, fontSize: 14 },
  full: { borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTopWidth: 0 },
  float: { position: 'absolute', top: 0, left: 0, right: 0 },
  readBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10 },
  readBrand: { color: '#fff', fontFamily: F.black, fontSize: 17, letterSpacing: -0.2, textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 8 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.38)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  heroText: { position: 'absolute', left: 30, right: 30, bottom: 0 },
  kick: { color: C.soft2, fontFamily: F.black, fontSize: 11, letterSpacing: 1.8, marginBottom: 8 },
  h2: { color: '#fff', fontFamily: F.black, fontSize: 30, lineHeight: 31, textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 12 },
  date: { color: C.text2, fontFamily: F.regular, fontSize: 13, marginTop: 10 },
  blkH: { color: C.soft, fontFamily: F.black, fontSize: 11, letterSpacing: 1.8, marginBottom: 10 },
  blkP: { color: 'rgba(255,255,255,0.9)', fontFamily: F.regular, fontSize: 17, lineHeight: 27 },
  srcList: { borderTopWidth: 1, borderColor: C.line, paddingTop: 14, gap: 12 },
  lbl: { color: C.text3, fontFamily: F.semi, fontSize: 11, letterSpacing: 1.6 },
  srcLink: { color: C.link, fontFamily: F.regular, fontSize: 14 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 26, paddingHorizontal: 30, paddingTop: 12, borderTopWidth: 1, borderColor: C.line },
  footBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 44 },
  footTxt: { color: C.text2, fontFamily: F.semi, fontSize: 14 },
  sort: { flexDirection: 'row', padding: 3, borderRadius: 12, backgroundColor: C.surface, gap: 2 },
  sortBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9 },
  sortOn: { backgroundColor: C.surface2 },
  sortTxt: { color: C.text2, fontFamily: F.semi, fontSize: 12 },
  cmt: { paddingVertical: 14, borderBottomWidth: 1, borderColor: C.line, gap: 6 },
  cmtTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cmtWho: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  av: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  avTxt: { color: '#fff', fontFamily: F.black, fontSize: 11 },
  who: { color: '#fff', fontFamily: F.semi, fontSize: 13 },
  prem: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: 'rgba(200,107,250,0.25)', borderWidth: 1, borderColor: 'rgba(200,170,255,0.45)' },
  premTxt: { color: C.soft2, fontFamily: F.semi, fontSize: 9, letterSpacing: 1.2 },
  ago: { color: C.text3, fontFamily: F.regular, fontSize: 12 },
  cmtTxt: { color: '#fff', fontFamily: F.regular, fontSize: 15, lineHeight: 21, paddingLeft: 34 },
  cmtAct: { flexDirection: 'row', gap: 18, paddingLeft: 34, alignItems: 'center' },
  vote: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 28 },
  voteTxt: { color: C.text2, fontFamily: F.regular, fontSize: 12 },
  compose: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 18, paddingTop: 12, borderTopWidth: 1, borderColor: C.line, backgroundColor: alpha(C.night, 0.6) },
  input: { height: 46, borderRadius: 15, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, color: '#fff', fontFamily: F.regular, fontSize: 15, paddingLeft: 14, paddingRight: 46 },
  count: { position: 'absolute', right: 12, color: C.text3, fontFamily: F.regular, fontSize: 11 },
  send: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});

export type { SharedValue };
