import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, GRAD, GRAD3, DRAWER_MS } from './theme';
import { RUBRICS } from './content';
import { CREDITS } from './edition';
import { AppIcon, Chip, GradButton, Press, SoftButton, Toggle, st } from './ui';
import { feel } from './feel';
import { todayLabel, tomorrowLabel } from './dates';

const DRAWER = Easing.bezier(0.32, 0.72, 0, 1);
const OUT = Easing.bezier(0.23, 1, 0.32, 1);

/* ---------- Lancement : moins de 2 secondes (§4.2) ---------- */
export function Splash({ onDone }: { onDone: () => void }) {
  const o = useSharedValue(0);
  const s = useSharedValue(0.96);
  useEffect(() => {
    o.value = withTiming(1, { duration: 300, easing: OUT });
    s.value = withTiming(1, { duration: 500, easing: OUT });
    const t = setTimeout(onDone, 1500);
    return () => clearTimeout(t);
  }, []);
  const a = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: s.value }] }));
  return (
    <Animated.View exiting={FadeOut.duration(350)} style={StyleSheet.absoluteFill}>
      <LinearGradient colors={GRAD3} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Animated.View style={[{ alignItems: 'center', gap: 12 }, a]}>
          <AppIcon size={64} glass />
          <Text style={{ color: '#fff', fontFamily: F.black, fontSize: 72, letterSpacing: -2.5 }}>TITRE</Text>
          <Text style={{ color: 'rgba(255,255,255,0.9)', fontFamily: F.regular, fontSize: 17 }}>{todayLabel()}</Text>
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
}

