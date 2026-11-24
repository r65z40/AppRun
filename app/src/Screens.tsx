import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, GRAD, GRAD3, DRAWER_MS, alpha } from './theme';
import { BRAND, NOTIF, RECAP, RECOG, RULES, TEXTS } from './brand';
import { setNotif } from './notify';
import { RUBRIC_LIST } from './content';
import { accountsOn, legalText } from './account';
import { SavedTime } from './Badges';
import { AppIcon, Chip, GradButton, SoftButton, Toggle, st } from './ui';
import { feel } from './feel';
import { isoDay, shortDay, todayLabel, tomorrowLabel } from './dates';
import { WEEK, loadEditionDates } from './remote';

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
          <Text style={{ color: '#fff', fontFamily: F.black, fontSize: 72, letterSpacing: -2.5 }}>{BRAND.name}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.9)', fontFamily: F.regular, fontSize: 17 }}>{todayLabel()}</Text>
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
}

/* ---------- Première ouverture (§4.1) ---------- */
/** premium : le lecteur veut voir l'offre Premium dès la fin de la présentation. */
export type OnbResult = { active: string[]; quota: number; time: string; adsPersonalized: boolean; premium?: boolean; account?: boolean; notif?: Promise<boolean> };
export function Onboarding({ W, onDone }: { W: number; onDone: (r: OnbResult) => void }) {
  const insets = useSafeAreaInsets();
  const [i, setI] = useState(0);
  const [active, setActive] = useState<string[]>([...RULES.default_rubrics]);
  const [quota, setQuota] = useState(RULES.default_quota);
  const [time, setTime] = useState(NOTIF.default_time);
  const [adsP, setAdsP] = useState(false);
  const [notif, setNotifP] = useState<Promise<boolean> | undefined>(undefined);
  const [privacy, setPrivacy] = useState(false);
  // Dernière étape (avec la vraie base) : proposer un compte pour une édition plus pertinente.
  const N = (accountsOn ? 6 : 5) - (NOTIF.enabled ? 0 : 1);
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withTiming(-i * W, { duration: DRAWER_MS, easing: DRAWER });
  }, [i, W]);
  const track = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const next = () => { setI((k) => Math.min(N - 1, k + 1)); feel('light'); };
  const finish = (ads: boolean, more: Partial<OnbResult> = {}) => onDone({ active, quota, time, adsPersonalized: ads, notif, ...more });
  const toggle = (id: string) => { setActive((a) => (a.includes(id) ? a.filter((k) => k !== id) : [...a, id])); feel('select', 'tick'); };
  const step = (children: React.ReactNode) => (
    <View style={[styles.step, { width: W, paddingBottom: Math.max(30, insets.bottom + 16) }]}>{children}</View>
  );
  return (
    <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(400)} style={[StyleSheet.absoluteFill, { backgroundColor: C.night }]}>
      <LinearGradient colors={[alpha(C.violet, 0.28), alpha(C.night, 0)]} style={[StyleSheet.absoluteFill, { height: '60%' }]} />
      <View style={[styles.onbTop, { paddingTop: insets.top + 14 }]}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {Array.from({ length: N }, (_, k) => <Dot key={k} on={k === i} />)}
        </View>
        <Pressable onPress={() => finish(false)} hitSlop={12} accessibilityRole="button"><Text style={styles.close}>Passer</Text></Pressable>
      </View>
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <Animated.View style={[{ flexDirection: 'row', flex: 1, width: W * N }, track]}>
          {step(<>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><AppIcon size={112} /></View>
            <Text style={styles.h}>{TEXTS.welcome_title}</Text>
            <Text style={styles.p}>{TEXTS.welcome_text}</Text>
            <GradButton label="Commencer" onPress={next} />
          </>)}
          {step(<>
            <View style={{ flex: 1 }} />
            <Text style={styles.h}>Qu'est-ce qui vous intéresse ?</Text>
            <Text style={styles.p}>Trois rubriques ou plus, c'est conseillé. Vous pourrez changer à tout moment.</Text>
            <View style={styles.chips}>{RUBRIC_LIST.map((r) => <Chip key={r.id} label={r.name} on={active.includes(r.id)} onPress={() => toggle(r.id)} />)}</View>
            <GradButton label={active.length ? `Continuer (${active.length})` : 'Choisissez au moins une rubrique'} disabled={!active.length} onPress={next} />
          </>)}
          {step(<>
            <View style={{ flex: 1 }} />
            <Text style={styles.h}>Combien d'infos par jour ?</Text>
            <Text style={styles.p}>Quand vous les avez lues, c'est fini pour aujourd'hui. Faites glisser, de 4 en 4.</Text>
            <QuotaWheel value={quota} onChange={setQuota} />
            <GradButton label="Continuer" onPress={next} />
          </>)}
          {NOTIF.enabled ? step(<>
            <View style={{ flex: 1 }} />
            <Text style={styles.h}>{TEXTS.notif_title}</Text>
            <Text style={styles.p}>{TEXTS.notif_text}</Text>
            <TimeChoice value={time} onChange={setTime} />
            <GradButton label="Activer la notification" onPress={() => { setNotifP(setNotif(true, time, quota)); next(); }} />
            <SoftButton label="Plus tard" onPress={next} />
          </>) : null}
          {step(<>
            <View style={{ flex: 1 }} />
            <Text style={styles.h}>{TEXTS.ads_title}</Text>
            <Text style={styles.p}>{TEXTS.ads_text}</Text>
            <View style={styles.rows}>
              <Row label="Pubs selon mes centres d'intérêt" hint="Sinon, des pubs sans ciblage" last>
                <Toggle label="Pubs selon mes centres d'intérêt" on={adsP} onPress={() => setAdsP(!adsP)} />
              </Row>
            </View>
            <Pressable onPress={() => setPrivacy(true)} hitSlop={8} accessibilityRole="link"><Text style={styles.how}>Vos données et vos choix</Text></Pressable>
            <GradButton label="Continuer" onPress={() => (accountsOn ? next() : finish(adsP))} />
            <SoftButton label="Premium sans pub" onPress={() => { feel('light'); finish(adsP, { premium: true }); }} />
          </>)}
          {accountsOn ? step(<>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><AppIcon size={96} /></View>
            <Text style={styles.h}>Une actu encore plus pertinente.</Text>
            <Text style={styles.p}>Avec un compte gratuit, vos likes et dislikes affinent l'ordre de votre édition, et vos rubriques vous suivent sur tous vos appareils. Vous pourrez aussi commenter.</Text>
            <GradButton label="Créer mon compte gratuit" onPress={() => finish(adsP, { account: true })} />
            <SoftButton label="Plus tard" onPress={() => finish(adsP)} />
          </>) : null}
        </Animated.View>
      </View>
      {privacy ? <Legal page="privacy" onClose={() => setPrivacy(false)} /> : null}
    </Animated.View>
  );
}
function Dot({ on }: { on: boolean }) {
  const w = useSharedValue(on ? 22 : 6);
  useEffect(() => { w.value = withTiming(on ? 22 : 6, { duration: 350, easing: OUT }); }, [on]);
  const a = useAnimatedStyle(() => ({ width: w.value }));
  return <Animated.View style={[{ height: 6, borderRadius: 3, backgroundColor: on ? '#fff' : 'rgba(255,255,255,0.25)' }, a]} />;
}

