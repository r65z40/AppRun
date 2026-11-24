// Partage en image : quand un lecteur partage une info, l'app dessine une carte aux couleurs de l'app
// (logo, rubrique, titre, phrase clé, quelques faits, phrase et adresse en bas), la photographie et l'envoie
// au menu de partage du téléphone (Instagram, WhatsApp, Messages…). Sur le web : partage natif du navigateur
// s'il accepte les images, sinon l'image est téléchargée.
// Tout se règle dans le back office : Personnalisation > Carte de partage (BRAND.share, lu par brand.ts).
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { C, F, GRAD3, alpha } from './theme';
import { BRAND, SHARE } from './brand';
import { AppIcon, Rich } from './ui';
import { rubricOf } from './edition';
import type { Article } from './types';

/** Taille de dessin (points) ; l'image sort en 1080 px de large. */
export const SIZES = { story: [360, 640], portrait: [360, 450], square: [360, 360] } as const;
const OUT_W = 1080;

const WEB = process.env.EXPO_PUBLIC_WEB_URL;
/** Adresse jointe au partage : celle réglée, sinon le site de l'app. */
export function shareLink(): string {
  if (SHARE.link) return /^https?:\/\//.test(SHARE.link) ? SHARE.link : `https://${SHARE.link}`;
  if (Platform.OS === 'web' && typeof location !== 'undefined') return location.origin + location.pathname;
  return WEB ?? '';
}
/** Même adresse, sans « https:// » ni « www. », pour la carte. */
const shortLink = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
const plain = (s: string) => s.replace(/<[^>]+>/g, '');

type Result = 'image' | 'download' | 'text' | 'copied' | 'cancel';
type Job = { a: Article; done: (r: Result | null) => void };
let request: ((j: Job) => void) | null = null;

/**
 * Partage l'info : l'image si c'est possible, sinon le titre et le lien en texte.
 * 'download' = image téléchargée (ordinateur), 'copied' = texte copié, 'cancel' = rien d'envoyé.
 */
export async function shareArticle(a: Article): Promise<Result> {
  if (SHARE.enabled && request) {
    const r = await new Promise<Result | null>((done) => request!({ a, done }));
    if (r) return r;
  }
  return shareText(a);
}

async function shareText(a: Article): Promise<Result> {
  const link = shareLink();
  const message = `${a.title}\n${plain(a.key)}\n\nVia ${BRAND.name}${link ? ` : ${link}` : ''}`;
  try {
    if (Platform.OS === 'web') {
      const nav = typeof navigator !== 'undefined' ? (navigator as Navigator) : null;
      if (nav?.share) { await nav.share({ title: a.title, text: message }); return 'text'; }
      if (nav?.clipboard) { await nav.clipboard.writeText(message); return 'copied'; }
      return 'cancel';
    }
    const r = await Share.share({ message, title: a.title });
    return r.action === Share.dismissedAction ? 'cancel' : 'text';
  } catch {
    return 'cancel';
  }
}

/** À poser une fois dans l'app : dessine la carte hors de l'écran au moment d'un partage. */
export function ShareCardHost() {
  const [job, setJob] = useState<Job | null>(null);
  const busy = useRef(false);
  const ref = useRef<React.ComponentRef<typeof View>>(null);
  const loaded = useRef<() => void>(() => {});

  useEffect(() => {
    // Un partage à la fois : un second appui pendant la préparation est ignoré.
    request = (j) => { if (busy.current) return j.done('cancel'); busy.current = true; setJob(j); };
    return () => { request = null; };
  }, []);

  useEffect(() => {
    if (!job) return;
    let alive = true;
    (async () => {
      // On attend la photo (2,5 s au plus) puis une image du rendu, pour que tout soit dessiné.
      const photo = SHARE.photo && job.a.photo;
      if (photo) await new Promise<void>((r) => { loaded.current = r; setTimeout(r, 2500); });
      await new Promise((r) => setTimeout(r, Platform.OS === 'web' ? 60 : 120));
      let res: Result | null = null;
      try {
        const [w, h] = SIZES[SHARE.format];
        const opts = { format: 'png' as const, quality: 1, width: OUT_W, height: Math.round((OUT_W * h) / w) };
        if (Platform.OS === 'web') res = await shareOnWeb(await captureRef(ref, { ...opts, result: 'data-uri' }), job.a);
        else if (await Sharing.isAvailableAsync()) {
          const uri = await captureRef(ref, { ...opts, result: 'tmpfile' });
          await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: `Partager : ${job.a.title}` });
          res = 'image';
        }
      } catch {
        res = null; // l'image n'a pas pu être faite : on partage le texte à la place
      }
      busy.current = false;
      job.done(res);
      if (alive) setJob(null);
    })();
    return () => { alive = false; };
  }, [job]);

  if (!job) return null;
  return (
    // Hors de l'écran, invisible pour le lecteur ; « collapsable » garde la vue pour la capture sur Android.
    <View pointerEvents="none" style={styles.offscreen} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View ref={ref} collapsable={false}>
        <ShareCardView a={job.a} onPhoto={() => loaded.current()} />
      </View>
    </View>
  );
}

