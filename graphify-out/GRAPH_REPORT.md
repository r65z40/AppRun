# Graph Report - apprun  (2026-11-23)

## Corpus Check
- 111 files · ~134,281 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: .xml 4, (none) 3, .example 3)

## Summary
- 1287 nodes · 3128 edges · 62 communities (46 shown, 16 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3024bb27`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- account.ts
- src/App.tsx
- data.ts
- Api
- admin/src/Premium.tsx
- ai.ts
- Ads.tsx
- brand.ts
- Topics.tsx
- Brand.tsx
- Main
- app/src/Premium.tsx
- Feed.tsx
- Algo.tsx
- Screens.tsx
- run.ts
- q
- Topics.tsx
- edition.ts
- remote.ts
- admin/src/Badges.tsx
- Essayer TITRE en vrai (environ 15 minutes)
- flash.ts
- public.articles
- ShareCard.tsx
- src/mail.ts
- ads.ts
- Referral.tsx
- headline.ts
- Follow.tsx
- anon
- rss.ts
- À faire une fois (environ 1 heure, hors délais de validation Apple et Google)
- public.app_settings
- feel.ts
- Back office TITRE
- TITRE : essayer l'app sur iPhone
- public.profiles
- setup-sql.sh
- run-local.sh
- Account.tsx
- 0025_regie_objectifs.sql
- 0009_moderation_gestion.sql
- 0023_parrainage.sql
- 0022_reconnaissance.sql
- algo.ts
- 0013_moderation_lecteurs.sql
- notify.ts
- 0002_roles.sql
- public.dashboard
- algo.sql
- follow.sql

## God Nodes (most connected - your core abstractions)
1. `Main()` - 68 edges
2. `Api` - 61 edges
3. `public.profiles` - 56 edges
4. `public.articles` - 44 edges
5. `public.comments` - 36 edges
6. `auth.users` - 36 edges
7. `feel()` - 31 edges
8. `public.app_settings` - 26 edges
9. `App()` - 25 edges
10. `Account()` - 23 edges

## Surprising Connections (you probably didn't know these)
- `public.is_admin()` --reads_from--> `public.profiles`  [EXTRACTED]
  backend/supabase/migrations/0002_roles.sql → backend/supabase/migrations/0001_init.sql
- `public.handle_new_user()` --writes_to--> `public.profiles`  [EXTRACTED]
  backend/supabase/migrations/0005_settings.sql → backend/supabase/migrations/0001_init.sql
- `public.needs_admin()` --reads_from--> `public.profiles`  [EXTRACTED]
  backend/supabase/migrations/0005_settings.sql → backend/supabase/migrations/0001_init.sql
- `public.is_moderator()` --reads_from--> `public.profiles`  [EXTRACTED]
  backend/supabase/migrations/0009_moderation_gestion.sql → backend/supabase/migrations/0001_init.sql
- `public.has_insult()` --reads_from--> `public.app_settings`  [EXTRACTED]
  backend/supabase/migrations/0009_moderation_gestion.sql → backend/supabase/migrations/0005_settings.sql

## Import Cycles
- 2-file cycle: `admin/src/data.ts -> admin/src/demo.ts -> admin/src/data.ts`

## Communities (62 total, 16 thin omitted)

### Community 0 - "account.ts"
Cohesion: 0.13
Nodes (26): accountsOn, ago(), auth(), back(), catchReferral(), cleanCode(), colorOf(), COLORS (+18 more)

### Community 1 - "src/App.tsx"
Cohesion: 0.07
Nodes (56): ReaderTaste(), ADMIN_ONLY, ago(), AI_TABS, AIPage(), AITab, allowed(), App() (+48 more)

### Community 2 - "data.ts"
Cohesion: 0.05
Nodes (54): AppMessage, Article, Audience, AUDIENCES, AuditEntry, Comment, Dashboard, Edition (+46 more)

### Community 4 - "admin/src/Premium.tsx"
Cohesion: 0.08
Nodes (31): Codes(), FILTERS, live(), ok(), Period, PERIOD, Plan, PremiumApi (+23 more)

### Community 5 - "ai.ts"
Cohesion: 0.09
Nodes (34): api(), CardOut, CardSchema, checkCard(), checkFlash(), clamp(), cleanStories(), EFFORT() (+26 more)

### Community 6 - "Ads.tsx"
Cohesion: 0.09
Nodes (32): AdsPage(), Campaign, CampaignForm(), days(), dayShift(), demoList, demoStats, Draft (+24 more)

### Community 7 - "brand.ts"
Cohesion: 0.09
Nodes (26): apply(), applyRules(), applyShare(), bootBrand(), Config, DEF, fetchConfig(), FONTS (+18 more)

### Community 8 - "Topics.tsx"
Cohesion: 0.13
Nodes (20): articleTopics(), DEMO_LIST, DEMO_WORDS, demoHas(), demoRead(), demoState(), demoTimeline(), emit() (+12 more)

### Community 9 - "Brand.tsx"
Cohesion: 0.09
Nodes (33): Brand, BrandPage(), COLORS, FONT_CSS, FONTS, FORMATS, HOURS, Identity() (+25 more)

### Community 10 - "Main"
Cohesion: 0.13
Nodes (22): editionSig(), Main(), pickDevice(), pickSaved(), api(), blockAuthor(), currentMe(), deleteComment() (+14 more)

### Community 11 - "app/src/Premium.tsx"
Cohesion: 0.12
Nodes (27): isPremium(), loadPlans(), MySub, mySubscription(), Plan, reloadMe(), day(), DEMO_PLANS (+19 more)

### Community 12 - "Feed.tsx"
Cohesion: 0.13
Nodes (37): BadgeIcons(), flashTime(), summaryOf(), Background(), CardContent(), ColumnStack(), EmojiPicker(), FactRow() (+29 more)

### Community 13 - "Algo.tsx"
Cohesion: 0.10
Nodes (20): AlgoConf, AlgoPage(), DEFAULTS, demoReader, demoStats, demoWords, Keyword, ok() (+12 more)

### Community 14 - "Screens.tsx"
Cohesion: 0.12
Nodes (31): cap(), fmt(), todayLabel(), tomorrowLabel(), yearLabel(), Bravo(), Dot(), DRAWER (+23 more)

### Community 15 - "run.ts"
Cohesion: 0.13
Nodes (23): Story, dedupe(), key(), Raw, url(), Journal, findPhoto(), fromPexels() (+15 more)

### Community 16 - "q"
Cohesion: 0.33
Nodes (5): pool, q(), startJournal(), DIR, migrate()

### Community 17 - "Topics.tsx"
Cohesion: 0.23
Nodes (13): GRAD, DRAWER, FollowRow(), onTopics(), styles, TimelineView(), toggleFrom(), TopicList() (+5 more)

### Community 18 - "edition.ts"
Cohesion: 0.11
Nodes (26): pickAds(), BadgeList(), BadgeToast(), pseudoColor(), ReaderCardView(), s, SavedTime(), Spark() (+18 more)

### Community 19 - "remote.ts"
Cohesion: 0.09
Nodes (28): AccountAsk, App(), framed(), Overlay, Phase, useFrame(), Signal, EMOJIS (+20 more)

### Community 20 - "admin/src/Badges.tsx"
Cohesion: 0.11
Nodes (17): Badge, BadgeRow(), BadgesPage(), Conf, CONF, ConfPanel(), demo, demoHolders (+9 more)

### Community 21 - "Essayer TITRE en vrai (environ 15 minutes)"
Cohesion: 0.10
Nodes (17): Algorithme « Mon édition » (sans IA), Ce qui reste ouvert, Dernière minute, En local, Moteur de contenu TITRE, Sujets suivis, À brancher (une fois), 1. Supabase : créer la base et noter 3 valeurs (5 min) (+9 more)

### Community 22 - "flash.ts"
Cohesion: 0.11
Nodes (23): AiStopped, budget, cost(), Item, judgeComments(), model(), setRubricHints(), usage (+15 more)

### Community 23 - "public.articles"
Cohesion: 0.06
Nodes (66): articles_edition, articles_touch, comments_article, public.article_stats, public.articles, public.editions, public.is_staff(), public.raw_items (+58 more)

### Community 24 - "ShareCard.tsx"
Cohesion: 0.10
Nodes (21): Boot(), BRAND, rubricOf(), Job, plain(), Result, shareArticle(), ShareCardHost() (+13 more)

### Community 25 - "src/mail.ts"
Cohesion: 0.22
Nodes (14): authPatch(), env(), main(), save(), Brand, brand(), env(), esc() (+6 more)

### Community 26 - "ads.ts"
Cohesion: 0.17
Nodes (16): adHit(), ADS, DEMO, Ev, flush(), key(), loadAds(), push() (+8 more)

### Community 27 - "Referral.tsx"
Cohesion: 0.16
Nodes (12): sb, Admin, Conf, CONF, ConfPanel(), date(), demo, Recent (+4 more)

### Community 28 - "headline.ts"
Cohesion: 0.20
Nodes (5): syncWidget(), WidgetProps, widget, widget, pushWidget()

### Community 29 - "Follow.tsx"
Cohesion: 0.15
Nodes (10): api, DEFAULTS, demoStats, fmt(), FollowConf, FollowPage(), ok(), real() (+2 more)

### Community 30 - "anon"
Cohesion: 0.10
Nodes (32): promo_attempts_user, public.admin_grant_premium(), public.admin_revoke_premium(), public.admin_sub_events(), public.admin_subscribers(), public.apply_store_event(), public.expire_premium(), public.give_days() (+24 more)

### Community 31 - "rss.ts"
Cohesion: 0.18
Nodes (14): collect(), collectAll(), CollectResult, slug(), Source, arr(), clean(), FeedItem (+6 more)

### Community 32 - "À faire une fois (environ 1 heure, hors délais de validation Apple et Google)"
Cohesion: 0.22
Nodes (8): 1. Les stores, 2. RevenueCat (gratuit jusqu'à 2 500 $ de revenus par mois), 3. Le webhook (RevenueCat prévient la base), 4. L'app, Bon à savoir, Ce qui est déjà fait dans le code, TITRE Premium : mettre en route les abonnements, À faire une fois (environ 1 heure, hors délais de validation Apple et Google)

### Community 33 - "public.app_settings"
Cohesion: 0.07
Nodes (26): engine_runs_started, public.engine_runs, public.admin_settings(), public.app_settings, public.handle_new_user(), public.needs_admin(), public.set_setting(), public.set_setting() (+18 more)

### Community 34 - "feel.ts"
Cohesion: 0.25
Nodes (5): Haptic, players, prefs, Sound, SOURCES

### Community 35 - "Back office TITRE"
Cohesion: 0.33
Nodes (5): Back office TITRE, Ce qu'on y fait, En local, Mettre en ligne (gratuit, GitHub Pages), Premier accès

### Community 36 - "TITRE : essayer l'app sur iPhone"
Cohesion: 0.33
Nodes (5): Ce qu'il faut, Lancer (5 minutes la première fois), Le widget « Titre du jour » (écran d'accueil), TITRE : essayer l'app sur iPhone, À essayer

### Community 38 - "public.profiles"
Cohesion: 0.15
Nodes (29): public.comment_votes, public.comments, public.profiles, public.reports, comments_guard, profiles_pseudo_lower, public.article_comments(), public.auto_hide_reported() (+21 more)

### Community 44 - "Account.tsx"
Cohesion: 0.15
Nodes (23): Account(), blockedCount(), claimReferral(), DRAWER, emit(), Field(), Mode, myReferral() (+15 more)

### Community 45 - "0025_regie_objectifs.sql"
Cohesion: 0.19
Nodes (14): public.ad_campaigns, public.ad_hit(), public.ad_stats, public.live_ads(), ad_impressions_at, ad_impressions_campaign, ad_impressions_device, ad_impressions_ip (+6 more)

### Community 46 - "0009_moderation_gestion.sql"
Cohesion: 0.16
Nodes (14): articles_audit, audit_log_at, comments_audit, flashes_audit, profiles_audit, public.admin_audit(), public.audit(), public.audit_log (+6 more)

### Community 47 - "0023_parrainage.sql"
Cohesion: 0.18
Nodes (10): on_auth_user_referral, public.link_referral(), public.my_referral(), public.referral_admin(), public.referral_codes, public.referral_from_signup(), public.referrals, public.user_reads_referral() (+2 more)

### Community 48 - "0022_reconnaissance.sql"
Cohesion: 0.24
Nodes (10): public.badge_holders(), public.badges, public.badges_of(), public.grant_badge(), public.reader_card(), public.track(), public.user_badges, public.user_reads (+2 more)

### Community 49 - "algo.ts"
Cohesion: 0.27
Nodes (10): fetchPicks(), deviceId(), ping(), rpc(), flush(), loadMyEdition(), Pick, queue (+2 more)

### Community 50 - "0013_moderation_lecteurs.sql"
Cohesion: 0.27
Nodes (8): comments_auto_suspend, comments_muted, public.audit(), public.auto_suspend(), public.guard_muted(), public.set_setting(), public.setting_keys, public.suspend_user()

### Community 51 - "notify.ts"
Cohesion: 0.42
Nodes (8): getLocal(), setLocal(), notifBody(), notifWanted(), parse(), schedule(), setNotif(), syncNotif()

### Community 52 - "0002_roles.sql"
Cohesion: 0.47
Nodes (5): on_auth_user_created, profiles_guard, public.guard_profile(), public.handle_new_user(), public.is_admin()

## Knowledge Gaps
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Api` connect `Api` to `src/App.tsx`, `data.ts`, `admin/src/Premium.tsx`, `Ads.tsx`, `Brand.tsx`, `Account.tsx`, `Algo.tsx`, `admin/src/Badges.tsx`, `Referral.tsx`, `Follow.tsx`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Should `account.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1349206349206349 - nodes in this community are weakly interconnected._
- **Why does `auth.users` connect `public.profiles` to `public.app_settings`, `0025_regie_objectifs.sql`, `0009_moderation_gestion.sql`, `0023_parrainage.sql`, `0022_reconnaissance.sql`, `0002_roles.sql`, `public.articles`, `anon`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Should `src/App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06597222222222222 - nodes in this community are weakly interconnected._
- **Why does `PremiumApi` connect `admin/src/Premium.tsx` to `src/App.tsx`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Should `data.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.046756282875511396 - nodes in this community are weakly interconnected._
- **Should `Api` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._