/* ---------- Pages légales (back office > Personnalisation > Pages légales) ---------- */
export type LegalPage = 'privacy' | 'terms' | 'notice';
export const LEGAL_PAGES: [LegalPage, string][] = [['privacy', 'Confidentialité'], ['terms', "Conditions d'utilisation"], ['notice', 'Mentions légales']];
/** Aussi affichée seule sur le site (adresse publique demandée par les stores) : ?legal=privacy, terms ou notice. */
export function Legal({ page, onClose }: { page: LegalPage; onClose?: () => void }) {
  const insets = useSafeAreaInsets();
  const [txt, setTxt] = useState<string | null | undefined>(undefined);
  useEffect(() => { legalText(page).then(setTxt, () => setTxt(null)); }, [page]);
  const title = LEGAL_PAGES.find(([k]) => k === page)![1];
  const body = txt === undefined ? '' : txt ? txt.replaceAll('{nom}', BRAND.name) : 'Ce texte n’est pas disponible pour le moment. Réessayez avec une connexion.';
  return (
    <Animated.View entering={FadeIn.duration(200)} style={[StyleSheet.absoluteFill, { backgroundColor: C.night }]}>
      <View style={[styles.setHead, { paddingTop: insets.top + 18 }]}>
        <Text style={styles.setH}>{title}</Text>
        {onClose ? <Pressable onPress={onClose} hitSlop={12}><Text style={styles.close}>Fermer</Text></Pressable> : null}
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 26, paddingBottom: insets.bottom + 30, maxWidth: 720, width: '100%', alignSelf: 'center' }}>
        <Text selectable style={[styles.p, { fontSize: 15, lineHeight: 23 }]}>{body}</Text>
      </ScrollView>
    </Animated.View>
  );
}

