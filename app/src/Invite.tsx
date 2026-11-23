// Parrainage, dans Mon compte : mon lien d'invitation à partager, mes amis validés, le prochain badge (Ambassadeur),
// et, juste après l'inscription, le code d'un ami à taper. Tout se règle dans le back office (Lecteurs > Parrainage).
import React, { useEffect, useState } from 'react';
import { Platform, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { C, F, alpha } from './theme';
import { GradButton, SoftButton, st } from './ui';
import { feel } from './feel';
import { claimReferral, myReferral, referralLink, UserError, type Referral } from './account';

const plural = (n: number, w: string) => `${n} ${w}${n > 1 ? 's' : ''}`;

export function Invite({ onToast }: { onToast: (m: string) => void }) {
  const [r, setR] = useState<Referral | null>(null);
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => myReferral().then(setR);
  useEffect(() => { load(); }, []);
  if (!r?.enabled || !r.code) return null;

  const link = referralLink(r);
  const message = (r.share_text || '{lien}').replace(/\{lien\}/g, link).replace(/\{code\}/g, r.code);
  const share = async () => {
    feel('light');
    try {
      if (Platform.OS === 'web' && !(globalThis.navigator as Navigator | undefined)?.share) throw new Error('pas de partage');
      await Share.share(Platform.OS === 'ios' ? { message: message.replace(link, '').trim(), url: link } : { message });
    } catch {
      // Ordinateur sans partage : on copie le lien.
      try { await globalThis.navigator?.clipboard?.writeText(message); onToast('Message et lien copiés : collez-les à vos amis.'); }
      catch { onToast(`Votre lien : ${link}`); }
    }
  };
  const claim = async () => {
    setErr(null);
    setBusy(true);
    try { const who = await claimReferral(code); feel('success', 'ding'); onToast(`C’est noté : ${who} vous a invité.`); setCode(''); load(); }
    catch (e) { setErr(e instanceof UserError ? e.message : 'Une erreur est survenue. Réessayez.'); feel('select', 'thud'); }
    finally { setBusy(false); }
  };
  const n = r.confirmed ?? 0;
  const next = r.next_badge;
  const gift = r.referrer_days ? ` Chaque ami qui lit vraiment vous offre ${plural(r.referrer_days, 'jour')} de Premium${r.referee_days ? `, et à lui ${plural(r.referee_days, 'jour')}` : ''}.` : '';

  return (
    <View style={{ gap: 12 }}>
      <Text style={[st.label, { marginTop: 6 }]}>Inviter des amis</Text>
      <View style={s.card}>
        <Text style={s.p}>Faites découvrir l’app à vos proches avec votre lien.{gift}</Text>
        <View style={s.codeRow}>
          <Text style={s.codeLbl}>Votre code</Text>
          <Text style={s.code} selectable>{r.code}</Text>
        </View>
        <GradButton label="Partager mon lien" onPress={share} />
        <View style={s.stats}>
          <Stat n={n} label={n > 1 ? 'amis validés' : 'ami validé'} />
          <Stat n={r.pending ?? 0} label="en route" />
          {r.days_earned ? <Stat n={r.days_earned} label="jours gagnés" /> : null}
        </View>
        {next ? (
          <View style={{ gap: 6 }}>
            <Text style={s.small}>
              <Text style={{ color: next.color, fontFamily: F.semi }}>{next.icon} {next.label}</Text> : encore {plural(Math.max(next.threshold - n, 1), 'ami')}
            </Text>
            <View style={s.bar}><View style={[s.fill, { width: `${Math.min(100, (100 * n) / Math.max(next.threshold, 1))}%`, backgroundColor: next.color }]} /></View>
          </View>
        ) : null}
        {r.pending ? <Text style={s.small}>Un ami compte dès qu’il a lu {plural(r.confirm_reads ?? 5, 'info')}.</Text> : null}
      </View>
      {r.referred_by ? <Text style={s.small}>Invité par {r.referred_by}.</Text> : r.can_claim ? (
        <View style={{ gap: 8 }}>
          <Text style={s.p}>Un ami vous a invité ? Saisissez son code.</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput value={code} onChangeText={(v) => setCode(v.toUpperCase())} style={[s.input, { flex: 1 }]} autoCapitalize="characters" autoCorrect={false}
              maxLength={12} placeholder="Code" placeholderTextColor={C.text3} accessibilityLabel="Code de parrainage" onSubmitEditing={claim} />
            <SoftButton label="Valider" onPress={() => { if (code.trim().length >= 4 && !busy) claim(); }} style={{ height: 50, borderRadius: 15 }} />
          </View>
          {err ? <Text style={s.err}>{err}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.statN}>{n.toLocaleString('fr-FR')}</Text>
      <Text style={s.small}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 18, backgroundColor: C.surface, padding: 16, gap: 14 },
  p: { color: C.text2, fontFamily: F.regular, fontSize: 15, lineHeight: 22 },
  small: { color: C.text3, fontFamily: F.regular, fontSize: 13, lineHeight: 18 },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: alpha(C.violet, 0.7), paddingHorizontal: 14, paddingVertical: 10 },
  codeLbl: { color: C.text3, fontFamily: F.regular, fontSize: 13 },
  code: { color: '#fff', fontFamily: F.black, fontSize: 22, letterSpacing: 4 },
  stats: { flexDirection: 'row', gap: 12 },
  statN: { color: '#fff', fontFamily: F.black, fontSize: 22 },
  bar: { height: 6, borderRadius: 3, backgroundColor: C.surface2, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  input: { height: 50, borderRadius: 15, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, color: '#fff', fontFamily: F.semi, fontSize: 16, letterSpacing: 2, paddingHorizontal: 14 },
  err: { color: C.coral, fontFamily: F.semi, fontSize: 14, lineHeight: 20 },
});