/* ---------- Première ouverture (§4.1) ---------- */
export type OnbResult = { active: string[]; quota: number; time: string; adsPersonalized: boolean; premium?: boolean };
export function Onboarding({ W, onDone }: { W: number; onDone: (r: OnbResult) => void }) {
  const insets = useSafeAreaInsets();
  const [i, setI] = useState(0);
  const [active, setActive] = useState<string[]>(['france', 'monde', 'eco', 'tech']);
  const [quota, setQuota] = useState(8);
  const [time, setTime] = useState('7 h 30');
  const [adsP, setAdsP] = useState(false);
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withTiming(-i * W, { duration: DRAWER_MS, easing: DRAWER });
  }, [i, W]);
  const track = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const next = () => { setI((k) => Math.min(4, k + 1)); feel('light'); };
  const finish = (ads: boolean) => onDone({ active, quota, time, adsPersonalized: ads });
  const toggle = (id: string) => { setActive((a) => (a.includes(id) ? a.filter((k) => k !== id) : [...a, id])); feel('select', 'tick'); };
  const step = (children: React.ReactNode) => (
    <View style={[styles.step, { width: W, paddingBottom: Math.max(30, insets.bottom + 16) }]}>{children}</View>
  );
  return (
    <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(400)} style={[StyleSheet.absoluteFill, { backgroundColor: C.night }]}>
      <LinearGradient colors={['rgba(123,92,255,0.28)', 'rgba(14,11,31,0)']} style={[StyleSheet.absoluteFill, { height: '60%' }]} />
      <View style={[styles.onbTop, { paddingTop: insets.top + 14 }]}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {[0, 1, 2, 3, 4].map((k) => <Dot key={k} on={k === i} />)}
        </View>
        <Pressable onPress={() => finish(false)} hitSlop={12} accessibilityRole="button"><Text style={styles.close}>Passer</Text></Pressable>
      </View>
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <Animated.View style={[{ flexDirection: 'row', flex: 1, width: W * 5 }, track]}>
          {step(<>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><AppIcon size={112} /></View>
            <Text style={styles.h}>L'actu ultra résumée.</Text>
            <Text style={styles.p}>Tout ce que vous devez savoir, sur ce qui vous intéresse. Avec 80 % de temps en moins qu'un média classique.</Text>
            <GradButton label="Commencer" onPress={next} />
          </>)}
          {step(<>
            <View style={{ flex: 1 }} />
            <Text style={styles.h}>Qu'est-ce qui vous intéresse ?</Text>
            <Text style={styles.p}>Trois rubriques ou plus, c'est conseillé. Vous pourrez changer à tout moment.</Text>
            <View style={styles.chips}>{RUBRICS.map((r) => <Chip key={r.id} label={r.name} on={active.includes(r.id)} onPress={() => toggle(r.id)} />)}</View>
            <GradButton label={active.length ? `Continuer (${active.length})` : 'Choisissez au moins une rubrique'} disabled={!active.length} onPress={next} />
          </>)}
          {step(<>
            <View style={{ flex: 1 }} />
            <Text style={styles.h}>Combien d'infos par jour ?</Text>
            <Text style={styles.p}>Quand vous les avez lues, c'est fini pour aujourd'hui.</Text>
            <View style={{ gap: 10 }}>
              {[[8, 'environ 3 minutes'], [16, 'environ 6 minutes'], [32, 'environ 12 minutes']].map(([q, m]) => (
                <Press key={q} onPress={() => { setQuota(q as number); feel('select', 'tick'); }} accessibilityState={{ selected: quota === q }}>
                  {quota === q ? (
                    <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.qopt}>
                      <Text style={styles.qN}>{q}</Text><Text style={[styles.qM, { color: '#fff' }]}>{m}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={[styles.qopt, { borderWidth: 1, borderColor: C.line }]}>
                      <Text style={styles.qN}>{q}</Text><Text style={styles.qM}>{m}</Text>
                    </View>
                  )}
                </Press>
              ))}
            </View>
            <GradButton label="Continuer" onPress={next} />
          </>)}
          {step(<>
            <View style={{ flex: 1 }} />
            <Text style={styles.h}>Votre édition, chaque matin.</Text>
            <Text style={styles.p}>Une seule notification par jour, quand l'édition est prête. Rien d'autre.</Text>
            <View style={styles.chips}>{['7 h 00', '7 h 30', '8 h 00', '12 h 30'].map((t) => <Chip key={t} label={t} on={time === t} onPress={() => { setTime(t); feel('select', 'tick'); }} />)}</View>
            <GradButton label="Activer la notification" onPress={next} />
            <SoftButton label="Plus tard" onPress={next} />
          </>)}
          {step(<>
            <View style={{ flex: 1 }} />
            <Text style={styles.h}>Gratuit, grâce à quelques pubs.</Text>
            <Text style={styles.p}>Une carte sponsorisée de temps en temps, jamais plus d'une toutes les six infos. Premium les retire toutes.</Text>
            <View style={styles.rows}>
              <Row label="Pubs selon mes centres d'intérêt" hint="Sinon, des pubs sans ciblage" last>
                <Toggle label="Pubs selon mes centres d'intérêt" on={adsP} onPress={() => setAdsP(!adsP)} />
              </Row>
            </View>
            <GradButton label="Continuer" onPress={() => finish(adsP)} />
            <SoftButton label="Premium sans pub · 2,99 €/mois" onPress={() => { feel('success', 'ding'); onDone({ active, quota, time, adsPersonalized: false, premium: true }); }} />
          </>)}
        </Animated.View>
      </View>
    </Animated.View>
  );
}
function Dot({ on }: { on: boolean }) {
  const w = useSharedValue(on ? 22 : 6);
  useEffect(() => { w.value = withTiming(on ? 22 : 6, { duration: 350, easing: OUT }); }, [on]);
  const a = useAnimatedStyle(() => ({ width: w.value }));
  return <Animated.View style={[{ height: 6, borderRadius: 3, backgroundColor: on ? '#fff' : 'rgba(255,255,255,0.25)' }, a]} />;
}