/* ---------- Réglages (§4.9) ---------- */
export type Prefs = {
  active: string[]; quota: number; sound: boolean; haptic: boolean; parallax: boolean; premium: boolean; time: string; adsPersonalized: boolean;
  /** Goût par rubrique, appris des likes et dislikes : ordonne « Mon édition » et la roue. */
  taste?: Record<string, number>;
  /** Édition personnalisée par l'algorithme (oui par défaut) ; non = la même édition pour tous. */
  perso?: boolean;
  /** Notification du matin demandée sur cet appareil. */
  notif?: boolean;
};
/** Éditions précédentes : les N derniers jours en gratuit (back office > Règles de l'app), toutes en Premium. */
export function PastDays({ premium, pastDay, onPick, onPremium }: { premium: boolean; pastDay: string | null; onPick: (day: string | null) => void; onPremium: () => void }) {
  const [days, setDays] = useState<string[]>([]);
  useEffect(() => { loadEditionDates().then((l) => setDays(l.filter((x) => x < isoDay()))); }, []);
  const open = premium ? days : days.filter((x) => x >= isoDay(-RULES.past_days_free));
  // Récap de la semaine : proposé à tous, le jour réglé dans le back office.
  const week = RECAP.enabled && days.length > 0 && new Date(`${isoDay()}T12:00:00Z`).getUTCDay() === RECAP.day;
  if (!week && !open.length && (!days.length || premium)) return null;
  return (
    <View style={{ gap: 12 }}>
      <Text style={st.label}>Éditions précédentes</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Chip label="Aujourd'hui" on={!pastDay} onPress={() => { feel('select', 'tick'); onPick(null); }} />
        {week ? <Chip label="La semaine" on={pastDay === WEEK} onPress={() => { feel('select', 'tick'); onPick(WEEK); }} /> : null}
        {open.map((x) => <Chip key={x} label={shortDay(x)} on={pastDay === x} onPress={() => { feel('select', 'tick'); onPick(x); }} />)}
        {!premium && days.length > open.length ? <Chip label="Toutes les dates avec Premium 💎" on={false} onPress={() => { feel('light'); onPremium(); }} /> : null}
      </ScrollView>
    </View>
  );
}

/** Série : jours d'affilée, jusqu'à aujourd'hui, où l'app a été ouverte sur ce téléphone. */
export const streakOf = (visits: string[]) => { let n = 0; while (visits.includes(isoDay(-n))) n++; return n; };
const daysTxt = (n: number) => `${n} jour${n > 1 ? 's' : ''}`;

