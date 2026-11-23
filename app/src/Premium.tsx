// Volet « TITRE Premium » : offres, achat dans le store, restauration, code promo, abonnement en cours.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { C, F, DRAWER_MS, alpha } from './theme';
import { BRAND, RULES, TEXTS } from './brand';
import { AppIcon, GradButton } from './ui';
import { feel } from './feel';
import { isPremium, loadPlans, mySubscription, redeemCode, reloadMe, useMe, type MySub, type Plan } from './account';
import { buy, manage, restore, storeOn, storePrices } from './purchases';

const DRAWER = Easing.bezier(0.32, 0.72, 0, 1);
const TERMS = process.env.EXPO_PUBLIC_TERMS_URL;
const PRIVACY = process.env.EXPO_PUBLIC_PRIVACY_URL;

// Offres de la maquette, quand la base n'est pas branchée.
const DEMO_PLANS: Plan[] = [
  { id: 'annuel', name: 'Annuel', period: 'year', price_cents: 2499, currency: 'EUR', trial_days: 7, apple_product_id: null, google_product_id: null, highlight: '30 % moins cher' },
  { id: 'mensuel', name: 'Mensuel', period: 'month', price_cents: 299, currency: 'EUR', trial_days: 7, apple_product_id: null, google_product_id: null, highlight: null },
];
const PER = { month: '/mois', year: '/an', lifetime: ' une fois' } as const;
const SOURCE: Record<string, string> = { app_store: 'App Store', play_store: 'Google Play', web: 'paiement en ligne', gift: `offert par ${BRAND.name}`, code: 'code promo', promo: `offert par ${BRAND.name}` };
const euros = (c: number, cur = 'EUR') => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur }).format(c / 100);
const day = (iso: string) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
const productOf = (p: Plan) => (Platform.OS === 'ios' ? p.apple_product_id : p.google_product_id);

/**
 * demo : base non branchée, Premium se bascule sur l'appareil (maquette).
 * onNeedAccount : ouvre « Mon compte » puis rappelle la fonction donnée une fois connecté.
 * onBought : achat confirmé par le store, avant même que la base ne le sache (les pubs partent tout de suite).
 */
