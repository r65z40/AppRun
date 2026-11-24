import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, Text, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedValue, withSpring } from 'react-native-reanimated';
import { DeviceMotion } from 'expo-sensors';
import { useFonts, Archivo_400Regular, Archivo_600SemiBold, Archivo_900Black } from '@expo-google-fonts/archivo';
import { C } from './src/theme';
import { NOTIF, NUDGES, RULES } from './src/brand';
import { notifWanted, setNotif, syncNotif } from './src/notify';
import { RUBRICS } from './src/content';
import { buildColumns, demoCard, rubricOf, seedComments } from './src/edition';
import { adHit, loadAds } from './src/ads';
import { Feed } from './src/Feed';
import { SummarySheet, CommentsSheet } from './src/Sheets';
import { Bravo, End, Onboarding, Settings, Splash, Toast, Welcome, type OnbResult, type Prefs } from './src/Screens';
import { initFeel, feel, prefs as feelPrefs } from './src/feel';
import { syncWidget } from './src/headline';
import { dayLabel, shortDay } from './src/dates';
import { loadConfig, loadEdition, loadFlashes, loadMessages, remoteConfigured, type AppMessage } from './src/remote';
import { Account } from './src/Account';
import { Premium } from './src/Premium';
import { ShareCardHost } from './src/ShareCard';
import { storeLogin } from './src/purchases';
import * as acc from './src/account';
import { loadMyEdition, resetTaste, signal, type Pick, type Signal } from './src/algo';
import { isAd, isArticle, type Article, type Badge, type Card, type Comment } from './src/types';
import { BadgeToast } from './src/Badges';
import { FollowRow, TopicsScreen } from './src/Topics';
import { enablePush, loadTopics, onAlertTap, prefetchTopicsOf } from './src/topics';

type Phase = 'splash' | 'onb' | 'feed';
type Overlay = null | 'bravo' | 'end' | 'settings';
type AccountAsk = { reason: string | null; then?: () => void; start?: 'newpass' | 'in' };
/** Empreinte de l'édition chargée : change quand des infos arrivent ou que l'ordre bouge. */
const editionSig = () => RUBRICS.map((r) => r.items.map((a) => a.id).join(',')).join('|');

const DWELL_MS = 1200; // une info compte comme lue après ~1 s à l'écran
/** L'édition de l'algorithme, ou null si la base ne répond pas vite (l'app compose alors elle-même). */
const fetchPicks = (active: string[], quota: number, perso: boolean) =>
  Promise.race([loadMyEdition(active, quota, perso), new Promise<null>((r) => setTimeout(() => r(null), 2500))]);

// Sur ordinateur (version web), l'app s'affiche dans un cadre de téléphone au centre de la page.
const framed = (w: number) => Platform.OS === 'web' && w > 560;
function useFrame() {
  const { width, height: visible } = useWindowDimensions();
  // Web : hauteur de la page, pas la zone visible, qui rétrécit quand le clavier s'ouvre (iPhone) et décalait tout le fil.
  const height = Platform.OS === 'web' ? document.documentElement.clientHeight || visible : visible;
  return framed(width) ? { width: 400, height: Math.min(height - 48, 860) } : { width, height };
}