export function Settings({ W, prefs, onSave, onClose, account, onAccount, premium, onPremium, onResetTaste, onTopics, pastDay, onPast }: {
  W: number; prefs: Prefs; onSave: (p: Prefs) => void; onClose: () => void;
  /** Édition passée affichée (null = la plus récente) ; onPast en ouvre une autre. */
  pastDay: string | null; onPast: (day: string | null) => void;
  /** Premium en cours (abonnement, code, cadeau, ou démo) ; onPremium ouvre le volet Premium. */
  premium: boolean; onPremium: () => void;
  /** Pseudo du lecteur connecté, '' sans pseudo, null s'il n'est pas connecté. */
  account: string | null; onAccount: () => void;
  onResetTaste: () => void;
  /** Ouvre « Mes sujets » (sujets suivis). */
  onTopics?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [d, setD] = useState(prefs);
  const x = useSharedValue(W);
  useEffect(() => { x.value = withTiming(0, { duration: DRAWER_MS, easing: DRAWER }); }, []);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const leave = (cb: () => void) => { x.value = withTiming(W, { duration: 380, easing: DRAWER }); setTimeout(cb, 360); };
  const set = (k: keyof Prefs, v: Prefs[keyof Prefs]) => setD((p) => ({ ...p, [k]: v }));
  const go = (day: string | null) => leave(() => { onClose(); onPast(day); });
  const [legal, setLegal] = useState<LegalPage | null>(null);
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
          <Text style={[styles.p, { fontSize: 13, marginTop: -4 }]}>Les vôtres passent en premier dans la roue ; les autres restent accessibles juste après.</Text>
          <View style={styles.chips}>
            {RUBRIC_LIST.map((r) => (
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
          <QuotaWheel value={d.quota} onChange={(q) => set('quota', q)} />
          {/* Temps gagné chaque jour avec ce nombre d'infos (minutes par info : back office > Reconnaissance). */}
          <SavedTime reads={d.quota} minutes={d.quota * RECOG.minutes_per_article} />
        </View>
        <PastDays premium={premium} pastDay={pastDay} onPick={go} onPremium={onPremium} />
        <View style={{ gap: 12 }}>
          <Text style={st.label}>Mes goûts</Text>
          <View style={styles.rows}>
            <Row label="Édition selon mes goûts" hint="Sinon, la même édition pour tous, et l'app ne note plus ce que vous lisez">
              <Toggle label="Édition selon mes goûts" on={d.perso !== false} onPress={() => set('perso', d.perso === false)} />
            </Row>
            {onTopics ? (
              <Pressable onPress={() => { feel('select'); onTopics(); }} accessibilityRole="button">
                <Row label="Sujets suivis" hint="Une alerte quand ils bougent, et leur histoire"><Text style={styles.v}>›</Text></Row>
              </Pressable>
            ) : null}
            <Pressable onPress={() => { feel('select'); onResetTaste(); }} accessibilityRole="button">
              <Row label="Remettre mes goûts à zéro" hint="L'app oublie ce que vous avez lu et aimé" last><Text style={styles.v}>›</Text></Row>
            </Pressable>
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
        {NOTIF.enabled ? (
          <View style={{ gap: 12 }}>
            <Text style={st.label}>Notification</Text>
            <View style={styles.rows}>
              <Row label="Notification du matin" hint={d.notif ? `Votre édition est prête à ${d.time}.` : 'Coupée sur ce téléphone'} last>
                <Toggle label="Notification du matin" on={!!d.notif} onPress={() => set('notif', !d.notif)} />
              </Row>
            </View>
            {d.notif ? <TimeChoice value={d.time} onChange={(t) => set('time', t)} /> : null}
          </View>
        ) : null}
        <View style={{ gap: 12 }}>
          <Text style={st.label}>Compte</Text>
          <View style={styles.rows}>
            <Pressable onPress={onAccount} accessibilityRole="button">
              {account === null ? (
                <Row label="Se connecter ou créer un compte" hint="Pour aimer les infos et commenter" last={premium}><Text style={styles.v}>›</Text></Row>
              ) : (
                <Row label="Mon compte" hint="Badges et invitations d’amis" last={premium}><Text style={styles.v}>{account || 'Choisir un pseudo'} ›</Text></Row>
              )}
            </Pressable>
            {!premium ? (
              <Row label="Pubs selon mes centres d'intérêt" hint="Les pubs restent en gratuit ; ceci règle seulement le ciblage" last>
                <Toggle label="Pubs selon mes centres d'intérêt" on={d.adsPersonalized} onPress={() => set('adsPersonalized', !d.adsPersonalized)} />
              </Row>
            ) : null}
          </View>
          <LinearGradient colors={['rgba(200,107,250,0.28)', alpha(C.blue, 0.25)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.prem}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontFamily: F.black, fontSize: 16 }}>{premium ? 'Premium actif' : `${BRAND.name} Premium`}</Text>
              <Text style={[styles.p, { fontSize: 13 }]}>{premium ? 'Aucune pub dans votre fil.' : 'Zéro pub, sans engagement.'}</Text>
            </View>
            <SoftButton label={premium ? 'Gérer' : 'Découvrir'} onPress={() => { feel('light'); onPremium(); }} style={{ height: 38, borderRadius: 12 }} />
          </LinearGradient>
        </View>
        <View style={{ gap: 12 }}>
          <Text style={st.label}>Informations</Text>
          <View style={styles.rows}>
            {LEGAL_PAGES.map(([k, l], i) => (
              <Pressable key={k} onPress={() => { feel('select'); setLegal(k); }} accessibilityRole="button">
                <Row label={l} last={i === LEGAL_PAGES.length - 1}><Text style={styles.v}>›</Text></Row>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: 26, paddingTop: 10, paddingBottom: Math.max(20, insets.bottom + 8) }}>
        <GradButton label="Enregistrer" onPress={() => leave(() => onSave(d))} />
      </View>
      {legal ? <Legal page={legal} onClose={() => setLegal(null)} /> : null}
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

/* ---------- Nombre d'infos : carrousel de 4 en 4 ---------- */
const QUOTAS = Array.from({ length: Math.floor(RULES.quota_max / 4) }, (_, k) => (k + 1) * 4); // de 4 en 4, jusqu'au maximum réglé
const QW = 64; // largeur d'un cran
export function QuotaWheel({ value, onChange }: { value: number; onChange: (q: number) => void }) {
  const ref = useRef<ScrollViewInstance>(null);
  const [w, setW] = useState(0);
  const cur = Math.max(0, QUOTAS.indexOf(value));
  const go = (k: number) => {
    const i = Math.max(0, Math.min(QUOTAS.length - 1, k));
    ref.current?.scrollTo({ x: i * QW, animated: true });
    if (QUOTAS[i] !== value) { onChange(QUOTAS[i]); feel('select', 'tick'); }
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.max(0, Math.min(QUOTAS.length - 1, Math.round(e.nativeEvent.contentOffset.x / QW)));
    if (QUOTAS[i] !== value) { onChange(QUOTAS[i]); feel('select', 'tick'); }
  };
  useEffect(() => { if (w) ref.current?.scrollTo({ x: cur * QW, animated: false }); }, [w]);
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Pressable onPress={() => go(cur - 1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="4 infos de moins" style={styles.wArrow}><Text style={styles.wArrowTxt}>−</Text></Pressable>
        <View style={{ flex: 1 }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
          {w ? (
            <ScrollView
              ref={ref}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={QW}
              decelerationRate="fast"
              scrollEventThrottle={16}
              onScroll={onScroll}
              contentContainerStyle={{ paddingHorizontal: (w - QW) / 2 }}
              accessibilityRole="adjustable"
              accessibilityLabel={`${value} infos par jour`}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={(e) => go(cur + (e.nativeEvent.actionName === 'increment' ? 1 : -1))}
            >
              {QUOTAS.map((q, k) => (
                <Pressable key={q} onPress={() => go(k)} style={styles.wItem}>
                  <Text style={[styles.wN, q === value ? styles.wOn : { opacity: Math.max(0.2, 0.6 - Math.abs(k - cur) * 0.15) }]}>{q}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : <View style={{ height: 64 }} />}
          <LinearGradient pointerEvents="none" colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.wMark, { left: (w - 28) / 2 }]} />
        </View>
        <Pressable onPress={() => go(cur + 1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="4 infos de plus" style={styles.wArrow}><Text style={styles.wArrowTxt}>+</Text></Pressable>
      </View>
      <Text style={[styles.p, { fontSize: 13, textAlign: 'center' }]}>{value} infos · environ {Math.max(1, Math.round(value * 0.375))} minutes</Text>
    </View>
  );
}

/* ---------- Heure de l'édition : heures proposées ou n'importe quelle heure ---------- */
const TIMES = ['7 h 00', '7 h 30', '8 h 00', '12 h 30'];
const parseTime = (t: string) => { const m = /(\d+) h (\d+)/.exec(t); return m ? Number(m[1]) * 60 + Number(m[2]) : 450; };
const fmtTime = (min: number) => { const v = ((min % 1440) + 1440) % 1440; return `${Math.floor(v / 60)} h ${String(v % 60).padStart(2, '0')}`; };
export function TimeChoice({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  const custom = !TIMES.includes(value);
  const [open, setOpen] = useState(custom);
  const step = (d: number) => { onChange(fmtTime(parseTime(value) + d)); feel('select', 'tick'); };
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.chips}>
        {TIMES.map((t) => <Chip key={t} label={t} on={value === t && !open} onPress={() => { setOpen(false); onChange(t); feel('select', 'tick'); }} />)}
        <Chip label={custom || open ? value : 'Autre heure'} on={open} onPress={() => { setOpen(true); feel('select', 'tick'); }} />
      </View>
      {open ? (
        <Animated.View entering={FadeIn.duration(200)} style={styles.tPick}>
          {[['heure', 60], ['minutes', 15]].map(([l, d]) => (
            <View key={l as string} style={styles.tCol}>
              <Pressable onPress={() => step(-(d as number))} hitSlop={8} accessibilityLabel={`Moins ${l}`} style={styles.wArrow}><Text style={styles.wArrowTxt}>−</Text></Pressable>
              <Text style={styles.tVal}>{l === 'heure' ? value.split(' h ')[0] + ' h' : value.split(' h ')[1]}</Text>
              <Pressable onPress={() => step(d as number)} hitSlop={8} accessibilityLabel={`Plus ${l}`} style={styles.wArrow}><Text style={styles.wArrowTxt}>+</Text></Pressable>
            </View>
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}

/* ---------- Message de l'équipe à l'ouverture ---------- */
export function Welcome({ title, body, onClose }: { title: string; body: string; onClose: () => void }) {
  useEffect(() => { feel('light', 'soft'); }, []);
  return (
    <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(250)} style={[StyleSheet.absoluteFill, styles.welcomeBg]}>
      <View style={styles.welcome}>
        <AppIcon size={44} />
        <Text style={[styles.h, { fontSize: 26, lineHeight: 29 }]}>{title}</Text>
        {body ? <Text style={styles.p}>{body}</Text> : null}
        <GradButton label="OK" onPress={onClose} />
      </View>
    </Animated.View>
  );
}

/* ---------- Bravo (§4.7) + série (§16.6) ---------- */
export function Bravo({ n, realMs, canMore, moreCount, onMore, onTomorrow, visits, past }: {
  n: number; realMs: number; canMore: boolean; moreCount: number; onMore: () => void; onTomorrow: () => void;
  /** Jours où l'app a été ouverte (« 2026-11-24 »), pour la série. */
  visits: string[];
  /** Les éditions précédentes, proposées en fin de fil. */
  past: React.ReactNode;
}) {
  const streak = streakOf(visits);
  const goal = [7, 30, 100].find((x) => x > streak); // mêmes paliers que les badges Série
  const monday = (new Date(`${isoDay()}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = lundi
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
              <Text style={{ color: '#fff', fontFamily: F.black, fontSize: 17 }}>{daysTxt(streak)} d'affilée</Text>
              {goal ? <Text style={{ color: C.text3, fontFamily: F.regular, fontSize: 12 }}>Prochain palier : {goal} jours</Text> : null}
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((l, k) => {
                const on = visits.includes(isoDay(k - monday));
                const Box: any = on ? LinearGradient : View;
                return (
                  <Box key={k} {...(on ? { colors: GRAD } : {})} style={[styles.day, !on && { backgroundColor: C.surface }, k === monday && { borderWidth: 2, borderColor: '#fff' }]}>
                    <Text style={{ color: on ? '#fff' : C.text3, fontFamily: F.semi, fontSize: 11 }}>{l}</Text>
                  </Box>
                );
              })}
            </View>
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
        <Stag d={340}>{past}</Stag>
      </ScrollView>
    </Animated.View>
  );
}
function Stag({ d, children }: { d: number; children: React.ReactNode }) {
  return <Animated.View entering={FadeIn.delay(d).duration(450)}>{children}</Animated.View>;
}

/* ---------- Fin de journée (§4.8) ---------- */
export function End({ n, realMs, allRead, left, onReread, visits }: { n: number; realMs: number; allRead: boolean; left: number; onReread: () => void; visits: string[] }) {
  const insets = useSafeAreaInsets();
  useEffect(() => { feel(null, 'soft'); }, []);
  const real = Math.max(realMs, n * 25000);
  return (
    <Animated.View entering={FadeIn.duration(900)} exiting={FadeOut.duration(400)} style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[C.night3, C.night]} style={[StyleSheet.absoluteFill, { justifyContent: 'center', paddingHorizontal: 32, paddingTop: insets.top, paddingBottom: insets.bottom, gap: 24 }]}>
        <View style={styles.moon} />
        <Text style={styles.endH}>{allRead ? TEXTS.end_title : 'Bonne journée.'}{'\n'}<Text style={{ color: C.soft }}>{TEXTS.end_bye}</Text></Text>
        <Text style={[styles.p, { fontSize: 17 }]}>
          {allRead ? 'Vous avez lu toutes les infos du jour. ' : `Il reste ${left} infos aujourd'hui si vous changez d'avis. `}De nouvelles infos arrivent au fil de la journée, et l'édition complète {tomorrowLabel()} à {RULES.next_edition}.
        </Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[[String(n), 'infos lues'], [fmt(real).replace(/ \d+ s$/, ''), 'de lecture'], [daysTxt(streakOf(visits)), "d'affilée"]].map(([b, s]) => (
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
  close: { color: C.link, fontFamily: F.semi, fontSize: 14 },
  h: { color: '#fff', fontFamily: F.black, fontSize: 34, lineHeight: 36, letterSpacing: -0.6 },
  p: { color: C.text2, fontFamily: F.regular, fontSize: 16, lineHeight: 24 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 4 },
  setHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 26, paddingBottom: 18 },
  setH: { color: '#fff', fontFamily: F.black, fontSize: 26, lineHeight: 28 },
  rows: { borderRadius: 18, backgroundColor: C.surface, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderColor: C.line },
  v: { color: C.text2, fontFamily: F.regular, fontSize: 14 },
  prem: { borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: 'rgba(200,170,255,0.3)' },
  wave: { position: 'absolute', left: '50%', top: '30%', width: 240, height: 240, marginLeft: -120, marginTop: -120, borderRadius: 120, overflow: 'hidden' },
  bravoH: { color: '#fff', fontFamily: F.black, fontSize: 48, letterSpacing: -1.5 },
  lead: { color: '#fff', fontFamily: F.regular, fontSize: 21, lineHeight: 28 },
  card: { borderRadius: 22, padding: 18, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, gap: 6 },
  big: { color: C.soft, fontFamily: F.black, fontSize: 44 },
  day: { flex: 1, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  how: { color: C.link, fontFamily: F.regular, fontSize: 13, textDecorationLine: 'underline' },
  moon: { width: 64, height: 64, borderRadius: 32, borderWidth: 0, backgroundColor: 'transparent', shadowColor: C.soft, borderLeftWidth: 14, borderBottomWidth: 6, borderColor: C.soft, transform: [{ rotate: '-20deg' }] },
  endH: { color: '#fff', fontFamily: F.black, fontSize: 42, lineHeight: 44, letterSpacing: -1 },
  stat: { flex: 1, borderRadius: 18, backgroundColor: C.surface, padding: 14 },
  statN: { color: '#fff', fontFamily: F.black, fontSize: 22 },
  wArrow: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  wArrowTxt: { color: '#fff', fontFamily: F.semi, fontSize: 20, lineHeight: 22 },
  wItem: { width: QW, height: 64, alignItems: 'center', justifyContent: 'center' },
  wN: { color: '#fff', fontFamily: F.black, fontSize: 22 },
  wOn: { fontSize: 38, letterSpacing: -1 },
  wMark: { position: 'absolute', bottom: 0, width: 28, height: 3, borderRadius: 2 },
  tPick: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 18, backgroundColor: C.surface },
  tCol: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tVal: { color: '#fff', fontFamily: F.black, fontSize: 22 },
  welcomeBg: { backgroundColor: 'rgba(8,6,20,0.7)', justifyContent: 'center', paddingHorizontal: 24 },
  welcome: { borderRadius: 26, padding: 22, gap: 14, backgroundColor: C.night2, borderWidth: 1, borderColor: C.line },
  toast: { position: 'absolute', alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, backgroundColor: 'rgba(30,24,64,0.94)', borderWidth: 1, borderColor: C.line, maxWidth: '86%' },
});

