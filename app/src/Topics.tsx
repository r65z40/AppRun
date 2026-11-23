// Sujets suivis : boutons « Suivre » sous un article, écran « Mes sujets » et frise de l'histoire d'un sujet.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, GRAD, DRAWER_MS, alpha } from './theme';
import { Chip, Toggle, st } from './ui';
import { feel } from './feel';
import { RUBRIC_LIST } from './content';
import { articleTopics, follow, loadTimeline, loadTopics, onTopics, type Timeline, type Topics } from './topics';
import type { Article } from './types';

const DRAWER = Easing.bezier(0.32, 0.72, 0, 1);

function useTopics() {
  const [t, setT] = useState<Topics | null>(null);
  useEffect(() => onTopics(setT), []);
  return t;
}

/** Suit un sujet depuis un bouton : message court, ouvre la frise s'il est déjà suivi. */
async function toggleFrom(topic: string, t: Topics | null, onOpen: (topic: string) => void, onToast: (m: string) => void) {
  if (t?.following.some((f) => f.topic === topic)) return onOpen(topic);
  feel('select', 'tick');
  try {
    const n = await follow(topic, true);
    onToast(n.alerts ? `Vous suivez ${topic} : une alerte quand le sujet bouge.` : `Vous suivez ${topic}.`);
  } catch (e) {
    onToast(e instanceof Error ? e.message : 'Suivi impossible pour le moment.');
  }
}

/* ---------- Sous un article : « Suivre ce sujet » ---------- */
export function FollowRow({ a, onOpen, onToast }: { a: Article; onOpen: (topic: string) => void; onToast: (m: string) => void }) {
  const t = useTopics();
  const topics = articleTopics(a);
  if (!topics.length || t?.enabled === false) return null;
  return (
    <View style={styles.followBox}>
      <Text style={styles.lbl}>SUIVRE CE SUJET</Text>
      <View style={styles.chips}>
        {topics.map((k) => {
          const on = !!t?.following.some((f) => f.topic === k);
          return <Chip key={k} label={on ? `✓ ${k}` : `+ ${k}`} on={on} onPress={() => toggleFrom(k, t, onOpen, onToast)} />;
        })}
      </View>
      <Text style={styles.hint}>Une alerte quand il bouge, et toute son histoire en un coup d'œil.</Text>
    </View>
  );
}

/* ---------- Écran « Mes sujets » (liste, puis frise d'un sujet) ---------- */
export function TopicsScreen({ W, start, onClose, onToast, onOpenArticle }: {
  W: number; start: string | null; onClose: () => void; onToast: (m: string) => void;
  /** Ouvre une info de la frise si elle est dans l'édition chargée ; renvoie faux sinon. */
  onOpenArticle: (id: string) => boolean;
}) {
  const insets = useSafeAreaInsets();
  const t = useTopics();
  const [topic, setTopic] = useState<string | null>(start);
  const x = useSharedValue(W);
  useEffect(() => { loadTopics(); x.value = withTiming(0, { duration: DRAWER_MS, easing: DRAWER }); }, []);
  useEffect(() => setTopic(start), [start]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const leave = () => { x.value = withTiming(W, { duration: 380, easing: DRAWER }); setTimeout(onClose, 360); };
  const back = () => (topic && start === null ? setTopic(null) : leave());
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: C.night }, anim]}>
      <View style={[styles.head, { paddingTop: insets.top + 18 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1} numberOfLines={2}>{topic ?? 'Mes sujets'}</Text>
          <Text style={styles.sub}>{topic ? "L'histoire du sujet, la plus récente en haut" : 'Une alerte quand ils bougent'}</Text>
        </View>
        <Pressable onPress={back} hitSlop={12}><Text style={styles.close}>{topic && start === null ? 'Retour' : 'Fermer'}</Text></Pressable>
      </View>
      {topic ? <TimelineView key={topic} topic={topic} onToast={onToast} onOpenArticle={onOpenArticle} onUnfollow={() => (start === null ? setTopic(null) : leave())} />
        : <TopicList t={t} onOpen={setTopic} onToast={onToast} bottom={insets.bottom} />}
    </Animated.View>
  );
}