/* ---------- Réglages (§4.9) ---------- */
export type Prefs = { active: string[]; quota: number; sound: boolean; haptic: boolean; parallax: boolean; premium: boolean; time: string; adsPersonalized: boolean };
export function Settings({ W, prefs, onSave, onClose, account, onAccount }: {
  W: number; prefs: Prefs; onSave: (p: Prefs) => void; onClose: () => void;
  /** Pseudo du lecteur connecté, '' sans pseudo, null s'il n'est pas connecté. */
  account: string | null; onAccount: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [d, setD] = useState(prefs);
  const x = useSharedValue(W);
  useEffect(() => { x.value = withTiming(0, { duration: DRAWER_MS, easing: DRAWER }); }, []);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const leave = (cb: () => void) => { x.value = withTiming(W, { duration: 380, easing: DRAWER }); setTimeout(cb, 360); };
  const set = (k: keyof Prefs, v: Prefs[keyof Prefs]) => setD((p) => ({ ...p, [k]: v }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: C.night }, a]}>
      <View style={[styles.setHead, { paddingTop: insets.top + 18 }]}>
        <View>
          <Text style={styles.setH}>Mes infos,{'\n'}mes réglages</Text>
          <Text style={[styles.p, { fontSize: 13, marginTop: 8 }]}>Modifiables à tout moment</Text>
        </View>
        <Pressable onPress={() => leave(onClose)} hitSlop={12}><Text style={styles.close}>Fermer</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 26, paddingBottom: 30, gap: 30 }}>
        <View style={{ gap: 12 }}>
          <Text style={st.label}>Rubriques</Text>
          <View style={styles.chips}>
            {RUBRICS.map((r) => (
              <Chip key={r.id} label={r.name} on={d.active.includes(r.id)} onPress={() => {
                if (d.active.includes(r.id) && d.active.length <= 1) return;
                set('active', d.active.includes(r.id) ? d.active.filter((k) => k !== r.id) : [...d.active, r.id]);
                feel('select', 'tick');
              }} />
            ))}
          </View>
        </View>
        <View style={{ gap: 12 }}>
          <Text style={st.label}>Infos par jour</Text>
          <View style={styles.seg}>
            {[8, 16, 32].map((q) => (
              <Press key={q} style={{ flex: 1 }} onPress={() => { set('quota', q); feel('select', 'tick'); }}>
                {d.quota === q ? (
                  <LinearGradient colors={GRAD} style={styles.segBtn}><Text style={styles.segN}>{q}</Text><Text style={[styles.segM, { color: '#fff' }]}>≈ {q * 0.375} min</Text></LinearGradient>
                ) : (
                  <View style={styles.segBtn}><Text style={styles.segN}>{q}</Text><Text style={styles.segM}>≈ {q * 0.375} min</Text></View>
                )}
              </Press>
            ))}
          </View>
        </View>
        <View style={{ gap: 12 }}>
          <Text style={st.label}>Ressenti</Text>
          <View style={styles.rows}>
            <Row label="Sons" hint="Discrets, coupés en mode silencieux"><Toggle label="Sons" on={d.sound} onPress={() => set('sound', !d.sound)} /></Row>
            <Row label="Vibrations"><Toggle label="Vibrations" on={d.haptic} onPress={() => set('haptic', !d.haptic)} /></Row>
            <Row label="Effet de profondeur" hint="La photo suit l'inclinaison du téléphone" last><Toggle label="Effet de profondeur" on={d.parallax} onPress={() => set('parallax', !d.parallax)} /></Row>
          </View>
        </View>
        <View style={{ gap: 12 }}>
          <Text style={st.label}>Notification</Text>
          <View style={styles.rows}><Row label="Votre édition est prête" last><Text style={styles.v}>{d.time}</Text></Row></View>
        </View>
        <View style={{ gap: 12 }}>
          <Text style={st.label}>Compte</Text>
          <View style={styles.rows}>
            <Pressable onPress={onAccount} accessibilityRole="button">
              {account === null ? (
                <Row label="Se connecter ou créer un compte" hint="Pour aimer les infos et commenter" last={d.premium}><Text style={styles.v}>›</Text></Row>
              ) : (
                <Row label="Mon compte" last={d.premium}><Text style={styles.v}>{account || 'Choisir un pseudo'} ›</Text></Row>
              )}
            </Pressable>
            {!d.premium ? (
              <Row label="Pubs selon mes centres d'intérêt" hint="Les pubs restent en gratuit ; ceci règle seulement le ciblage" last>
                <Toggle label="Pubs selon mes centres d'intérêt" on={d.adsPersonalized} onPress={() => set('adsPersonalized', !d.adsPersonalized)} />
              </Row>
            ) : null}
          </View>
          <LinearGradient colors={['rgba(200,107,250,0.28)', 'rgba(61,123,255,0.25)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.prem}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontFamily: F.black, fontSize: 16 }}>{d.premium ? 'Premium actif' : 'TITRE Premium'}</Text>
              <Text style={[styles.p, { fontSize: 13 }]}>{d.premium ? 'Aucune pub dans votre fil.' : 'Zéro pub. 2,99 €/mois ou 24,99 €/an.'}</Text>
            </View>
            <SoftButton label={d.premium ? 'Gérer' : 'Essayer'} onPress={() => { set('premium', !d.premium); if (!d.premium) feel('success', 'ding'); }} style={{ height: 38, borderRadius: 12 }} />
          </LinearGradient>
        </View>
        <View style={{ gap: 8 }}>
          <Text style={st.label}>Crédits photos</Text>
          <Text style={{ color: C.text3, fontFamily: F.regular, fontSize: 12, lineHeight: 19 }}>{CREDITS}</Text>
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: 26, paddingTop: 10, paddingBottom: Math.max(20, insets.bottom + 8) }}>
        <GradButton label="Enregistrer" onPress={() => leave(() => onSave(d))} />
      </View>
    </Animated.View>
  );
}
function Row({ label, hint, last, children }: { label: string; hint?: string; last?: boolean; children: React.ReactNode }) {
  return (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#fff', fontFamily: F.regular, fontSize: 15 }}>{label}</Text>
        {hint ? <Text style={{ color: C.text3, fontFamily: F.regular, fontSize: 12, marginTop: 2 }}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/* ---------- Bravo (§4.7) + série (§16.6) ---------- */
export function Bravo({ n, realMs, canMore, moreCount, onMore, onTomorrow }: { n: number; realMs: number; canMore: boolean; moreCount: number; onMore: () => void; onTomorrow: () => void }) {
  const insets = useSafeAreaInsets();
  const [how, setHow] = useState(false);
  const real = Math.max(realMs, n * 25000);
  const classic = n * 4; // 4 minutes par article classique
  const saved = Math.max(0, classic - real / 60000);
  const pct = Math.round((saved / classic) * 100);
  const wave = useSharedValue(0.2);
  useEffect(() => {
    wave.value = withTiming(1.8, { duration: 2400, easing: OUT });
    feel('success', 'chord');
  }, []);
  const w = useAnimatedStyle(() => ({ transform: [{ scale: wave.value }], opacity: 0.55 - (wave.value - 0.2) * 0.15 }));
  return (
    <Animated.View entering={FadeIn.duration(450)} exiting={FadeOut.duration(300)} style={[StyleSheet.absoluteFill, { backgroundColor: C.night }]}>
      <Animated.View style={[styles.wave, w]}><LinearGradient colors={GRAD3} style={StyleSheet.absoluteFill} /></Animated.View>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 30, paddingTop: insets.top + 30, paddingBottom: insets.bottom + 30, gap: 20 }}>
        <Stag d={0}><Text style={styles.bravoH}>Bravo !</Text></Stag>
        <Stag d={80}><Text style={styles.lead}>Vous avez lu <Text style={{ fontFamily: F.black }}>{n} infos</Text> en <Text style={{ fontFamily: F.black }}>{fmt(real)}</Text>.</Text></Stag>
        <Stag d={160}>
          <View style={styles.card}>
            <Text style={st.label}>Temps gagné</Text>
            <Text style={styles.big}>{fmtMin(saved)}</Text>
            <Text style={[styles.p, { fontSize: 14 }]}>Avec des articles classiques, il vous aurait fallu environ {fmtMin(classic)}. Soit {pct} % de temps en moins.</Text>
          </View>
        </Stag>
        <Stag d={220}>
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text style={{ color: '#fff', fontFamily: F.black, fontSize: 17 }}>5 jours d'affilée</Text>
              <Text style={{ color: C.text3, fontFamily: F.regular, fontSize: 12 }}>Prochain palier : 7 jours</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((l, k) => {
                const on = k >= 1 && k <= 5;
                const Box: any = on ? LinearGradient : View;
                return (
                  <Box key={k} {...(on ? { colors: GRAD } : {})} style={[styles.day, !on && { backgroundColor: C.surface }, k === 5 && { borderWidth: 2, borderColor: '#fff' }]}>
                    <Text style={{ color: on ? '#fff' : C.text3, fontFamily: F.semi, fontSize: 11 }}>{l}</Text>
                  </Box>
                );
              })}
            </View>
            <Text style={{ color: C.text3, fontFamily: F.regular, fontSize: 12, lineHeight: 17 }}>Un joker disponible cette semaine : une journée manquée ne casse pas la série.</Text>
          </View>
        </Stag>
        <Stag d={260}>
          <Pressable onPress={() => setHow(!how)}><Text style={styles.how}>Comment on calcule ?</Text></Pressable>
          {how ? <Text style={[styles.p, { fontSize: 13, marginTop: 10 }]}>Temps réel : la somme du temps passé sur chaque carte et chaque résumé. Temps classique : 4 minutes par article de presse moyen. Temps gagné : la différence entre les deux.</Text> : null}
        </Stag>
        <Stag d={300}>
          <View style={{ gap: 10 }}>
            <GradButton label="À demain" onPress={onTomorrow} />
            {canMore ? <SoftButton label={`Charger plus (${moreCount} infos)`} onPress={onMore} /> : null}
          </View>
        </Stag>
      </ScrollView>
    </Animated.View>
  );
}
function Stag({ d, children }: { d: number; children: React.ReactNode }) {
  return <Animated.View entering={FadeIn.delay(d).duration(450)}>{children}</Animated.View>;
}

