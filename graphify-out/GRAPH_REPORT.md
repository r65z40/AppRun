# Graph Report - AppRun  (2026-11-24)

## Corpus Check
- 118 files · ~140,761 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: (none) 4, .xml 4, .example 3)

## Summary
- 1332 nodes · 3237 edges · 64 communities (46 shown, 18 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7882bdde`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Account.tsx
- src/App.tsx
- data.ts
- Api
- admin/src/Premium.tsx
- ai.ts
- Ads.tsx
- brand.ts
- pexels.ts
- Brand.tsx
- Invite.tsx
- app/src/Premium.tsx
- Feed.tsx
- Algo.tsx
- Screens.tsx
- run.ts
- public.dispatch_workflow
- guard.ts
- edition.ts
- admin/src/Badges.tsx
- Essayer TITRE en vrai (environ 15 minutes)
- flash.ts
- public.articles
- ShareCard.tsx
- src/mail.ts
- Règles pour Claude sur TITRE
- Referral.tsx
- widget.android.tsx
- Follow.tsx
- anon
- q
- À faire une fois (environ 1 heure, hors délais de validation Apple et Google)
- public.app_settings
- app/App.tsx
- Back office TITRE
- TITRE : essayer l'app sur iPhone
- public.profiles
- setup-sql.sh
- run-local.sh
- app/src/Badges.tsx
- 0025_regie_objectifs.sql
- public
- 0022_reconnaissance.sql
- 0013_moderation_lecteurs.sql
- restore
- 0002_roles.sql
- Topics.tsx
- algo.sql
- follow.sql
- account.ts
- feel.ts
- src/tdm.ts

## God Nodes (most connected - your core abstractions)
1. `Main()` - 68 edges
2. `Api` - 64 edges
3. `public.profiles` - 56 edges
4. `public.articles` - 47 edges
5. `auth.users` - 37 edges
6. `public.comments` - 36 edges
7. `feel()` - 31 edges
8. `public.app_settings` - 28 edges
9. `App()` - 25 edges
10. `Account()` - 23 edges

## Surprising Connections (you probably didn't know these)
- `Main()` --calls--> `currentMe()`  [EXTRACTED]
  app/App.tsx → app/src/account.ts
- `Main()` --calls--> `myEmojis()`  [EXTRACTED]
  app/App.tsx → app/src/account.ts
- `Main()` --calls--> `myReactions()`  [EXTRACTED]
  app/App.tsx → app/src/account.ts
- `Main()` --calls--> `takeLinkEvent()`  [EXTRACTED]
  app/App.tsx → app/src/account.ts
- `public.is_admin()` --reads_from--> `public.profiles`  [EXTRACTED]
  backend/supabase/migrations/0002_roles.sql → backend/supabase/migrations/0001_init.sql

## Import Cycles
- 2-file cycle: `admin/src/data.ts -> admin/src/demo.ts -> admin/src/data.ts`

## Communities (64 total, 18 thin omitted)

### Community 0 - "Account.tsx"
Cohesion: 0.18
Nodes (24): Account(), auth(), back(), blockedCount(), DRAWER, emit(), Field(), french() (+16 more)

### Community 1 - "src/App.tsx"
Cohesion: 0.07
Nodes (56): ReaderTaste(), ADMIN_ONLY, ago(), AI_TABS, AIPage(), AITab, allowed(), App() (+48 more)

### Community 2 - "data.ts"
Cohesion: 0.05
Nodes (55): AppMessage, Article, Audience, AUDIENCES, AuditEntry, Comment, Dashboard, Edition (+47 more)

### Community 4 - "admin/src/Premium.tsx"
Cohesion: 0.08
Nodes (31): Codes(), FILTERS, live(), ok(), Period, PERIOD, Plan, PremiumApi (+23 more)

### Community 5 - "ai.ts"
Cohesion: 0.09
Nodes (39): api(), CardSchema, checkCard(), checkFlash(), clamp(), cleanStories(), EFFORT(), Flashes (+31 more)

### Community 6 - "Ads.tsx"
Cohesion: 0.09
Nodes (32): AdsPage(), Campaign, CampaignForm(), days(), dayShift(), demoList, demoStats, Draft (+24 more)

### Community 7 - "brand.ts"
Cohesion: 0.08
Nodes (32): Boot(), getLocal(), restore(), apply(), applyRules(), applyShare(), bootBrand(), BRAND (+24 more)

### Community 8 - "pexels.ts"
Cohesion: 0.29
Nodes (10): findPhoto(), fromPexels(), fromUnsplash(), pexels(), pexelsOn(), PickedPhoto, PPhoto, unsplash() (+2 more)

### Community 9 - "Brand.tsx"
Cohesion: 0.09
Nodes (34): Brand, BrandPage(), COLORS, FONT_CSS, FONTS, FORMATS, HOURS, Identity() (+26 more)

### Community 10 - "Invite.tsx"
Cohesion: 0.39
Nodes (7): myReferral(), Referral, referralLink(), Invite(), plural(), s, Stat()

### Community 11 - "app/src/Premium.tsx"
Cohesion: 0.11
Nodes (29): isPremium(), loadPlans(), MySub, mySubscription(), Plan, redeemCode(), reloadMe(), useMe() (+21 more)

### Community 12 - "Feed.tsx"
Cohesion: 0.10
Nodes (46): BadgeIcons(), BadgeList(), pseudoColor(), ReaderCardView(), cap(), flashTime(), fmt(), todayLabel() (+38 more)

### Community 13 - "Algo.tsx"
Cohesion: 0.10
Nodes (20): AlgoConf, AlgoPage(), DEFAULTS, demoReader, demoStats, demoWords, Keyword, ok() (+12 more)

### Community 14 - "Screens.tsx"
Cohesion: 0.14
Nodes (27): setLocal(), NOTIF, notifBody(), parse(), schedule(), setNotif(), Bravo(), Dot() (+19 more)

### Community 15 - "run.ts"
Cohesion: 0.11
Nodes (21): CardOut, cardText(), doubtIssue(), minorIssue(), Story, cfg, snapshot(), dedupe() (+13 more)

### Community 16 - "public.dispatch_workflow"
Cohesion: 0.28
Nodes (4): public.dispatch_log, public.dispatch_status(), public.dispatch_workflow(), public.launch_engine()

### Community 17 - "guard.ts"
Cohesion: 0.25
Nodes (7): AiStopped, budget, Item, clean, invented, items, loaded

### Community 19 - "edition.ts"
Cohesion: 0.06
Nodes (48): adHit(), ADS, DEMO, Ev, flush(), pickAds(), push(), queue (+40 more)

### Community 20 - "admin/src/Badges.tsx"
Cohesion: 0.11
Nodes (17): Badge, BadgeRow(), BadgesPage(), Conf, CONF, ConfPanel(), demo, demoHolders (+9 more)

### Community 21 - "Essayer TITRE en vrai (environ 15 minutes)"
Cohesion: 0.10
Nodes (17): Algorithme « Mon édition » (sans IA), Ce qui reste ouvert, Dernière minute, En local, Moteur de contenu TITRE, Sujets suivis, À brancher (une fois), 1. Supabase : créer la base et noter 3 valeurs (5 min) (+9 more)

### Community 22 - "flash.ts"
Cohesion: 0.16
Nodes (21): cost(), judgeComments(), model(), setRubricHints(), usage, Alert, sendTopicAlerts(), alerts() (+13 more)

### Community 23 - "public.articles"
Cohesion: 0.06
Nodes (66): articles_edition, articles_touch, comments_article, public.article_stats, public.articles, public.editions, public.is_staff(), public.raw_items (+58 more)

### Community 24 - "ShareCard.tsx"
Cohesion: 0.11
Nodes (22): SHARE, onShare(), Welcome(), Job, plain(), Result, shareArticle(), ShareCardHost() (+14 more)

### Community 25 - "src/mail.ts"
Cohesion: 0.22
Nodes (14): authPatch(), env(), main(), save(), Brand, brand(), env(), esc() (+6 more)

### Community 26 - "Règles pour Claude sur TITRE"
Cohesion: 0.40
Nodes (4): 1. Toujours le skill « ponytail », 2. Toujours la carte Graphify, 3. Rappels du projet, Règles pour Claude sur TITRE

### Community 27 - "Referral.tsx"
Cohesion: 0.15
Nodes (13): api, sb, Admin, Conf, CONF, ConfPanel(), date(), demo (+5 more)

### Community 29 - "Follow.tsx"
Cohesion: 0.16
Nodes (9): DEFAULTS, demoStats, fmt(), FollowConf, FollowPage(), ok(), real(), Stats (+1 more)

### Community 30 - "anon"
Cohesion: 0.12
Nodes (27): promo_attempts_user, public.admin_grant_premium(), public.admin_revoke_premium(), public.admin_sub_events(), public.admin_subscribers(), public.apply_store_event(), public.expire_premium(), public.give_days() (+19 more)

### Community 31 - "q"
Cohesion: 0.14
Nodes (18): collect(), collectAll(), CollectResult, slug(), Source, pool, q(), DIR (+10 more)

### Community 32 - "À faire une fois (environ 1 heure, hors délais de validation Apple et Google)"
Cohesion: 0.22
Nodes (8): 1. Les stores, 2. RevenueCat (gratuit jusqu'à 2 500 $ de revenus par mois), 3. Le webhook (RevenueCat prévient la base), 4. L'app, Bon à savoir, Ce qui est déjà fait dans le code, TITRE Premium : mettre en route les abonnements, À faire une fois (environ 1 heure, hors délais de validation Apple et Google)

### Community 33 - "public.app_settings"
Cohesion: 0.07
Nodes (30): public.admin_settings(), public.app_settings, public.handle_new_user(), public.needs_admin(), public.set_setting(), public.set_setting(), public.set_setting(), public.has_insult() (+22 more)

### Community 34 - "app/App.tsx"
Cohesion: 0.10
Nodes (30): AccountAsk, App(), editionSig(), fetchPicks(), framed(), Main(), Overlay, Phase (+22 more)

### Community 35 - "Back office TITRE"
Cohesion: 0.33
Nodes (5): Back office TITRE, Ce qu'on y fait, En local, Mettre en ligne (gratuit, GitHub Pages), Premier accès

### Community 36 - "TITRE : essayer l'app sur iPhone"
Cohesion: 0.33
Nodes (5): Ce qu'il faut, Lancer (5 minutes la première fois), Le widget « Titre du jour » (écran d'accueil), TITRE : essayer l'app sur iPhone, À essayer

### Community 38 - "public.profiles"
Cohesion: 0.12
Nodes (37): public.comment_votes, public.comments, public.profiles, public.reports, comments_guard, profiles_pseudo_lower, public.article_comments(), public.auto_hide_reported() (+29 more)

### Community 44 - "app/src/Badges.tsx"
Cohesion: 0.24
Nodes (8): BadgeToast(), s, SavedTime(), Spark(), RECOG, savedLabel(), Badge, ReaderCard

### Community 45 - "0025_regie_objectifs.sql"
Cohesion: 0.20
Nodes (14): public.ad_campaigns, public.ad_hit(), public.ad_stats, public.live_ads(), ad_impressions_at, ad_impressions_campaign, ad_impressions_device, ad_impressions_ip (+6 more)

### Community 46 - "public"
Cohesion: 0.17
Nodes (7): engine_runs_started, public.engine_runs, public.dashboard(), public.ai_spend(), public.ai_spend_history(), public.engine_status(), public.unpublish_run()

### Community 47 - "0022_reconnaissance.sql"
Cohesion: 0.10
Nodes (23): profiles_created, public.app_config(), public.badge_holders(), public.badges, public.badges_of(), public.grant_badge(), public.track(), public.user_badges (+15 more)

### Community 48 - "0013_moderation_lecteurs.sql"
Cohesion: 0.18
Nodes (8): comments_auto_suspend, comments_muted, public.audit(), public.auto_suspend(), public.guard_muted(), public.suspend_user(), public.reader_card(), public.engine_status()

### Community 51 - "restore"
Cohesion: 0.47
Nodes (6): catchReferral(), claimReferral(), cleanCode(), loadMe(), ping(), restore()

### Community 52 - "0002_roles.sql"
Cohesion: 0.47
Nodes (5): on_auth_user_created, profiles_guard, public.guard_profile(), public.handle_new_user(), public.is_admin()

### Community 53 - "Topics.tsx"
Cohesion: 0.11
Nodes (33): deviceId(), articleTopics(), DEMO_LIST, DEMO_WORDS, demoHas(), demoRead(), demoState(), demoTimeline() (+25 more)

### Community 62 - "account.ts"
Cohesion: 0.11
Nodes (25): accountsOn, ago(), api(), blockAuthor(), colorOf(), COLORS, currentMe(), deleteComment() (+17 more)

### Community 63 - "feel.ts"
Cohesion: 0.25
Nodes (5): Haptic, players, prefs, Sound, SOURCES

### Community 64 - "src/tdm.ts"
Cohesion: 0.43
Nodes (6): AI_BOTS, aiBotsBlocked(), aiRefusal(), get(), tdmReserved(), b

## Knowledge Gaps
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Api` connect `Api` to `src/App.tsx`, `data.ts`, `admin/src/Premium.tsx`, `Ads.tsx`, `Brand.tsx`, `app/src/Premium.tsx`, `Algo.tsx`, `admin/src/Badges.tsx`, `Referral.tsx`, `Follow.tsx`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Should `src/App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07103825136612021 - nodes in this community are weakly interconnected._
- **Why does `auth.users` connect `public.profiles` to `public.app_settings`, `0025_regie_objectifs.sql`, `public`, `0022_reconnaissance.sql`, `0013_moderation_lecteurs.sql`, `0002_roles.sql`, `public.articles`, `anon`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Should `data.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04519774011299435 - nodes in this community are weakly interconnected._
- **Why does `public.profiles` connect `public.profiles` to `public.app_settings`, `0022_reconnaissance.sql`, `0013_moderation_lecteurs.sql`, `0002_roles.sql`, `public.articles`, `anon`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Should `Api` be split into smaller, more focused modules?**
  _Cohesion score 0.038461538461538464 - nodes in this community are weakly interconnected._
- **Should `admin/src/Premium.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07575757575757576 - nodes in this community are weakly interconnected._