export function Premium({ W, onClose, onToast, onNeedAccount, demo, demoOn, onDemo, onBought }: {
  W: number; onClose: () => void; onToast: (m: string) => void; onNeedAccount: (then: () => void) => void;
  demo: boolean; demoOn: boolean; onDemo: (on: boolean) => void; onBought: () => void;
}) {
  const insets = useSafeAreaInsets();
  const me = useMe();
  const active = demo ? demoOn : isPremium(me);
  const [plans, setPlans] = useState<Plan[]>(demo ? DEMO_PLANS : []);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [pick, setPick] = useState<string | null>(null);
  const [sub, setSub] = useState<MySub | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

  const x = useSharedValue(W);
  useEffect(() => { x.value = withTiming(0, { duration: DRAWER_MS, easing: DRAWER }); }, []);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const leave = (cb: () => void) => { x.value = withTiming(W, { duration: 380, easing: DRAWER }); setTimeout(cb, 360); };

  useEffect(() => {
    if (demo) return;
    loadPlans().then((ps) => { setPlans(ps); setPick((k) => k ?? ps[0]?.id ?? null); });
    storePrices().then((m) => setPrices(Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.price]))));
  }, []);
  useEffect(() => { if (demo) setPick('annuel'); }, []);
  useEffect(() => { if (active && !demo) mySubscription().then(setSub); }, [active, me?.premiumUntil]);

  const plan = plans.find((p) => p.id === pick) ?? plans[0];
  const priceOf = (p: Plan) => { const id = productOf(p); return (id && (prices[id] ?? prices[id.split(':')[0]])) || euros(p.price_cents, p.currency); };

  const run = async (key: string, f: () => Promise<void>) => {
    setErr(null);
    setBusy(key);
    try { await f(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Une erreur est survenue. Réessayez.'); feel('select', 'thud'); }
    finally { setBusy(null); }
  };

  // Le store a encaissé : la base l'apprend par RevenueCat en quelques secondes. On l'attend un peu.
  const waitServer = async () => {
    for (let i = 0; i < 10; i++) {
      await reloadMe();
      await new Promise((r) => setTimeout(r, 2000));
    }
  };
  const subscribe = () => {
    if (demo) { feel('success', 'ding'); onDemo(true); return; }
    if (!me) return onNeedAccount(() => {});
    if (!plan) return;
    const id = productOf(plan);
    if (!storeOn || !id) return setErr(Platform.OS === 'web'
      ? `L’abonnement se prend dans l’app ${BRAND.name} sur iPhone ou Android. Vous avez un code ? Touchez « J’ai un code ».`
      : 'L’abonnement n’est pas encore disponible sur cet appareil.');
    run('buy', async () => {
      if ((await buy(id)) !== 'ok') return;
      feel('success', 'ding');
      onBought();
      onToast('Bienvenue dans Premium. Plus aucune pub.');
      waitServer();
    });
  };
  const onRestore = () => {
    if (!me) return onNeedAccount(() => {});
    run('restore', async () => {
      if (await restore()) { feel('success', 'ding'); onBought(); onToast('Abonnement retrouvé.'); waitServer(); }
      else setErr('Aucun abonnement trouvé avec ce compte Apple ou Google.');
    });
  };
  const onCode = () => {
    if (!me) return onNeedAccount(() => setCode(code ?? ''));
    run('code', async () => {
      const d = await redeemCode(code ?? '');
      feel('success', 'ding');
      setCode(null);
      onToast(`Code accepté : ${d} jour${d > 1 ? 's' : ''} de Premium offert${d > 1 ? 's' : ''}.`);
    });
  };

  const trial = plan?.trial_days ?? 0;
  const cta = demo ? 'Essayer Premium (démo)'
    : !me ? 'Créer un compte pour continuer'
    : trial ? `Essayer ${trial} jours gratuits`
    : plan ? `S’abonner · ${priceOf(plan)}${PER[plan.period]}` : 'S’abonner';

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: C.night }, a]}>
      <LinearGradient colors={['rgba(200,107,250,0.30)', alpha(C.blue, 0.10), alpha(C.night, 0)]} style={[StyleSheet.absoluteFill, { height: '55%' }]} />
      <View style={[styles.head, { paddingTop: insets.top + 18 }]}>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => leave(onClose)} hitSlop={12}><Text style={styles.close}>Fermer</Text></Pressable>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 26, paddingBottom: Math.max(30, insets.bottom + 16), gap: 18 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', gap: 14, paddingVertical: 6 }}>
            <AppIcon size={72} />
            <Text style={styles.h}>{active ? 'Premium actif' : `${BRAND.name} Premium`}</Text>
            <Text style={[styles.p, { textAlign: 'center' }]}>{active ? `Merci de soutenir ${BRAND.name}.` : TEXTS.premium_pitch}</Text>
          </View>

          <View style={styles.rows}>
            {RULES.premium_benefits.map((b) => b.replaceAll('{nom}', BRAND.name)).map((t, i, l) => (
              <View key={t} style={[styles.row, i === l.length - 1 && { borderBottomWidth: 0 }]}>
                <Text style={styles.check}>✓</Text><Text style={styles.rl}>{t}</Text>
              </View>
            ))}
          </View>

          {active ? (
            <>
              {!demo ? (
                <View style={styles.rows}>
                  <Line label="Offre" value={sub?.plan ?? (sub?.source === 'gift' || sub?.source === 'code' ? 'Offerte' : 'Premium')} />
                  <Line label="Via" value={sub?.source ? SOURCE[sub.source] ?? sub.source : '—'} />
                  <Line label={sub?.auto_renew ? 'Renouvellement' : 'Fin'} value={!me?.premiumUntil ? 'À vie' : day(me.premiumUntil)} last />
                </View>
              ) : null}
              {sub && (sub.source === 'app_store' || sub.source === 'play_store') ? (
                <GradButton label="Gérer mon abonnement" onPress={() => manage()} />
              ) : null}
              {sub?.status === 'cancelled' ? <Text style={styles.small}>Résilié : vous gardez Premium jusqu’à la date de fin, sans nouveau prélèvement.</Text> : null}
              {sub?.status === 'grace' ? <Text style={[styles.small, { color: C.coral }]}>Le dernier paiement n’est pas passé. Mettez à jour votre moyen de paiement dans le store pour garder Premium.</Text> : null}
              {demo ? <Pressable onPress={() => { onDemo(false); feel('light'); }} hitSlop={8}><Text style={styles.link}>Revenir à la version gratuite (démo)</Text></Pressable> : null}
            </>
          ) : (
            <>
              <View style={{ gap: 10 }}>
                {plans.map((p) => {
                  const on = p.id === plan?.id;
                  return (
                    <Pressable key={p.id} onPress={() => { setPick(p.id); feel('select', 'tick'); }} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[styles.plan, on && styles.planOn]}>
                      <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.dot} /> : null}</View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.planName}>{p.name}</Text>
                        {p.highlight ? <Text style={styles.badge}>{p.highlight}</Text> : null}
                      </View>
                      <Text style={styles.price}>{priceOf(p)}<Text style={styles.per}>{PER[p.period]}</Text></Text>
                    </Pressable>
                  );
                })}
                {!plans.length && !demo ? <Text style={styles.small}>Les offres arrivent bientôt.</Text> : null}
              </View>
              {err ? <Text style={styles.err}>{err}</Text> : null}
              <GradButton label={cta} onPress={subscribe} disabled={!!busy || (!plans.length && !demo)} />
              {busy === 'buy' ? <ActivityIndicator color="#fff" /> : null}
              {plan && !demo ? (
                <Text style={styles.small}>
                  {trial ? `Gratuit pendant ${trial} jours, puis ${priceOf(plan)}${PER[plan.period]}. ` : ''}
                  Sans engagement : résiliable à tout moment dans les réglages {Platform.OS === 'ios' ? 'de l’App Store' : 'de Google Play'}{trial ? ', même pendant l’essai' : ''}.
                </Text>
              ) : null}
              {!demo ? (
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 22 }}>
                  {storeOn ? <Pressable onPress={onRestore} hitSlop={8}><Text style={styles.link}>{busy === 'restore' ? 'Recherche…' : 'Restaurer mes achats'}</Text></Pressable> : null}
                  <Pressable onPress={() => { setErr(null); setCode(code === null ? '' : null); }} hitSlop={8}><Text style={styles.link}>J’ai un code</Text></Pressable>
                </View>
              ) : null}
              {code !== null ? (
                <View style={{ gap: 10 }}>
                  <TextInput value={code} onChangeText={(v) => setCode(v.toUpperCase())} placeholder="CODE" placeholderTextColor={C.text3} style={styles.input}
                    autoCapitalize="characters" autoCorrect={false} maxLength={24} onSubmitEditing={onCode} accessibilityLabel="Code promo" />
                  <GradButton label={busy === 'code' ? 'Vérification…' : 'Utiliser ce code'} onPress={onCode} disabled={!!busy || code.trim().length < 4} />
                </View>
              ) : null}
            </>
          )}

          {TERMS || PRIVACY ? (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18 }}>
              {TERMS ? <Pressable onPress={() => Linking.openURL(TERMS)}><Text style={styles.legal}>Conditions d’utilisation</Text></Pressable> : null}
              {PRIVACY ? <Pressable onPress={() => Linking.openURL(PRIVACY)}><Text style={styles.legal}>Confidentialité</Text></Pressable> : null}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

