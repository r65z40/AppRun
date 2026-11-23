// Reconnaissance des lecteurs : icônes à côté du pseudo, et fiche ouverte en touchant le pseudo.
// Les badges, leurs couleurs et les paliers se règlent dans le back office (Lecteurs > Reconnaissance).
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { C, F, alpha } from './theme';
import { RECOG, savedLabel } from './brand';
import type { Badge, ReaderCard } from './types';

/** Couleur du pseudo : celle de son premier badge (si réglé ainsi), sinon blanc. */
export const pseudoColor = (b?: Badge[]) => (RECOG.color_pseudo && b?.length ? b[0].color : '#fff');

/** Les premières icônes, à côté du pseudo. */
export function BadgeIcons({ badges, size = 13 }: { badges?: Badge[]; size?: number }) {
  if (!badges?.length || !RECOG.max_icons) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 3 }} accessibilityLabel={badges.map((b) => b.label).join(', ')}>
      {badges.slice(0, RECOG.max_icons).map((b, i) => (
        <View key={i} style={[s.dot, { width: size + 9, height: size + 9, backgroundColor: alpha(b.color, 0.22), borderColor: alpha(b.color, 0.55) }]}>
          <Text style={{ fontSize: size }}>{b.icon}</Text>
        </View>
      ))}
    </View>
  );
}

/** Une ligne par badge : icône, nom, ce qu'il récompense. */
export function BadgeList({ badges }: { badges: Badge[] }) {
  return (
    <View style={{ gap: 10 }}>
      {badges.map((b, i) => (
        <View key={i} style={s.row}>
          <View style={[s.big, { backgroundColor: alpha(b.color, 0.22), borderColor: alpha(b.color, 0.6) }]}><Text style={{ fontSize: 20 }}>{b.icon}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={[s.label, { color: b.color }]}>{b.label}</Text>
            {b.description ? <Text style={s.desc}>{b.description}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Infos lues et temps gagné, mis en avant. */
export function SavedTime({ reads, minutes }: { reads: number; minutes: number }) {
  return (
    <View style={s.saved}>
      <Text style={s.savedBig}>≈ {savedLabel(minutes)}</Text>
      <Text style={s.savedTxt}>gagnées en lisant {reads.toLocaleString('fr-FR')} info{reads > 1 ? 's' : ''} ici plutôt que des articles complets</Text>
    </View>
  );
}

/** Fiche d'un lecteur, par-dessus les commentaires. card undefined : chargement. */
export function ReaderCardView({ who, card, onClose }: { who: string; card: ReaderCard | null | undefined; onClose: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={s.back}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer la fiche" />
      <View style={s.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[s.who, { color: pseudoColor(card?.badges) }]}>{card?.pseudo ?? who}</Text>
          <Pressable onPress={onClose} hitSlop={12} style={{ marginLeft: 'auto' }}><Text style={s.close}>Fermer</Text></Pressable>
        </View>
        {card === undefined ? <ActivityIndicator color="#fff" style={{ marginVertical: 20 }} />
          : !card ? <Text style={s.desc}>Fiche indisponible pour le moment.</Text>
          : card.hidden ? <Text style={s.desc}>Ce lecteur a choisi de ne pas afficher ses reconnaissances.</Text>
          : (
            <>
              {card.reads ? <SavedTime reads={card.reads} minutes={card.minutes_saved ?? 0} /> : null}
              {card.badges?.length ? <BadgeList badges={card.badges} /> : <Text style={s.desc}>Pas encore de badge.</Text>}
              {card.since ? <Text style={[s.desc, { marginTop: 4 }]}>Lecteur depuis {new Date(card.since).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</Text> : null}
            </>
          )}
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  dot: { borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  big: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: F.semi, fontSize: 15 },
  desc: { color: C.text2, fontFamily: F.regular, fontSize: 13, lineHeight: 18 },
  saved: { borderRadius: 16, padding: 14, backgroundColor: alpha(C.like, 0.14), borderWidth: 1, borderColor: alpha(C.like, 0.4) },
  savedBig: { color: C.like, fontFamily: F.black, fontSize: 26 },
  savedTxt: { color: C.text2, fontFamily: F.regular, fontSize: 13, lineHeight: 18, marginTop: 2 },
  back: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 },
  card: { borderRadius: 24, padding: 20, gap: 16, backgroundColor: C.night2, borderWidth: 1, borderColor: C.line },
  who: { fontFamily: F.black, fontSize: 20 },
  close: { color: C.link, fontFamily: F.semi, fontSize: 14 },
});
