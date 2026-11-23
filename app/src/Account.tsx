// Volet « Mon compte » : connexion, création de compte, pseudo.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, DRAWER_MS } from './theme';
import { GradButton, Toggle, st } from './ui';
import { BadgeList, SavedTime } from './Badges';
import { Invite } from './Invite';
import type { ReaderCard } from './types';
import { feel } from './feel';
import { blockedCount, pendingReferral, readerCard, setShowBadges, resendConfirm, resetPassword, setPseudo, signIn, signOut, signUp, unblockAll, updatePassword, useMe, UserError } from './account';

const DRAWER = Easing.bezier(0.32, 0.72, 0, 1);
type Mode = 'in' | 'up' | 'confirm' | 'pseudo' | 'me' | 'newpass' | 'sent';

/** reason : pourquoi on demande un compte (« Connectez-vous pour commenter »). onReady : le lecteur est connecté avec un pseudo. */
export function Account({ W, reason, start, onClose, onReady, onToast }: {
  W: number; reason?: string | null; onClose: () => void; onReady?: () => void; onToast: (m: string) => void;
  /** newpass : arrivée par le lien « mot de passe oublié » ; in : écran de connexion (lien périmé). */
  start?: 'newpass' | 'in';
}) {
  const insets = useSafeAreaInsets();
  const me = useMe();
  const [mode, setMode] = useState<Mode>(start === 'newpass' ? 'newpass' : me ? (me.pseudo ? 'me' : 'pseudo') : start ?? 'up');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pseudo, setPs] = useState('');
  const [ref, setRef] = useState('');
  useEffect(() => { pendingReferral().then((c) => c && setRef(c)); }, []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(0);
  const [card, setCard] = useState<ReaderCard | null>(null);
  useEffect(() => { if (mode === 'me') { blockedCount().then(setBlocked); readerCard().then(setCard); } }, [mode]);
  const x = useSharedValue(W);
  useEffect(() => { x.value = withTiming(0, { duration: DRAWER_MS, easing: DRAWER }); }, []);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const leave = (cb: () => void) => { x.value = withTiming(W, { duration: 380, easing: DRAWER }); setTimeout(cb, 360); };

  // Connecté avec un pseudo : l'action demandée peut reprendre.
  useEffect(() => {
    if (me && !me.pseudo && mode !== 'pseudo' && mode !== 'newpass') setMode('pseudo');
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
    else if (mode === 'up') run(async () => { if ((await signUp(email, pw, ref)) === 'confirm') setMode('confirm'); });
    else if (mode === 'pseudo') run(() => setPseudo(pseudo));
    else if (mode === 'newpass') run(async () => {
      await updatePassword(pw);
      setPw('');
      feel('success', 'ding');
      onToast('Mot de passe changé.');
      setMode(me?.pseudo ? 'me' : 'pseudo');
    });
  };
  const forgot = () => email.includes('@')
    ? run(async () => { await resetPassword(email); setMode('sent'); })
    : setErr('Saisissez votre adresse, puis touchez « Mot de passe oublié ».');

  const title = mode === 'me' ? 'Mon compte' : mode === 'pseudo' ? 'Votre pseudo' : mode === 'confirm' || mode === 'sent' ? 'Vérifiez vos e-mails' : mode === 'newpass' ? 'Nouveau mot de passe' : mode === 'in' ? 'Se connecter' : 'Créer un compte';
  const can = mode === 'pseudo' ? pseudo.trim().length >= 2 : mode === 'newpass' ? pw.length >= 8 : email.includes('@') && pw.length >= (mode === 'up' ? 8 : 1);

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
              {mode === 'up' && ref ? <Field label="Code d’un ami (facultatif)" value={ref} onChange={(v) => setRef(v.toUpperCase())} max={12} /> : null}
              {err ? <Text style={styles.err}>{err}</Text> : null}
              <GradButton label={mode === 'up' ? 'Créer mon compte' : 'Se connecter'} onPress={submit} disabled={!can || busy} />
              {busy ? <ActivityIndicator color="#fff" /> : null}
              <Pressable onPress={() => { setErr(null); setMode(mode === 'up' ? 'in' : 'up'); }} hitSlop={8}>
                <Text style={styles.link}>{mode === 'up' ? 'J’ai déjà un compte' : 'Créer un compte'}</Text>
              </Pressable>
              {mode === 'in' ? (
                <Pressable hitSlop={8} onPress={forgot}>
                  <Text style={[styles.link, { color: C.text3 }]}>Mot de passe oublié</Text>
                </Pressable>
              ) : null}
              {err?.startsWith('Confirmez') ? (
                <Pressable hitSlop={8} onPress={() => run(async () => { await resendConfirm(email); setMode('confirm'); })}>
                  <Text style={styles.link}>Renvoyer l’e-mail de confirmation</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}

          {mode === 'confirm' ? (
            <>
              <Text style={styles.p}>Nous avons envoyé un lien à <Text style={{ color: '#fff' }}>{email.trim()}</Text>. Ouvrez-le pour activer votre compte, puis revenez ici pour vous connecter.</Text>
              <GradButton label="J’ai confirmé, me connecter" onPress={() => { setErr(null); setMode('in'); }} />
              {err ? <Text style={styles.err}>{err}</Text> : null}
              <Pressable hitSlop={8} onPress={() => run(async () => { await resendConfirm(email); onToast('E-mail renvoyé.'); })}>
                <Text style={[styles.link, { color: C.text3 }]}>Rien reçu ? Regardez dans les indésirables, ou renvoyez l’e-mail</Text>
              </Pressable>
            </>
          ) : null}

          {mode === 'sent' ? (
            <>
              <Text style={styles.p}>Si un compte existe avec <Text style={{ color: '#fff' }}>{email.trim()}</Text>, un lien vient d’y être envoyé. Ouvrez-le pour choisir un nouveau mot de passe (pensez aux indésirables).</Text>
              <GradButton label="Retour à la connexion" onPress={() => { setErr(null); setMode('in'); }} />
              {err ? <Text style={styles.err}>{err}</Text> : null}
              <Pressable hitSlop={8} onPress={forgot}><Text style={[styles.link, { color: C.text3 }]}>Renvoyer le lien</Text></Pressable>
            </>
          ) : null}

          {mode === 'newpass' ? (
            <>
              <Text style={styles.p}>{me ? 'Choisissez votre nouveau mot de passe.' : 'Le lien a expiré. Revenez à la connexion et touchez « Mot de passe oublié ».'}</Text>
              {me ? <Field label="Nouveau mot de passe (8 caractères au moins)" value={pw} onChange={setPw} type="password" onSubmit={submit} /> : null}
              {err ? <Text style={styles.err}>{err}</Text> : null}
              {me ? <GradButton label="Enregistrer" onPress={submit} disabled={!can || busy} /> : <GradButton label="Retour à la connexion" onPress={() => { setErr(null); setMode('in'); }} />}
              {busy ? <ActivityIndicator color="#fff" /> : null}
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
              {card ? (
                <>
                  <Text style={[st.label, { marginTop: 6 }]}>Mes reconnaissances</Text>
                  {card.reads ? <SavedTime reads={card.reads} minutes={card.minutes_saved ?? 0} /> : null}
                  {card.badges?.length ? <BadgeList badges={card.badges} /> : <Text style={styles.p}>Pas encore de badge : ils arrivent en lisant chaque jour.</Text>}
                  <View style={styles.rows}>
                    <View style={[styles.row, { borderBottomWidth: 0 }]}>
                      <Text style={styles.rl}>Montrer mes badges aux autres lecteurs</Text>
                      <Toggle label="Montrer mes badges aux autres lecteurs" on={me.showBadges} onPress={() => run(async () => { await setShowBadges(!me.showBadges); feel('select'); })} />
                    </View>
                  </View>
                </>
              ) : null}
              <Invite onToast={onToast} />
              <Pressable onPress={() => { setPs(me.pseudo ?? ''); setMode('pseudo'); }} hitSlop={8}><Text style={styles.link}>Changer de pseudo</Text></Pressable>
              <Pressable onPress={() => { setErr(null); setPw(''); setMode('newpass'); }} hitSlop={8}><Text style={styles.link}>Changer de mot de passe</Text></Pressable>
              {blocked ? (
                <Pressable onPress={() => run(async () => { await unblockAll(); setBlocked(0); onToast('Vous revoyez les commentaires de tout le monde.'); })} hitSlop={8}>
                  <Text style={styles.link}>Débloquer {blocked > 1 ? `les ${blocked} comptes bloqués` : 'le compte bloqué'}</Text>
                </Pressable>
              ) : null}
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
  close: { color: C.link, fontFamily: F.semi, fontSize: 14 },
  p: { color: C.text2, fontFamily: F.regular, fontSize: 15, lineHeight: 22 },
  input: { height: 50, borderRadius: 15, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, color: '#fff', fontFamily: F.regular, fontSize: 16, paddingHorizontal: 14 },
  err: { color: C.coral, fontFamily: F.semi, fontSize: 14, lineHeight: 20 },
  link: { color: C.link, fontFamily: F.semi, fontSize: 14, textAlign: 'center', paddingVertical: 4 },
  rows: { borderRadius: 18, backgroundColor: C.surface, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: C.line },
  rl: { color: '#fff', fontFamily: F.regular, fontSize: 15, flex: 1 },
  rv: { color: C.text2, fontFamily: F.regular, fontSize: 14, maxWidth: '60%' },
});
