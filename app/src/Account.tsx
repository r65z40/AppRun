// Volet « Mon compte » : connexion, création de compte, pseudo.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, DRAWER_MS } from './theme';
import { GradButton, st } from './ui';
import { feel } from './feel';
import { resetPassword, setPseudo, signIn, signOut, signUp, useMe, UserError } from './account';

const DRAWER = Easing.bezier(0.32, 0.72, 0, 1);
type Mode = 'in' | 'up' | 'confirm' | 'pseudo' | 'me';

/** reason : pourquoi on demande un compte (« Connectez-vous pour commenter »). onReady : le lecteur est connecté avec un pseudo. */
export function Account({ W, reason, onClose, onReady, onToast }: {
  W: number; reason?: string | null; onClose: () => void; onReady?: () => void; onToast: (m: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const me = useMe();
  const [mode, setMode] = useState<Mode>(me ? (me.pseudo ? 'me' : 'pseudo') : 'up');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pseudo, setPs] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const x = useSharedValue(W);
  useEffect(() => { x.value = withTiming(0, { duration: DRAWER_MS, easing: DRAWER }); }, []);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const leave = (cb: () => void) => { x.value = withTiming(W, { duration: 380, easing: DRAWER }); setTimeout(cb, 360); };

  // Connecté avec un pseudo : l'action demandée peut reprendre.
  useEffect(() => {
    if (me && !me.pseudo && mode !== 'pseudo') setMode('pseudo');
    if (me?.pseudo && (mode === 'in' || mode === 'up' || mode === 'pseudo')) {
      feel('success', 'ding');
      if (onReady) leave(onReady);
      else setMode('me');
    }
  }, [me]);

  const run = async (f: () => Promise<unknown>) => {
    setErr(null);
    setBusy(true);
    try { await f(); }
    catch (e) { setErr(e instanceof UserError ? e.message : 'Une erreur est survenue. Réessayez.'); feel('select', 'thud'); }
    finally { setBusy(false); }
  };
  const submit = () => {
    if (mode === 'in') run(() => signIn(email, pw));
    else if (mode === 'up') run(async () => { if ((await signUp(email, pw)) === 'confirm') setMode('confirm'); });
    else if (mode === 'pseudo') run(() => setPseudo(pseudo));
  };

  const title = mode === 'me' ? 'Mon compte' : mode === 'pseudo' ? 'Votre pseudo' : mode === 'confirm' ? 'Vérifiez vos e-mails' : mode === 'in' ? 'Se connecter' : 'Créer un compte';
  const can = mode === 'pseudo' ? pseudo.trim().length >= 2 : email.includes('@') && pw.length >= (mode === 'up' ? 8 : 1);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: C.night }, a]}>
      <View style={[styles.head, { paddingTop: insets.top + 18 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h}>{title}</Text>
          {reason && mode !== 'me' ? <Text style={[styles.p, { marginTop: 8 }]}>{reason}</Text> : null}
        </View>
        <Pressable onPress={() => leave(onClose)} hitSlop={12}><Text style={styles.close}>Fermer</Text></Pressable>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 26, paddingBottom: 30, gap: 16 }} keyboardShouldPersistTaps="handled">
          {mode === 'in' || mode === 'up' ? (
            <>
              {reason ? null : <Text style={styles.p}>{mode === 'up'
                ? 'Gratuit. Pour aimer les infos, commenter et retrouver vos réglages sur tous vos appareils.'
                : 'Content de vous revoir.'}</Text>}
              <Field label="Adresse e-mail" value={email} onChange={setEmail} type="email" />
              <Field label={mode === 'up' ? 'Mot de passe (8 caractères au moins)' : 'Mot de passe'} value={pw} onChange={setPw} type="password" onSubmit={submit} />
              {err ? <Text style={styles.err}>{err}</Text> : null}
              <GradButton label={mode === 'up' ? 'Créer mon compte' : 'Se connecter'} onPress={submit} disabled={!can || busy} />
              {busy ? <ActivityIndicator color="#fff" /> : null}
              <Pressable onPress={() => { setErr(null); setMode(mode === 'up' ? 'in' : 'up'); }} hitSlop={8}>
                <Text style={styles.link}>{mode === 'up' ? 'J’ai déjà un compte' : 'Créer un compte'}</Text>
              </Pressable>
              {mode === 'in' ? (
                <Pressable hitSlop={8} onPress={() => email.includes('@')
                  ? run(async () => { await resetPassword(email); onToast('Lien envoyé : vérifiez vos e-mails.'); })
                  : setErr('Saisissez votre adresse, puis touchez « Mot de passe oublié ».')}>
                  <Text style={[styles.link, { color: C.text3 }]}>Mot de passe oublié</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}

          {mode === 'confirm' ? (
            <>
              <Text style={styles.p}>Nous avons envoyé un lien à <Text style={{ color: '#fff' }}>{email.trim()}</Text>. Ouvrez-le pour activer votre compte, puis revenez ici pour vous connecter.</Text>
              <GradButton label="J’ai confirmé, me connecter" onPress={() => { setErr(null); setMode('in'); }} />
            </>
          ) : null}

          {mode === 'pseudo' ? (
            <>
              <Text style={styles.p}>C’est le nom affiché à côté de vos commentaires. Votre adresse reste privée.</Text>
              <Field label="Pseudo" value={pseudo} onChange={setPs} onSubmit={submit} max={24} />
              <Text style={[styles.p, { fontSize: 13, color: C.text3 }]}>2 à 24 caractères : lettres, chiffres, point, tiret.</Text>
              {err ? <Text style={styles.err}>{err}</Text> : null}
              <GradButton label="Valider" onPress={submit} disabled={!can || busy} />
            </>
          ) : null}

          {mode === 'me' && me ? (
            <>
              <View style={styles.rows}>
                <View style={styles.row}><Text style={styles.rl}>Pseudo</Text><Text style={styles.rv}>{me.pseudo}</Text></View>
                <View style={[styles.row, { borderBottomWidth: 0 }]}><Text style={styles.rl}>Adresse</Text><Text style={styles.rv} numberOfLines={1}>{me.email}</Text></View>
              </View>
              <Pressable onPress={() => { setPs(me.pseudo ?? ''); setMode('pseudo'); }} hitSlop={8}><Text style={styles.link}>Changer de pseudo</Text></Pressable>
              <Pressable onPress={() => { signOut(); feel('light'); onToast('Vous êtes déconnecté.'); leave(onClose); }} hitSlop={8}>
                <Text style={[styles.link, { color: C.coral }]}>Se déconnecter</Text>
              </Pressable>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

function Field({ label, value, onChange, type, onSubmit, max }: { label: string; value: string; onChange: (v: string) => void; type?: 'email' | 'password'; onSubmit?: () => void; max?: number }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={st.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        style={styles.input}
        placeholderTextColor={C.text3}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={type === 'email' ? 'email-address' : 'default'}
        secureTextEntry={type === 'password'}
        autoComplete={type === 'email' ? 'email' : type === 'password' ? 'password' : 'username'}
        textContentType={type === 'email' ? 'emailAddress' : type === 'password' ? 'password' : 'nickname'}
        onSubmitEditing={onSubmit}
        maxLength={max}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 26, paddingBottom: 22, gap: 16 },
  h: { color: '#fff', fontFamily: F.black, fontSize: 26, lineHeight: 28 },
  close: { color: '#cfd9ff', fontFamily: F.semi, fontSize: 14 },
  p: { color: C.text2, fontFamily: F.regular, fontSize: 15, lineHeight: 22 },
  input: { height: 50, borderRadius: 15, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, color: '#fff', fontFamily: F.regular, fontSize: 16, paddingHorizontal: 14 },
  err: { color: C.coral, fontFamily: F.semi, fontSize: 14, lineHeight: 20 },
  link: { color: '#cfd9ff', fontFamily: F.semi, fontSize: 14, textAlign: 'center', paddingVertical: 4 },
  rows: { borderRadius: 18, backgroundColor: C.surface, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: C.line },
  rl: { color: '#fff', fontFamily: F.regular, fontSize: 15, flex: 1 },
  rv: { color: C.text2, fontFamily: F.regular, fontSize: 14, maxWidth: '60%' },
});