function TopicList({ t, onOpen, onToast, bottom }: { t: Topics | null; onOpen: (k: string) => void; onToast: (m: string) => void; bottom: number }) {
  if (!t) return <ActivityIndicator color={C.soft} style={{ marginTop: 40 }} />;
  if (!t.enabled) return <Text style={[styles.p, { paddingHorizontal: 26 }]}>Le suivi des sujets revient bientôt.</Text>;
  const mine = new Set(t.following.map((f) => f.topic));
  const more = [...t.suggested, ...t.available].filter((k, i, all) => !mine.has(k) && all.indexOf(k) === i);
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 26, paddingBottom: bottom + 30, gap: 28 }}>
      {t.following.length ? (
        <View style={styles.rows}>
          {t.following.map((f, i) => (
            <Pressable key={f.topic} onPress={() => { feel('select'); onOpen(f.topic); }} accessibilityRole="button" accessibilityLabel={`Histoire du sujet ${f.topic}`}>
              <View style={[styles.row, i === t.following.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowT}>{f.topic}</Text>
                  <Text style={styles.rowH}>{f.last_at ? `Dernière info ${when(f.last_at).toLowerCase()}` : 'Pas encore d’info'}{t.alerts && !f.alerts ? ' · alertes coupées' : ''}</Text>
                </View>
                {f.new > 0 ? <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badge}><Text style={styles.badgeT}>{f.new > 9 ? '9+' : f.new} nouv.</Text></LinearGradient> : null}
                <Text style={styles.v}>›</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.p}>Suivez un sujet (« Ukraine », « Budget »…) : {t.alerts ? 'une alerte quand il bouge, et ' : ''}toute son histoire en un coup d'œil. Vous pouvez aussi le faire depuis un article.</Text>
      )}
      {more.length ? (
        <View style={{ gap: 12 }}>
          <Text style={st.label}>Ajouter un sujet</Text>
          <View style={styles.chips}>
            {more.slice(0, 40).map((k) => <Chip key={k} label={`+ ${k}`} on={false} onPress={() => toggleFrom(k, t, onOpen, onToast)} />)}
          </View>
          {t.following.length >= t.max ? <Text style={styles.hint}>{t.max} sujets au plus : retirez-en un pour en suivre un autre.</Text> : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

/* ---------- La frise ---------- */
function TimelineView({ topic, onToast, onOpenArticle, onUnfollow }: { topic: string; onToast: (m: string) => void; onOpenArticle: (id: string) => boolean; onUnfollow: () => void }) {
  const insets = useSafeAreaInsets();
  const t = useTopics();
  const [tl, setTl] = useState<Timeline | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { loadTimeline(topic).then(setTl, () => setErr(true)); }, [topic]);
  const f = t?.following.find((x) => x.topic === topic);
  const run = async (p: Promise<unknown>, msg: string) => { try { await p; onToast(msg); } catch (e) { onToast(e instanceof Error ? e.message : 'Action impossible.'); } };
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 26, paddingBottom: insets.bottom + 30 }}>
      <View style={[styles.rows, { marginBottom: 26 }]}>
        <View style={[styles.row, !t?.alerts && { borderBottomWidth: 0 }]}>
          <View style={{ flex: 1 }}><Text style={styles.rowT}>Suivre ce sujet</Text></View>
          <Toggle label="Suivre ce sujet" on={!!f} onPress={() => { feel('select', 'tick');
            if (f) run(follow(topic, false), `Vous ne suivez plus ${topic}.`).then(onUnfollow);
            else run(follow(topic, true), `Vous suivez ${topic}.`); }} />
        </View>
        {t?.alerts ? (
          <View style={[styles.row, { borderBottomWidth: 0, opacity: f ? 1 : 0.4 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowT}>Alerte quand il bouge</Text>
              <Text style={styles.rowH}>Quelques-unes par jour au plus, jamais la nuit</Text>
            </View>
            <Toggle label="Alerte quand il bouge" on={!!f?.alerts} onPress={() => { if (!f) return; feel('select', 'tick');
              run(follow(topic, true, !f.alerts), f.alerts ? 'Alertes coupées pour ce sujet.' : 'Alertes activées.'); }} />
          </View>
        ) : null}
      </View>
      {err ? <Text style={styles.p}>Impossible de charger l'histoire du sujet. Réessayez plus tard.</Text>
        : !tl ? <ActivityIndicator color={C.soft} style={{ marginTop: 20 }} />
        : !tl.items.length ? <Text style={styles.p}>Rien sur ce sujet ces dernières semaines. Vous serez prévenu dès qu'il bouge.</Text>
        : tl.items.map((i, k) => (
          <Animated.View key={i.kind + i.id} entering={FadeIn.delay(Math.min(k, 8) * 50).duration(260)} style={styles.step}>
            <View style={styles.rail}>
              <View style={[styles.dot, i.fresh && styles.dotNew, i.kind === 'f' && styles.dotFlash]} />
              {k < tl.items.length - 1 ? <View style={styles.line} /> : null}
            </View>
            <Pressable style={{ flex: 1, paddingBottom: 22 }} disabled={i.kind !== 'a'} accessibilityRole={i.kind === 'a' ? 'button' : undefined}
              onPress={() => { if (!onOpenArticle(i.id)) onToast('Cette info date d’une édition précédente.'); }}>
              <Text style={styles.when}>{when(i.at).toUpperCase()}{i.kind === 'f' ? ' · DERNIÈRE MINUTE' : i.rubric ? ` · ${(RUBRIC_LIST.find((r) => r.id === i.rubric)?.name ?? '').toUpperCase()}` : ''}{i.fresh ? ' · NOUVEAU' : ''}</Text>
              <Text style={styles.stepT}>{i.title}</Text>
              <Text style={styles.stepP}>{i.sentence.replace(/<\/?b>/g, '')}</Text>
            </Pressable>
          </Animated.View>
        ))}
    </ScrollView>
  );
}

/** « Aujourd'hui, 14 h 05 », « Hier », « Lundi 17 novembre ». */
function when(iso: string) {
  const d = new Date(iso);
  const day = (x: Date) => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(x);
  const p = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric', minute: '2-digit' }).formatToParts(d);
  const hm = `${Number(p.find((x) => x.type === 'hour')?.value)} h ${p.find((x) => x.type === 'minute')?.value}`;
  if (day(d) === day(new Date())) return `Aujourd'hui, ${hm}`;
  if (day(d) === day(new Date(Date.now() - 86400e3))) return 'Hier';
  const s = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  followBox: { borderTopWidth: 1, borderColor: C.line, paddingTop: 14, marginTop: 22, gap: 10 },
  lbl: { color: C.text3, fontFamily: F.semi, fontSize: 11, letterSpacing: 1.6 },
  hint: { color: C.text3, fontFamily: F.regular, fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, paddingHorizontal: 26, paddingBottom: 22 },
  h1: { color: '#fff', fontFamily: F.black, fontSize: 26, lineHeight: 28 },
  sub: { color: C.text2, fontFamily: F.regular, fontSize: 13, marginTop: 8 },
  close: { color: C.link, fontFamily: F.semi, fontSize: 14 },
  p: { color: C.text2, fontFamily: F.regular, fontSize: 15, lineHeight: 22 },
  rows: { borderRadius: 18, backgroundColor: C.surface, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderColor: C.line },
  rowT: { color: '#fff', fontFamily: F.regular, fontSize: 15 },
  rowH: { color: C.text3, fontFamily: F.regular, fontSize: 12, marginTop: 2 },
  v: { color: C.text2, fontFamily: F.regular, fontSize: 14 },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  badgeT: { color: '#fff', fontFamily: F.semi, fontSize: 11 },
  step: { flexDirection: 'row', gap: 14 },
  rail: { width: 14, alignItems: 'center' },
  dot: { width: 11, height: 11, borderRadius: 6, marginTop: 3, backgroundColor: C.night, borderWidth: 2, borderColor: alpha(C.soft, 0.7) },
  dotNew: { backgroundColor: C.violet, borderColor: C.soft },
  dotFlash: { borderColor: C.coral },
  line: { flex: 1, width: 2, marginTop: 4, backgroundColor: C.line },
  when: { color: C.soft, fontFamily: F.semi, fontSize: 11, letterSpacing: 1.2, marginBottom: 5 },
  stepT: { color: '#fff', fontFamily: F.black, fontSize: 17, lineHeight: 21 },
  stepP: { color: C.text2, fontFamily: F.regular, fontSize: 14, lineHeight: 20, marginTop: 5 },
});