export default function App() {
  const [loaded] = useFonts({ Archivo_400Regular, Archivo_600SemiBold, Archivo_900Black });
  useEffect(() => { initFeel(); }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.night }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {loaded ? <Framed><Main /></Framed> : null}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Main() {
  const { width: W, height: H } = useFrame();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('splash');
  // La vraie édition se charge pendant l'écran de lancement (4 s au plus, sinon contenu de démo).
  const [loaded, setLoaded] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  // Base branchée mais aucune édition publiée : on le dit, pour ne pas confondre la démo avec le vrai contenu.
  const demoNote = useRef(false);
  const [commentsMode, setCommentsMode] = useState<'comments' | 'emoji'>('comments');
  useEffect(() => {
    loadEdition().then((d) => { demoNote.current = !d && remoteConfigured; }).finally(() => setLoaded(true));
    loadConfig().then((c) => c && setCommentsMode(c.commentsMode));
  }, []);
  // Réglages déjà faits (compte, ou sinon ce téléphone) : on saute la présentation.
  const [localPrefs, setLocalPrefs] = useState<Partial<Prefs> | null | undefined>(undefined);
  useEffect(() => { acc.getLocal(LOCAL_PREFS).then((v) => { try { setLocalPrefs(v ? JSON.parse(v) : null); } catch { setLocalPrefs(null); } }); }, []);
  useEffect(() => {
    if (!loaded || !splashDone || phase !== 'splash' || localPrefs === undefined) return;
    const mine = acc.currentMe()?.prefs as Partial<Prefs> | undefined;
    const saved = mine?.active?.length ? { ...localPrefs, ...mine } : localPrefs ?? undefined;
    if (saved?.active?.length) {
      // L'édition personnelle arrive avant la première carte, pour qu'elle ne change pas sous le doigt.
      fetchPicks(saved.active, saved.quota ?? RULES.default_quota, saved.perso !== false).then((r) => {
        setPicks(r);
        setP((x) => ({ ...x, ...pickSaved(saved), ...pickDevice(saved) }));
        setLimit(saved.quota ?? RULES.default_quota);
        setPhase('feed');
      });
    } else setPhase('onb');
  }, [loaded, splashDone, localPrefs]);
  // L'édition se complète au fil de la journée : rechargée toutes les 10 minutes et au retour dans l'app.
  const [edVer, setEdVer] = useState(0);
  // Édition d'un jour passé choisie dans les réglages (null = la plus récente), gardée aux rechargements.
  const [pastDay, setPastDay] = useState<string | null>(null);
  const pastRef = useRef<string | null>(null);
  useEffect(() => {
    if (!remoteConfigured) return;
    const refresh = () => {
      const before = editionSig();
      loadEdition(pastRef.current).then((d) => d && editionSig() !== before && setEdVer((v) => v + 1));
      loadConfig().then((c) => c && setCommentsMode(c.commentsMode));
    };
    const t = setInterval(refresh, RULES.edition_refresh_min * 60000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => { clearInterval(t); sub.remove(); };
  }, []);
  // Widget de l'écran d'accueil : l'info principale du jour, remise à jour à chaque édition chargée.
  useEffect(() => { if (loaded && !pastDay) syncWidget(); }, [loaded, edVer]);
  const ALL_IDS = useMemo(() => new Set(RUBRICS.flatMap((r) => r.items.map((a) => a.id))), [loaded, edVer]);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [p, setP] = useState<Prefs>({ active: [...RULES.default_rubrics], quota: RULES.default_quota, sound: true, haptic: true, parallax: true, premium: false, time: NOTIF.default_time, adsPersonalized: false });

  // Tous les réglages restent sur le téléphone, avec ou sans compte : la présentation ne revient plus.
  useEffect(() => {
    if (phase !== 'feed') return;
    const { premium: _p, notif: _n, ...keep } = p;
    acc.setLocal(LOCAL_PREFS, JSON.stringify(keep));
  }, [phase, p]);
  // Notification du matin : état de cet appareil, puis reprogrammée à chaque ouverture (heure et textes du moment).
  useEffect(() => { notifWanted().then((v) => setP((x) => ({ ...x, notif: v }))); }, []);
  useEffect(() => { if (phase === 'feed') syncNotif(p.time, p.quota); }, [phase, p.time, p.quota]);

  // Fil
  // Dernière minute et campagnes de pub : rechargées toutes les 3 minutes et au retour dans l'app.
  const [flashVer, setFlashVer] = useState(0);
  useEffect(() => {
    const refresh = () => Promise.all([loadFlashes(), loadAds()]).then(([f, a]) => (f || a) && setFlashVer((v) => v + 1));
    refresh();
    const t = setInterval(refresh, RULES.live_refresh_min * 60000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => { clearInterval(t); sub.remove(); };
  }, []);
  // Compte lecteur
  const me = acc.useMe();
  // Premium vient de la base (abonnement, code, cadeau de l'équipe). p.premium ne sert qu'à la démo sans base.
  // bought : le store vient de confirmer un achat, la base le saura dans quelques secondes.
  const [bought, setBought] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const premiumFor = (np: Prefs) => (acc.accountsOn ? acc.isPremium(me) : np.premium) || bought;
  const premium = premiumFor(p);
  useEffect(() => { storeLogin(me?.uid ?? null); if (!me) setBought(false); }, [me?.uid]);
  // Algorithme « Mon édition » : recalculé quand les réglages, le compte, les goûts ou l'édition changent.
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [tasteVer, setTasteVer] = useState(0);
  useEffect(() => {
    if (phase !== 'feed') return;
    let live = true;
    fetchPicks(p.active, p.quota, p.perso !== false).then((r) => live && r && setPicks(r));
    return () => { live = false; };
  }, [phase, p.active.join(','), p.quota, p.perso, me?.uid, edVer, tasteVer]);
  const cols = useMemo(() => {
    const c = buildColumns(p.active, p.quota, premium, p.taste, p.adsPersonalized, picks);
    if (pastDay) c[0].name = `Édition · ${shortDay(pastDay)}`;
    return c;
  }, [p.active, p.quota, premium, p.taste, p.adsPersonalized, flashVer, edVer, picks, pastDay]);
  const [ri, setRi] = useState(0);
  const [idx, setIdx] = useState<Record<string, number>>({});
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [limit, setLimit] = useState(RULES.default_quota);
  const [reactions, setReactions] = useState<Record<string, -1 | 0 | 1>>({});
  const [myEmoji, setMyEmoji] = useState<Record<string, string>>({});
  const [welcome, setWelcome] = useState<AppMessage | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [summary, setSummary] = useState<Article | null>(null);
  const [cmts, setCmts] = useState<Article | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loadingCmts, setLoadingCmts] = useState(false);
  const [account, setAccount] = useState<AccountAsk | null>(null);
  // Sujets suivis : undefined = fermé, null = « Mes sujets », un nom = la frise de ce sujet.
  const [topicView, setTopicView] = useState<string | null | undefined>(undefined);
  useEffect(() => { prefetchTopicsOf([...ALL_IDS]); }, [ALL_IDS]);
  useEffect(() => {
    if (phase !== 'feed') return;
    loadTopics();
    enablePush(false); // adresse de notification à jour (compte, nouveau téléphone), sans redemander l'autorisation
  }, [phase, me?.uid]);
  // Appui sur une alerte « sujet suivi » : la frise du sujet s'ouvre.
  useEffect(() => (phase === 'feed' ? onAlertTap((t) => { setSummary(null); setTopicView(t); }) : undefined), [phase]);
  const openFromTimeline = (id: string) => {
    const a = RUBRICS.flatMap((r) => r.items).find((x) => x.id === id);
    if (!a) return false;
    setTopicView(undefined);
    setTimeout(() => openRead(a), 300);
    return true;
  };
  // De temps en temps, pendant la lecture : proposer un compte (sans compte) ou Premium (compte gratuit).
  // Au plus une fois par ouverture, après quelques infos lues, et pas plus d'une fois tous les N jours (réglable).
  const nudged = useRef(false);
  useEffect(() => {
    if (nudged.current || phase !== 'feed' || overlay || summary || cmts || account || showPremium) return;
    const kind = acc.accountsOn && !me ? 'account' : me && !premium ? 'premium' : null;
    if (!kind) return;
    const n = NUDGES[kind];
    if (!n.enabled || seen.size < n.after_cards) return;
    nudged.current = true;
    acc.getLocal(`titre.nudge.${kind}`).then((last) => {
      if (last && Date.now() - Number(last) < n.every_days * 86400000) return;
      acc.setLocal(`titre.nudge.${kind}`, String(Date.now()));
      if (kind === 'account') setAccount({ reason: NUDGES.account.text }); else setShowPremium(true);
    });
  }, [seen.size, phase, overlay, summary, cmts, account, showPremium, me?.uid, premium]);
  // Nouveaux badges : vérifiés à l'ouverture, au retour dans l'app et toutes les 3 minutes, fêtés un par un.
  // La toute première fois sur un appareil, les badges déjà obtenus sont notés sans animation.
  const [newBadges, setNewBadges] = useState<Badge[]>([]);
  useEffect(() => {
    if (!me || phase !== 'feed') return;
    const check = async () => {
      const card = await acc.readerCard();
      if (!card?.badges) return;
      const key = `titre.badges.${me.uid}`;
      const raw = await acc.getLocal(key);
      let known: string[] = [];
      try { known = raw ? JSON.parse(raw) : []; } catch {}
      const fresh = card.badges.filter((b) => !known.includes(b.label));
      if (!fresh.length) return;
      await acc.setLocal(key, JSON.stringify([...known, ...fresh.map((b) => b.label)]));
      if (raw !== null) setNewBadges((q) => [...q, ...fresh]);
    };
    check();
    const t = setInterval(check, 3 * 60000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => { clearInterval(t); sub.remove(); };
  }, [me?.uid, phase]);
  useEffect(() => { if (newBadges[0]) feel('success', 'ding'); }, [newBadges[0]]);
  // Lien reçu par e-mail (version web) : nouveau mot de passe, compte activé ou lien périmé, traité après l'écran de lancement.
  const [linkEv, setLinkEv] = useState<acc.LinkEvent>(null);
  useEffect(() => { acc.restore().then(() => setLinkEv(acc.takeLinkEvent())); }, []);
  useEffect(() => {
    if (!linkEv || phase === 'splash') return;
    if (linkEv === 'recovery') setAccount({ reason: null, start: 'newpass' });
    else if (linkEv === 'confirmed') showToast('Adresse confirmée : votre compte est actif.');
    else setAccount({ reason: linkEv.error, start: 'in' });
    setLinkEv(null);
  }, [linkEv, phase]);
  /** Lance l'action si le lecteur est connecté (avec un pseudo si besoin), sinon ouvre « Mon compte » puis la lance. */
  const withAccount = (reason: string, then: () => void, needPseudo = false) => {
    const m = acc.currentMe();
    if (m && (!needPseudo || m.pseudo)) return then();
    feel('light');
    setAccount({ reason, then });
  };
  // Mes likes, dislikes et emoji : chargés à la connexion (et quand l'édition se recharge).
  // Les compteurs reçus incluent déjà mon like et mon emoji : on les retire, l'app les ajoute elle-même.
  useEffect(() => {
    if (!me) {
      setReactions({});
      setMyEmoji({});
      return;
    }
    const all = RUBRICS.flatMap((r) => r.items);
    acc.myReactions().then((m) => {
      Object.entries(m).forEach(([id, v]) => {
        const a = all.find((x) => x.id === id);
        if (a && v === 1) a.likes = Math.max(0, a.likes - 1);
      });
      setReactions(m);
    });
    acc.myEmojis().then((m) => {
      Object.entries(m).forEach(([id, e]) => {
        const a = all.find((x) => x.id === id);
        if (a?.emojis?.[e]) a.emojis[e] = Math.max(0, a.emojis[e] - 1);
      });
      setMyEmoji(m);
    });
  }, [me?.uid, loaded, edVer]);
  // Réglages du lecteur connecté : repris à la connexion, enregistrés à chaque changement.
  useEffect(() => {
    const saved = me?.prefs as Partial<Prefs> | undefined;
    if (saved?.active?.length) setP((x) => ({ ...x, ...pickSaved(saved) }));
  }, [me?.uid]);
  const syncedUid = useRef<string | null>(null);
  useEffect(() => {
    if (!me || phase !== 'feed') return;
    const saved = pickSaved(me.prefs as Partial<Prefs>);
    // Juste après la connexion, les réglages enregistrés priment : on attend qu'ils soient appliqués.
    if (syncedUid.current !== me.uid) { syncedUid.current = me.uid; if (saved.active) return; }
    const next = { active: p.active, quota: p.quota, time: p.time, taste: p.taste ?? {}, perso: p.perso !== false };
    if (JSON.stringify(next) !== JSON.stringify({ taste: {}, ...saved })) acc.savePrefs(next).catch(() => {});
  }, [me?.uid, phase, p.active, p.quota, p.time, p.taste, p.perso]);
  // Message de l'équipe à l'ouverture : le plus récent qui s'adresse à ce lecteur et qu'il n'a pas encore vu.
  useEffect(() => {
    if (phase !== 'feed') return;
    let alive = true;
    Promise.all([loadMessages(), acc.getLocal('titre.seenMessages')]).then(([list, raw]) => {
      const seenIds: string[] = raw ? JSON.parse(raw) : [];
      const m = acc.currentMe();
      const fits = (x: AppMessage) => x.audience === 'all' || (x.audience === 'premium' && premium) || (x.audience === 'free' && !premium) || (x.audience === 'members' && !!m) || (x.audience === 'guests' && !m);
      const msg = list.find((x) => fits(x) && !seenIds.includes(x.id));
      if (alive && msg) setTimeout(() => alive && setWelcome(msg), 900);
    }).catch(() => {});
    return () => { alive = false; };
  }, [phase, me?.uid]);
  const closeWelcome = () => {
    const id = welcome?.id;
    setWelcome(null);
    if (id) acc.getLocal('titre.seenMessages').then((raw) => acc.setLocal('titre.seenMessages', JSON.stringify([...(raw ? JSON.parse(raw) : []), id].slice(-50))));
  };
  const readMs = useRef(0);
  const shownAt = useRef(Date.now());
  const bravoShown = useRef(false);

  useEffect(() => { feelPrefs.sound = p.sound; feelPrefs.haptic = p.haptic; }, [p.sound, p.haptic]);

  // Inclinaison du téléphone → la photo bouge un peu (effet de profondeur).
  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);
  useEffect(() => {
    if (phase !== 'feed' || !p.parallax) {
      tiltX.value = withSpring(0);
      tiltY.value = withSpring(0);
      return;
    }
    let base: { b: number; g: number } | null = null;
    let sub: { remove: () => void } | null = null;
    let alive = true;
    // Le capteur peut manquer (simulateur, web) : l'app marche alors sans effet de profondeur.
    DeviceMotion.isAvailableAsync().then((ok) => {
      if (!ok || !alive) return;
      try {
    DeviceMotion.setUpdateInterval(33);
    sub = DeviceMotion.addListener((m) => {
      const r = m.rotation;
      if (!r) return;
      if (!base) base = { b: r.beta, g: r.gamma };
      // ramène doucement la position de référence vers la tenue actuelle
      base.b += (r.beta - base.b) * 0.01;
      base.g += (r.gamma - base.g) * 0.01;
      const clamp = (v: number) => Math.max(-1, Math.min(1, v));
      tiltX.value = withSpring(clamp((r.gamma - base.g) / 0.35) * 18, { duration: 300, dampingRatio: 1 });
      tiltY.value = withSpring(clamp((r.beta - base.b) / 0.35) * 18, { duration: 300, dampingRatio: 1 });
    });
      } catch {}
    }).catch(() => {});
    return () => { alive = false; sub?.remove(); };
  }, [phase, p.parallax]);

  // Toast
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((m: string) => {
    setToast(m);
    if (toastT.current) clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(null), m.length > 60 ? 4500 : 2200);
  }, []);
  useEffect(() => {
    if (phase === 'feed' && demoNote.current) {
      demoNote.current = false;
      const t = setTimeout(() => showToast('Aucune édition publiée pour l’instant : vous voyez le contenu de démonstration.'), 1200);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // Carte affichée → marquée comme lue après un court instant.
  const current: Card | undefined = cols[ri]?.cards[idx[cols[ri]?.id] ?? 0];
  useEffect(() => {
    if (phase !== 'feed' || overlay || !current || !isArticle(current)) return;
    shownAt.current = Date.now();
    const id = current.id;
    const t = setTimeout(() => markSeen(id), DWELL_MS);
    return () => {
      const ms = Date.now() - shownAt.current;
      readMs.current += Math.min(60000, ms);
      signal(id, 'view', ms); // temps passé sur la carte : passée trop vite ou lue longuement
      clearTimeout(t);
    };
  }, [current, phase, overlay]);

  // Pub restée une seconde à l'écran : un affichage compté pour la campagne.
  useEffect(() => {
    if (phase !== 'feed' || overlay || !current || !isAd(current)) return;
    const ad = current;
    const t = setTimeout(() => adHit(ad), 1000);
    return () => clearTimeout(t);
  }, [current, phase, overlay]);

  const markSeen = (id: string) =>
    setSeen((s) => {
      if (s.has(id)) return s;
      const n = new Set(s);
      n.add(id);
      return n;
    });

  const allRead = seen.size >= ALL_IDS.size;
  const remaining = ALL_IDS.size - seen.size;

  const canEnter = (c: Card) => {
    if (!isArticle(c) || seen.has(c.id)) return true;
    if (seen.size >= limit) {
      openBravo();
      return false;
    }
    return true;
  };
  const openBravo = () => {
    bravoShown.current = true;
    setOverlay('bravo');
  };
  const onEndOfColumn = () => {
    if (cols[ri].id === 'flash') showToast('Vous êtes à jour. Les nouvelles infos arrivent ici dès qu’elles tombent.');
    else if (cols[ri].id === 'edition' || seen.size >= limit) openBravo();
    else showToast('Fin de la rubrique. Glissez vers la droite pour en voir une autre.');
  };

  // Rubriques : quand l'édition est lue, on passe au fil de la rubrique suivante.
  useEffect(() => {
    if (phase === 'feed' && !overlay && seen.size >= limit && !bravoShown.current) {
      const t = setTimeout(openBravo, 900);
      return () => clearTimeout(t);
    }
  }, [seen, limit, phase, overlay]);

  /** Like (1) ou dislike (-1) ; un second appui annule. Le goût de la rubrique suit, pour ordonner l'édition. */
  const onReact = (a: Article, v: 1 | -1) => {
    const apply = () => {
      const prev = reactions[a.id] ?? 0;
      const next: -1 | 0 | 1 = prev === v ? 0 : v;
      setReactions((r) => ({ ...r, [a.id]: next }));
      const rub = rubricOf(a)?.id;
      if (rub) setP((x) => ({ ...x, taste: { ...x.taste, [rub]: (x.taste?.[rub] ?? 0) + next - prev } }));
      feel(next === 1 ? 'medium' : next === -1 ? 'light' : 'select', next === 1 ? 'pop' : next === -1 ? 'thud' : null);
      return { prev, next };
    };
    if (!acc.isLive(a.id)) return void apply();
    withAccount('Créez un compte gratuit pour réagir aux infos et commenter.', () => {
      const { prev, next } = apply();
      acc.react(a.id, next).catch((e) => {
        setReactions((r) => ({ ...r, [a.id]: prev }));
        showToast(e instanceof acc.UserError ? e.message : 'Réaction non enregistrée. Réessayez.');
      });
    });
  };
  const onEmoji = (a: Article, e: string | null) => {
    const prev = myEmoji[a.id] ?? null;
    const set = (v: string | null) => setMyEmoji((m) => { const n = { ...m }; if (v) n[a.id] = v; else delete n[a.id]; return n; });
    if (!acc.isLive(a.id)) return set(e);
    withAccount('Créez un compte gratuit pour réagir aux infos.', () => {
      set(e);
      acc.setEmoji(a.id, e).catch(() => { set(prev); showToast('Réaction non enregistrée. Réessayez.'); });
    });
  };
  const commentsOf = (a: Article) => comments[a.id] ?? (acc.isLive(a.id) ? [] : seedComments());
  const commentCount = (a: Article) => (acc.isLive(a.id) ? comments[a.id]?.length ?? a.comments : a.comments + Math.max(0, commentsOf(a).length - 5));
  const reloadComments = (a: Article) => {
    if (!acc.isLive(a.id)) return Promise.resolve();
    setLoadingCmts(true);
    return acc.loadComments(a.id)
      .then((list) => setComments((m) => ({ ...m, [a.id]: list })))
      .catch(() => showToast('Commentaires indisponibles pour le moment.'))
      .finally(() => setLoadingCmts(false));
  };
  const setCmtList = (a: Article, f: (l: Comment[]) => Comment[]) => setComments((m) => ({ ...m, [a.id]: f(m[a.id] ?? commentsOf(a)) }));
  const sendComment = async (text: string): Promise<string | null> => {
    const a = cmts;
    if (!a) return null;
    if (!acc.isLive(a.id)) {
      const c: Comment = { id: 'm' + Date.now(), who: 'lecteur_matinal', color: C.violet, text, likes: 0, dislikes: 0, ago: "à l'instant", mine: 0, order: -1 - commentsOf(a).length, own: true };
      setCmtList(a, (l) => [...l, c]);
      return c.id;
    }
    const m = acc.currentMe();
    if (!m || !m.pseudo) {
      withAccount('Créez un compte gratuit pour commenter. Votre commentaire reste dans le champ.', () => {}, true);
      return null;
    }
    try {
      await acc.postComment(a.id, text);
      const list = await acc.loadComments(a.id);
      setComments((x) => ({ ...x, [a.id]: list }));
      return list.find((c) => c.own && c.text === text.trim())?.id ?? null;
    } catch (e) {
      showToast(e instanceof acc.UserError ? e.message : 'Commentaire non envoyé. Réessayez.');
      return null;
    }
  };
  const voteComment = (c: Comment, v: -1 | 0 | 1) => {
    const a = cmts;
    if (!a) return;
    const apply = (val: -1 | 0 | 1) => setCmtList(a, (l) => l.map((k) => (k.id === c.id ? { ...k, mine: val } : k)));
    if (!acc.isLive(a.id)) return apply(v);
    withAccount('Créez un compte gratuit pour voter et commenter.', () => {
      apply(v);
      acc.voteComment(c.id, v).catch(() => { apply(c.mine); showToast('Vote non enregistré. Réessayez.'); });
    });
  };
  const flagComment = (c: Comment) => {
    const a = cmts;
    if (!a || !acc.isLive(a.id)) return showToast('Merci, l’équipe va vérifier ce commentaire.');
    withAccount('Connectez-vous pour signaler un commentaire.', () => {
      acc.reportComment(c.id).then(() => showToast('Merci, l’équipe va vérifier ce commentaire.')).catch(() => showToast('Signalement non envoyé. Réessayez.'));
    });
  };
  const blockComment = (c: Comment) => {
    const a = cmts;
    if (!a) return;
    const hide = () => setCmtList(a, (l) => l.filter((k) => k.who !== c.who));
    if (!acc.isLive(a.id)) { hide(); return showToast(`Vous ne verrez plus les commentaires de ${c.who}.`); }
    withAccount('Connectez-vous pour bloquer un compte.', () => {
      acc.blockAuthor(c.id).then(() => { hide(); feel('light'); showToast(`Vous ne verrez plus les commentaires de ${c.who}. Pour annuler : Mon compte.`); })
        .catch(() => showToast('Blocage impossible. Réessayez.'));
    });
  };
  const deleteComment = (c: Comment) => {
    const a = cmts;
    if (!a) return;
    setCmtList(a, (l) => l.filter((k) => k.id !== c.id));
    feel('light');
    if (acc.isLive(a.id)) acc.deleteComment(c.id).catch(() => { reloadComments(a); showToast('Suppression impossible. Réessayez.'); });
  };
  const openRead = (a: Article) => {
    markSeen(a.id);
    signal(a.id, 'summary');
    feel('light', 'whoosh');
    setSummary(a);
  };
  const openComments = (a: Article) => {
    feel('light');
    setCmts(a);
    reloadComments(a);
  };

  const onOnb = async (r: OnbResult) => {
    setPicks(await fetchPicks(r.active.length ? r.active : p.active, r.quota, true));
    setP((x) => ({ ...x, active: r.active.length ? r.active : x.active, quota: r.quota, time: r.time, adsPersonalized: r.adsPersonalized }));
    setLimit(r.quota);
    setPhase('feed');
    r.notif?.then((v) => setP((x) => ({ ...x, notif: v })));
    if (r.account) setTimeout(() => setAccount({ reason: 'Votre compte gratuit : une édition qui apprend de vos likes et dislikes, sur tous vos appareils.' }), 500);
    else if (r.premium) setTimeout(() => setShowPremium(true), 500);
  };

  const onSave = (np: Prefs) => {
    if (!!np.notif !== !!p.notif) setNotif(!!np.notif, np.time, np.quota).then((v) => setP((x) => ({ ...x, notif: v })));
    // On revient sur la même carte si elle existe encore dans le nouveau fil.
    const prev = current;
    // Premium ne se règle pas ici (volet Premium) : on garde la valeur actuelle.
    np = { ...np, premium: p.premium };
    const next = buildColumns(np.active, np.quota, premiumFor(np), np.taste, np.adsPersonalized, picks);
    let nri = Math.min(ri, next.length - 1);
    const nidx: Record<string, number> = {};
    if (prev) {
      const ci = next.findIndex((c) => c.id === cols[ri]?.id);
      if (ci >= 0) {
        nri = ci;
        const k = next[ci].cards.findIndex((c) => c.id === prev.id);
        nidx[next[ci].id] = Math.max(0, k);
      }
    }
    if (np.quota !== p.quota) setLimit(Math.max(np.quota, seen.size));
    bravoShown.current = seen.size >= Math.max(np.quota, limit) && bravoShown.current;
    setP(np);
    setRi(nri);
    setIdx(nidx);
    setOverlay(null);
    feel('success', 'ding');
    showToast('Réglages enregistrés');
  };

  const onPast = (day: string | null) =>
    loadEdition(day).then((d) => {
      if (!d) return showToast('Pas de connexion. Réessayez.');
      pastRef.current = day;
      setPastDay(day);
      setSeen(new Set());
      bravoShown.current = false;
      setRi(0);
      setIdx({});
      setEdVer((v) => v + 1);
      showToast(day ? `Édition du ${dayLabel(`${day}T12:00:00Z`)}` : 'Édition du jour');
    });

  const onResetTaste = () =>
    resetTaste()
      .then(() => { setP((x) => ({ ...x, taste: {} })); setTasteVer((v) => v + 1); showToast('Vos goûts sont remis à zéro. Votre édition repart des sujets majeurs.'); })
      .catch(() => showToast('Pas de connexion. Réessayez.'));
  const onLess = (a: Article) => {
    signal(a.id, 'less');
    feel('select');
    showToast('Compris : moins de sujets comme celui-ci dans vos prochaines éditions.');
  };

  const moreCount = Math.min(p.quota, remaining);
  const onMore = () => {
    setLimit((l) => l + moreCount);
    bravoShown.current = false;
    // On enchaîne sur la première rubrique qui a encore des infos non lues.
    const ci = cols.findIndex((c, k) => k > 0 && c.cards.some((x) => isArticle(x) && !seen.has(x.id)));
    if (ci > 0) {
      const k = cols[ci].cards.findIndex((x) => isArticle(x) && !seen.has(x.id));
      setRi(ci);
      setIdx((m) => ({ ...m, [cols[ci].id]: k }));
    }
    setOverlay(null);
  };

  const onReread = () => {
    setLimit(ALL_IDS.size);
    bravoShown.current = true;
    setRi(0);
    setIdx({});
    setOverlay(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.night }}>
      {phase === 'feed' ? (
        <Feed
          key={cols.map((c) => c.id).join('|') + (premium ? 'p' : '')}
          W={W}
          H={H}
          cols={cols}
          ri={ri}
          idx={idx}
          seenN={Math.min(seen.size, limit)}
          limit={limit}
          reactions={reactions}
          seen={seen}
          commentCount={commentCount}
          parallax={p.parallax}
          tiltX={tiltX}
          tiltY={tiltY}
          canEnter={canEnter}
          onEndOfColumn={onEndOfColumn}
          setPos={(nri, colId, n) => {
            // Retour en arrière sur une info : elle a retenu l'attention.
            const back = nri === ri && n < (idx[colId] ?? 0) ? cols[nri]?.cards[n] : undefined;
            if (back && isArticle(back)) signal(back.id, 'back');
            setRi(nri);
            setIdx((m) => ({ ...m, [colId]: n }));
          }}
          onRead={openRead}
          onComments={openComments}
          onReact={onReact}
          emojiMode={commentsMode === 'emoji'}
          myEmoji={myEmoji}
          onEmoji={onEmoji}
          onToast={showToast}
          onSignal={(a: Article, k: Signal) => signal(a.id, k)}
          onLess={onLess}
          onSettings={() => { feel('light'); setOverlay('settings'); }}
        />
      ) : null}

      <SummarySheet
        a={summary}
        open={!!summary}
        onClose={() => setSummary(null)}
        H={H}
        reaction={summary ? reactions[summary.id] ?? 0 : 0}
        onReact={(v) => summary && onReact(summary, v)}
        onComments={() => { if (summary) { const a = summary; setSummary(null); setTimeout(() => openComments(a), 250); } }}
        commentCount={summary ? commentCount(summary) : 0}
        emojiMode={commentsMode === 'emoji'}
        onSignal={(k) => summary && signal(summary.id, k)}
        extra={summary ? <FollowRow a={summary} onToast={showToast} onOpen={(t) => { setSummary(null); setTopicView(t); }} /> : null}
      />
      <CommentsSheet
        a={cmts}
        open={!!cmts}
        onClose={() => setCmts(null)}
        H={H}
        comments={cmts ? commentsOf(cmts) : []}
        total={cmts ? commentCount(cmts) : 0}
        loading={loadingCmts}
        onSend={sendComment}
        onVote={voteComment}
        onFlag={flagComment}
        onDelete={deleteComment}
        onBlock={blockComment}
        loadCard={(c) => (acc.isLive(c.id) ? acc.readerCard(c.id) : Promise.resolve(demoCard(c)))}
      />

      {overlay === 'settings' ? (
        <Settings
          W={W}
          prefs={p}
          onSave={onSave}
          onClose={() => setOverlay(null)}
          account={me ? me.pseudo ?? '' : null}
          onAccount={() => (acc.accountsOn ? setAccount({ reason: null }) : showToast('Les comptes arrivent avec la vraie base (mode démo).'))}
          onResetTaste={onResetTaste}
          onTopics={() => setTopicView(null)}
          pastDay={pastDay}
          onPast={onPast}
          premium={premium}
          onPremium={() => setShowPremium(true)}
        />
      ) : null}
      {topicView !== undefined ? (
        <TopicsScreen W={W} start={topicView} onClose={() => setTopicView(undefined)} onToast={showToast} onOpenArticle={openFromTimeline} />
      ) : null}
      {overlay === 'bravo' ? (
        <Bravo
          n={seen.size}
          realMs={readMs.current}
          canMore={moreCount > 0}
          moreCount={moreCount}
          onMore={onMore}
          onTomorrow={() => setOverlay('end')}
        />
      ) : null}
      {overlay === 'end' ? <End n={seen.size} realMs={readMs.current} allRead={allRead} left={remaining} onReread={onReread} /> : null}

      {showPremium ? (
        <Premium
          W={W}
          demo={!acc.accountsOn}
          demoOn={p.premium}
          onDemo={(on) => setP((x) => ({ ...x, premium: on }))}
          onBought={() => setBought(true)}
          onToast={showToast}
          onClose={() => setShowPremium(false)}
          onNeedAccount={(then) => setAccount({ reason: 'Premium est lié à votre compte : vous le retrouvez sur tous vos appareils.', then })}
        />
      ) : null}

      {welcome && phase === 'feed' && !overlay ? <Welcome title={welcome.title} body={welcome.body} onClose={closeWelcome} /> : null}
      {phase === 'onb' ? <Onboarding W={W} onDone={onOnb} /> : null}
      {/* Au-dessus de la présentation : un lien « mot de passe oublié » peut arriver sur un téléphone neuf. */}
      {account ? (
        <Account
          W={W}
          reason={account.reason}
          start={account.start}
          onToast={showToast}
          onClose={() => setAccount(null)}
          onReady={account.then ? () => { const f = account.then!; setAccount(null); f(); } : undefined}
        />
      ) : null}
      {phase === 'splash' ? <Splash onDone={() => setSplashDone(true)} /> : null}

      <ShareCardHost />
      <Toast msg={toast} top={insets.top + 96} />
      {newBadges[0] ? (
        <BadgeToast key={newBadges[0].label} badge={newBadges[0]} top={insets.top + 8}
          onDone={() => setNewBadges((q) => q.slice(1))}
          onOpen={() => { setNewBadges([]); setAccount({ reason: null }); }} />
      ) : null}
    </View>
  );
}


const LOCAL_PREFS = 'titre.prefs';
/** Réglages propres à ce téléphone (sons, vibrations, profondeur, pubs ciblées). */
function pickDevice(s: Partial<Prefs>): Partial<Prefs> {
  const o: Partial<Prefs> = {};
  (['sound', 'haptic', 'parallax', 'adsPersonalized'] as const).forEach((k) => { if (typeof s[k] === 'boolean') o[k] = s[k]; });
  return o;
}

/** Les réglages qui suivent le lecteur d'un appareil à l'autre. */
function pickSaved(s: Partial<Prefs> | undefined): Partial<Prefs> {
  if (!s) return {};
  const o: Partial<Prefs> = {};
  if (Array.isArray(s.active) && s.active.length) o.active = s.active;
  if (typeof s.quota === 'number') o.quota = s.quota;
  if (typeof s.time === 'string') o.time = s.time;
  if (s.taste && typeof s.taste === 'object') o.taste = s.taste;
  if (typeof s.perso === 'boolean') o.perso = s.perso;
  return o;
}

function Framed({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const f = useFrame();
  if (!framed(width)) return <>{children}</>;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.deep }}>
      <View style={{ width: f.width, height: f.height, borderRadius: 36, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>{children}</View>
      <Text style={{ position: 'absolute', bottom: 8, color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>Version de test · sur téléphone, ajoutez-la à l'écran d'accueil</Text>
    </View>
  );
}