/* ---------- Fin de journée (§4.8) ---------- */
export function End({ n, realMs, allRead, left, onReread }: { n: number; realMs: number; allRead: boolean; left: number; onReread: () => void }) {
  const insets = useSafeAreaInsets();
  useEffect(() => { feel(null, 'soft'); }, []);
  const real = Math.max(realMs, n * 25000);
  return (
    <Animated.View entering={FadeIn.duration(900)} exiting={FadeOut.duration(400)} style={StyleSheet.absoluteFill}>
      <LinearGradient colors={['#120e2a', C.night]} style={[StyleSheet.absoluteFill, { justifyContent: 'center', paddingHorizontal: 32, paddingTop: insets.top, paddingBottom: insets.bottom, gap: 24 }]}>
        <View style={styles.moon} />
        <Text style={styles.endH}>{allRead ? "C'est tout pour aujourd'hui." : 'Bonne journée.'}{'\n'}<Text style={{ color: '#b9a8ff' }}>À demain.</Text></Text>
        <Text style={[styles.p, { fontSize: 17 }]}>
          {allRead ? 'Vous avez lu toutes les infos du jour. ' : `Il reste ${left} infos aujourd'hui si vous changez d'avis. `}Prochaine édition {tomorrowLabel()} à 6 h 00.
        </Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[[String(n), 'infos lues'], [fmt(real).replace(/ \d+ s$/, ''), 'de lecture'], ['5 jours', "d'affilée"]].map(([b, s]) => (
            <View key={s} style={styles.stat}><Text style={styles.statN}>{b}</Text><Text style={{ color: C.text3, fontFamily: F.regular, fontSize: 12 }}>{s}</Text></View>
          ))}
        </View>
        <SoftButton label="Relire les infos du jour" onPress={onReread} />
      </LinearGradient>
    </Animated.View>
  );
}