function Line({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return <View style={[styles.row, last && { borderBottomWidth: 0 }]}><Text style={styles.rl}>{label}</Text><Text style={styles.rv}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 26, paddingBottom: 4 },
  h: { color: '#fff', fontFamily: F.black, fontSize: 30, lineHeight: 32 },
  close: { color: C.link, fontFamily: F.semi, fontSize: 14 },
  p: { color: C.text2, fontFamily: F.regular, fontSize: 15, lineHeight: 22 },
  small: { color: C.text3, fontFamily: F.regular, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  err: { color: C.coral, fontFamily: F.semi, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  link: { color: C.link, fontFamily: F.semi, fontSize: 14, textAlign: 'center', paddingVertical: 4 },
  legal: { color: C.text3, fontFamily: F.regular, fontSize: 12, textDecorationLine: 'underline' },
  rows: { borderRadius: 18, backgroundColor: C.surface, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderColor: C.line },
  rl: { color: '#fff', fontFamily: F.regular, fontSize: 15, flex: 1 },
  rv: { color: C.text2, fontFamily: F.regular, fontSize: 14 },
  check: { color: C.pink, fontFamily: F.black, fontSize: 15 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.surface, paddingHorizontal: 16, paddingVertical: 15 },
  planOn: { borderColor: C.violet, backgroundColor: alpha(C.violet, 0.16) },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: C.text3, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: '#fff' },
  dot: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#fff' },
  planName: { color: '#fff', fontFamily: F.semi, fontSize: 16 },
  badge: { color: C.pink, fontFamily: F.semi, fontSize: 12, marginTop: 2 },
  price: { color: '#fff', fontFamily: F.black, fontSize: 17 },
  per: { color: C.text3, fontFamily: F.regular, fontSize: 13 },
  input: { height: 50, borderRadius: 15, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, color: '#fff', fontFamily: F.semi, fontSize: 16, paddingHorizontal: 14, letterSpacing: 2, textAlign: 'center' },
});