async function shareOnWeb(dataUri: string, a: Article): Promise<Result> {
  const blob = await (await fetch(dataUri)).blob();
  const name = `${BRAND.name}-${a.id}.png`.replace(/[^\w.-]+/g, '-');
  const file = new File([blob], name, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const link = shareLink();
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: a.title, text: link ? `${a.title} ${link}` : a.title });
    } catch (e) {
      // Le lecteur a fermé le menu : rien à faire de plus.
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancel';
      throw e;
    }
    return 'image';
  }
  // Ordinateur : l'image est téléchargée, prête à être publiée.
  const url = URL.createObjectURL(blob);
  const el = document.createElement('a');
  el.href = url; el.download = name;
  document.body.appendChild(el); el.click(); el.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'download';
}

/** La carte elle-même (aussi utilisable en aperçu). */
export function ShareCardView({ a, onPhoto }: { a: Article; onPhoto?: () => void }) {
  const [w, h] = SIZES[SHARE.format];
  const story = SHARE.format === 'story';
  const square = SHARE.format === 'square';
  const photo = SHARE.photo ? a.photo : null;
  const facts = square ? [] : a.facts.slice(0, SHARE.facts);
  const link = shortLink(shareLink());
  const tagline = SHARE.tagline.replaceAll('{nom}', BRAND.name);
  const rub = rubricOf(a)?.name;
  const titleSize = square ? 26 : story ? 34 : 29;
  return (
    <View style={{ width: w, height: h, backgroundColor: C.night, overflow: 'hidden' }}>
      {photo ? (
        <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" onLoad={onPhoto} onError={onPhoto} />
      ) : (
        <LinearGradient colors={GRAD3} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { opacity: 0.55 }]} />
      )}
      {photo ? <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(40,24,110,0.38)' }]} /> : null}
      <LinearGradient
        colors={[alpha(C.night, 0.7), alpha(C.night, 0.05), alpha(C.night, 0.55), alpha(C.night, 0.94), C.night]}
        locations={[0, 0.22, 0.45, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.inner, { padding: square ? 22 : 26 }]}>
        <View style={styles.head}>
          <AppIcon size={30} />
          <Text style={styles.brand} numberOfLines={1}>{BRAND.name}</Text>
          {rub ? <Text style={styles.rub} numberOfLines={1}>{rub.toUpperCase()}</Text> : null}
        </View>
        <View style={{ flex: 1 }} />
        <Text style={[styles.title, { fontSize: titleSize, lineHeight: titleSize * 1.02 }]} numberOfLines={square ? 4 : 5}>{a.title.toUpperCase()}</Text>
        <Rich text={a.key} style={[styles.key, square && { fontSize: 14, lineHeight: 19 }]} />
        {facts.length ? (
          <View style={{ marginTop: 14 }}>
            {facts.map((f, i) => (
              <View key={i} style={[styles.fact, i === facts.length - 1 && styles.factLast]}>
                <Rich text={f.text} style={styles.factTxt} />
                {f.source ? <Text style={styles.factSrc}>{f.source}</Text> : null}
              </View>
            ))}
          </View>
        ) : (
          // Sans faits sur l'image (format carré…), les médias restent cités.
          <Text style={[styles.factSrc, { marginTop: 10 }]} numberOfLines={1}>Sources : {[...new Set(a.facts.map((f) => f.source).filter(Boolean))].join(', ')}</Text>
        )}
        <LinearGradient colors={GRAD3} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.bar, { marginTop: story ? 26 : 16 }]} />
        <View style={styles.foot}>
          <Text style={styles.tag} numberOfLines={2}>{tagline}</Text>
          {link ? <Text style={styles.link} numberOfLines={1}>{link}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  offscreen: { position: 'absolute', left: -10000, top: 0, opacity: 1 },
  inner: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brand: { color: '#fff', fontFamily: F.black, fontSize: 17, letterSpacing: 0.4, flexShrink: 1 },
  rub: { marginLeft: 'auto', color: C.soft2, fontFamily: F.semi, fontSize: 11, letterSpacing: 1.4 },
  title: { color: '#fff', fontFamily: F.black, letterSpacing: -0.4 },
  key: { color: 'rgba(255,255,255,0.86)', fontFamily: F.regular, fontSize: 15.5, lineHeight: 22, marginTop: 10 },
  fact: { borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.16)', paddingVertical: 9 },
  factLast: { borderBottomWidth: 1 },
  factTxt: { color: '#fff', fontFamily: F.regular, fontSize: 13.5, lineHeight: 18 },
  factSrc: { color: C.text3, fontFamily: F.regular, fontSize: 10.5, marginTop: 3 },
  bar: { height: 3, borderRadius: 2, width: 44 },
  foot: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 10 },
  tag: { flex: 1, color: C.text2, fontFamily: F.semi, fontSize: 12.5, lineHeight: 16 },
  link: { color: C.soft, fontFamily: F.semi, fontSize: 12.5 },
});
