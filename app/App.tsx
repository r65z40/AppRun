import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, Text, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedValue, withSpring } from 'react-native-reanimated';
import { DeviceMotion } from 'expo-sensors';
import { useFonts, Archivo_400Regular, Archivo_600SemiBold, Archivo_900Black } from '@expo-google-fonts/archivo';
import { C } from './src/theme';
import { RUBRICS } from './src/content';
import { buildColumns, seedComments } from './src/edition';
import { Feed } from './src/Feed';
import { SummarySheet, CommentsSheet } from './src/Sheets';
import { Bravo, End, Onboarding, Settings, Splash, Toast, type OnbResult, type Prefs } from './src/Screens';
import { initFeel, feel, prefs as feelPrefs } from './src/feel';
import { loadEdition, loadFlashes, remoteConfigured } from './src/remote';
import { Account } from './src/Account';
import * as acc from './src/account';
import { isArticle, type Article, type Card, type Comment } from './src/types';

type Phase = 'splash' | 'onb' | 'feed';
type Overlay = null | 'bravo' | 'end' | 'settings';
type AccountAsk = { reason: string | null; then?: () => void };

const DWELL_MS = 1200; // une info compte comme lue après ~1 s à l'écran

// Sur ordinateur (version web), l'app s'affiche dans un cadre de téléphone au centre de la page.
const framed = (w: number) => Platform.OS === 'web' && w > 560;
function useFrame() {
  const { width, height } = useWindowDimensions();
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
  useEffect(() => { loadEdition().then((d) => { demoNote.current = !d && remoteConfigured; }).finally(() => setLoaded(true)); }, []);
  useEffect(() => { if (loaded && splashDone && phase === 'splash') setPhase('onb'); }, [loaded, splashDone]);
  const ALL_IDS = useMemo(() => new Set(RUBRICS.flatMap((r) => r.items.map((a) => a.id))), [loaded]);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [p, setP] = useState<Prefs>({ active: ['france', 'monde', 'eco', 'tech'], quota: 8, sound: true, haptic: true, parallax: true, premium: false, time: '7 h 30', adsPersonalized: false });

  // Fil
  // Dernière minute : rechargée toutes les 3 minutes et au retour dans l'app.
  const [flashVer, setFlashVer] = useState(0);
  useEffect(() => {
    const refresh = () => loadFlashes().then((changed) => changed && setFlashVer((v) => v + 1));
    refresh();
    const t = setInterval(refresh, 180000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => { clearInterval(t); sub.remove(); };
  }, []);
  const cols = useMemo(() => buildColumns(p.active, p.quota, p.premium), [p.active, p.quota, p.premium, flashVer]);
  const [ri, setRi] = useState(0);
  const [idx, setIdx] = useState<Record<string, number>>({});
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [limit, setLimit] = useState(8);
  const [reactions, setReactions] = useState<Record<string, -1 | 0 | 1>>({});
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [summary, setSummary] = useState<Article | null>(null);
  const [cmts, setCmts] = useState<Article | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loadingCmts, setLoadingCmts] = useState(false);
  // Compte lecteur
  const me = acc.useMe();
  const [account, setAccount] = useState<AccountAsk | null>(null);
  useEffect(() => { acc.restore(); }, []);
  /** Lance l'action si le lecteur est connecté (avec un pseudo si besoin), sinon ouvre « Mon compte » puis la lance. */
  const withAccount = (reason: string, then: () => void, needPseudo = false) => {
    const m = acc.currentMe();
    if (m && (!needPseudo || m.pseudo)) return then();
    feel('light');
    setAccount({ reason, then });
  };
  // Mes likes : chargés à la connexion. Les compteurs reçus incluent déjà mon like, l'app l'ajoute elle-même.
  const likedBase = useRef(new Set<string>());
  useEffect(() => {
    if (!me) {
      setReactions({});
      return;
    }
    acc.myLikes().then((ids) => {
      const all = RUBRICS.flatMap((r) => r.items);
      ids.forEach((id) => {
        if (likedBase.current.has(id)) return;
        likedBase.current.add(id);
        const a = all.find((x) => x.id === id);
        if (a) a.likes = Math.max(0, a.likes - 1);
      });
      setReactions((r) => ({ ...r, ...Object.fromEntries(ids.map((id) => [id, 1 as const])) }));
    });
  }, [me?.uid, loaded]);
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
      readMs.current += Math.min(60000, Date.now() - shownAt.current);
      clearTimeout(t);
    };
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

  const onReact = (a: Article, v: 1 | -1) => {
    if (!acc.isLive(a.id)) {
      setReactions((r) => ({ ...r, [a.id]: r[a.id] === v ? 0 : v }));
      feel(v === 1 ? 'light' : 'select', v === 1 ? 'pop' : 'thud');
      return;
    }
    withAccount('Créez un compte gratuit pour aimer les infos et commenter.', () => {
      const on = reactions[a.id] !== 1;
      setReactions((r) => ({ ...r, [a.id]: on ? 1 : 0 }));
      feel(on ? 'light' : 'select', on ? 'pop' : 'thud');
      acc.like(a.id, on).catch((e) => {
        setReactions((r) => ({ ...r, [a.id]: on ? 0 : 1 }));
        showToast(e instanceof acc.UserError ? e.message : 'Like non enregistré. Réessayez.');
      });
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
    feel('light', 'whoosh');
    setSummary(a);
  };
  const openComments = (a: Article) => {
    feel('light');
    setCmts(a);
    reloadComments(a);
  };

  const onOnb = (r: OnbResult) => {
    setP((x) => ({ ...x, active: r.active.length ? r.active : x.active, quota: r.quota, time: r.time, adsPersonalized: r.adsPersonalized, premium: !!r.premium }));
    setLimit(r.quota);
    setPhase('feed');
  };

  const onSave = (np: Prefs) => {
    // On revient sur la même carte si elle existe encore dans le nouveau fil.
    const prev = current;
    const next = buildColumns(np.active, np.quota, np.premium);
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
          key={cols.map((c) => c.id).join('|') + (p.premium ? 'p' : '')}
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
            setRi(nri);
            setIdx((m) => ({ ...m, [colId]: n }));
          }}
          onRead={openRead}
          onComments={openComments}
          onReact={onReact}
          onToast={showToast}
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
      />

      {overlay === 'settings' ? (
        <Settings
          W={W}
          prefs={p}
          onSave={onSave}
          onClose={() => setOverlay(null)}
          account={me ? me.pseudo ?? '' : null}
          onAccount={() => (acc.accountsOn ? setAccount({ reason: null }) : showToast('Les comptes arrivent avec la vraie base (mode démo).'))}
        />
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

      {account ? (
        <Account
          W={W}
          reason={account.reason}
          onToast={showToast}
          onClose={() => setAccount(null)}
          onReady={account.then ? () => { const f = account.then!; setAccount(null); f(); } : undefined}
        />
      ) : null}

      {phase === 'onb' ? <Onboarding W={W} onDone={onOnb} /> : null}
      {phase === 'splash' ? <Splash onDone={() => setSplashDone(true)} /> : null}

      <Toast msg={toast} top={insets.top + 96} />
    </View>
  );
}


function Framed({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const f = useFrame();
  if (!framed(width)) return <>{children}</>;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#07051a' }}>
      <View style={{ width: f.width, height: f.height, borderRadius: 36, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>{children}</View>
      <Text style={{ position: 'absolute', bottom: 8, color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>Version de test · sur téléphone, ajoutez-la à l'écran d'accueil</Text>
    </View>
  );
}