/* ---------- Message bref ---------- */
export function Toast({ msg, top }: { msg: string | null; top: number }) {
  if (!msg) return null;
  return (
    <Animated.View key={msg} entering={FadeIn.duration(200)} exiting={FadeOut.duration(250)} pointerEvents="none" style={[styles.toast, { top }]}>
      <Text style={{ color: '#fff', fontFamily: F.regular, fontSize: 13 }}>{msg}</Text>
    </Animated.View>
  );
}

export function fmt(ms: number) {
  let s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  s = s % 60;
  return m ? `${m} min ${s < 10 ? '0' : ''}${s} s` : `${s} s`;
}
export function fmtMin(min: number) {
  const t = Math.max(0, Math.round(min));
  const h = Math.floor(t / 60), m = t % 60;
  return h ? `${h} h ${m < 10 ? '0' : ''}${m}` : `${m} min`;
}

const styles = StyleSheet.create({
  step: { paddingHorizontal: 30, paddingTop: 20, gap: 18 },
  onbTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 26 },
  close: { color: '#cfd9ff', fontFamily: F.semi, fontSize: 14 },
  h: { color: '#fff', fontFamily: F.black, fontSize: 34, lineHeight: 36, letterSpacing: -0.6 },
  p: { color: C.text2, fontFamily: F.regular, fontSize: 16, lineHeight: 24 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 4 },
  qopt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 20 },
  qN: { color: '#fff', fontFamily: F.black, fontSize: 28 },
  qM: { color: C.text2, fontFamily: F.regular, fontSize: 14 },
  setHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 26, paddingBottom: 18 },
  setH: { color: '#fff', fontFamily: F.black, fontSize: 26, lineHeight: 28 },
  seg: { flexDirection: 'row', gap: 6, padding: 5, borderRadius: 18, backgroundColor: C.surface },
  segBtn: { borderRadius: 14, alignItems: 'center', paddingVertical: 10, gap: 2 },
  segN: { color: '#fff', fontFamily: F.black, fontSize: 22 },
  segM: { color: C.text2, fontFamily: F.regular, fontSize: 11 },
  rows: { borderRadius: 18, backgroundColor: C.surface, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderColor: C.line },
  v: { color: C.text2, fontFamily: F.regular, fontSize: 14 },
  prem: { borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: 'rgba(200,170,255,0.3)' },
  wave: { position: 'absolute', left: '50%', top: '30%', width: 240, height: 240, marginLeft: -120, marginTop: -120, borderRadius: 120, overflow: 'hidden' },
  bravoH: { color: '#fff', fontFamily: F.black, fontSize: 48, letterSpacing: -1.5 },
  lead: { color: '#fff', fontFamily: F.regular, fontSize: 21, lineHeight: 28 },
  card: { borderRadius: 22, padding: 18, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, gap: 6 },
  big: { color: '#cbb8ff', fontFamily: F.black, fontSize: 44 },
  day: { flex: 1, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  how: { color: '#cfd9ff', fontFamily: F.regular, fontSize: 13, textDecorationLine: 'underline' },
  moon: { width: 64, height: 64, borderRadius: 32, borderWidth: 0, backgroundColor: 'transparent', shadowColor: '#cbbcff', borderLeftWidth: 14, borderBottomWidth: 6, borderColor: '#cbbcff', transform: [{ rotate: '-20deg' }] },
  endH: { color: '#fff', fontFamily: F.black, fontSize: 42, lineHeight: 44, letterSpacing: -1 },
  stat: { flex: 1, borderRadius: 18, backgroundColor: C.surface, padding: 14 },
  statN: { color: '#fff', fontFamily: F.black, fontSize: 22 },
  toast: { position: 'absolute', alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, backgroundColor: 'rgba(30,24,64,0.94)', borderWidth: 1, borderColor: C.line, maxWidth: '86%' },
});

