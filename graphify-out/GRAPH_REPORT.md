# Graph Report - AppRun  (2026-11-23)

## Corpus Check
- 113 files · ~136,008 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: (none) 4, .xml 4, .example 3)

## Summary
- 1299 nodes · 3147 edges · 66 communities (50 shown, 16 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `81860c15`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- public.engine_runs
- src/App.tsx
- data.ts
- Api
- admin/src/Premium.tsx
- ai.ts
- Ads.tsx
- brand.ts
- topics.ts
- Brand.tsx
- config.ts
- account.ts
- Feed.tsx
- Algo.tsx
- Screens.tsx
- run.ts
- 0024_sujets_suivis.sql
- Sheets.tsx
- edition.ts
- remote.ts
- admin/src/Badges.tsx
- Essayer TITRE en vrai (environ 15 minutes)
- flash.ts
- public.articles
- ShareCard.tsx
- src/mail.ts
- Règles pour Claude sur TITRE
- Referral.tsx
- headline.ts
- Follow.tsx
- public.profiles
- collect.ts
- À faire une fois (environ 1 heure, hors délais de validation Apple et Google)
- public.app_settings
- app/App.tsx
- Back office TITRE
- TITRE : essayer l'app sur iPhone
- public.comments
- setup-sql.sh
- run-local.sh
- app/src/Premium.tsx
- 0025_regie_objectifs.sql
- 0009_moderation_gestion.sql
- 0023_parrainage.sql
- 0022_reconnaissance.sql
- ads.ts
- q
- algo.ts
- 0002_roles.sql
- Topics.tsx
- algo.sql
- follow.sql
- notify.ts
- feel.ts
- dates.ts

## God Nodes (most connected - your core abstractions)
1. `Main()` - 68 edges
2. `Api` - 62 edges
3. `public.profiles` - 56 edges
4. `public.articles` - 44 edges
5. `public.comments` - 36 edges
6. `auth.users` - 36 edges
7. `feel()` - 31 edges
8. `public.app_settings` - 27 edges
9. `App()` - 25 edges
10. `Account()` - 23 edges

## Surprising Connections (you probably didn't know these)
- `releaseY()` --calls--> `feel()`  [EXTRACTED]
  app/src/Feed.tsx → app/src/feel.ts
- `public.is_admin()` --reads_from--> `public.profiles`  [EXTRACTED]
  backend/supabase/migrations/0002_roles.sql → backend/supabase/migrations/0001_init.sql
- `public.handle_new_user()` --writes_to--> `public.profiles`  [EXTRACTED]
  backend/supabase/migrations/0005_settings.sql → backend/supabase/migrations/0001_init.sql
- `public.needs_admin()` --reads_from--> `public.profiles`  [EXTRACTED]
  backend/supabase/migrations/0005_settings.sql → backend/supabase/migrations/0001_init.sql
- `profiles_pseudo_lower` --indexes--> `public.profiles`  [EXTRACTED]
  backend/supabase/migrations/0006_community.sql → backend/supabase/migrations/0001_init.sql

## Import Cycles
- 2-file cycle: `admin/src/data.ts -> admin/src/demo.ts -> admin/src/data.ts`

## Communities (66 total, 16 thin omitted)

### Community 0 - "public.engine_runs"
Cohesion: 0.40
Nodes (4): engine_runs_started, public.engine_runs, public.moderation_cost(), public.ai_spend()

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
Nodes (38): api(), CardOut, CardSchema, checkCard(), checkFlash(), clamp(), cleanStories(), cost() (+30 more)

### Community 6 - "Ads.tsx"
Cohesion: 0.09
Nodes (32): AdsPage(), Campaign, CampaignForm(), days(), dayShift(), demoList, demoStats, Draft (+24 more)

### Community 7 - "brand.ts"
Cohesion: 0.12
Nodes (15): Boot(), apply(), applyRules(), applyShare(), bootBrand(), Config, DEF, fetchConfig() (+7 more)

### Community 8 - "topics.ts"
Cohesion: 0.13
Nodes (18): DEMO_LIST, DEMO_WORDS, demoHas(), demoRead(), demoState(), demoTimeline(), emit(), follow() (+10 more)

### Community 9 - "Brand.tsx"
Cohesion: 0.09
Nodes (33): Brand, BrandPage(), COLORS, FONT_CSS, FONTS, FORMATS, HOURS, Identity() (+25 more)

### Community 10 - "config.ts"
Cohesion: 0.21
Nodes (5): usage, cfg, Row, fmt(), pauseMessage()

### Community 11 - "account.ts"
Cohesion: 0.05
Nodes (86): Main(), Account(), accountsOn, ago(), api(), auth(), back(), blockAuthor() (+78 more)

### Community 12 - "Feed.tsx"
Cohesion: 0.15
Nodes (29): flashTime(), rubricOf(), Background(), CardContent(), ColumnStack(), EmojiPicker(), FactRow(), Feed() (+21 more)

### Community 13 - "Algo.tsx"
Cohesion: 0.09
Nodes (21): AlgoConf, AlgoPage(), DEFAULTS, demoReader, demoStats, demoWords, Keyword, ok() (+13 more)

### Community 14 - "Screens.tsx"
Cohesion: 0.18
Nodes (26): feel(), Bravo(), Dot(), DRAWER, End(), fmt(), fmtMin(), fmtTime() (+18 more)

### Community 15 - "run.ts"
Cohesion: 0.14
Nodes (21): minorIssue(), setRubricHints(), Story, findPhoto(), fromPexels(), fromUnsplash(), pexels(), pexelsOn() (+13 more)

### Community 16 - "0024_sujets_suivis.sql"
Cohesion: 0.14
Nodes (21): flashes_published, flashes_touch, public.flashes, algo_keywords_retag_flashes, flashes_tag, public.drop_push(), public.follow_stats(), public.push_devices (+13 more)

### Community 17 - "Sheets.tsx"
Cohesion: 0.20
Nodes (15): BadgeIcons(), BadgeList(), BadgeToast(), pseudoColor(), ReaderCardView(), s, SavedTime(), Spark() (+7 more)

### Community 18 - "edition.ts"
Cohesion: 0.12
Nodes (19): pickAds(), BASE, buildColumns(), DEMO_BADGES, DEMO_READS, demoCard(), insertAds(), MEDIA (+11 more)

### Community 19 - "remote.ts"
Cohesion: 0.13
Nodes (19): EMOJIS, FLASHES, PHOTOS, RUBRIC_LIST, RUBRICS, AppMessage, FlashRow, get() (+11 more)

### Community 20 - "admin/src/Badges.tsx"
Cohesion: 0.12
Nodes (16): Badge, BadgeRow(), BadgesPage(), Conf, CONF, ConfPanel(), demo, demoHolders (+8 more)

### Community 21 - "Essayer TITRE en vrai (environ 15 minutes)"
Cohesion: 0.10
Nodes (17): Algorithme « Mon édition » (sans IA), Ce qui reste ouvert, Dernière minute, En local, Moteur de contenu TITRE, Sujets suivis, À brancher (une fois), 1. Supabase : créer la base et noter 3 valeurs (5 min) (+9 more)

### Community 22 - "flash.ts"
Cohesion: 0.16
Nodes (17): AiStopped, budget, Item, snapshot(), dedupe(), key(), Raw, url() (+9 more)

### Community 23 - "public.articles"
Cohesion: 0.10
Nodes (40): articles_edition, articles_touch, public.article_stats, public.articles, public.editions, public.raw_items, public.reactions, public.rubrics (+32 more)

### Community 24 - "ShareCard.tsx"
Cohesion: 0.20
Nodes (13): Job, plain(), Result, shareArticle(), ShareCardHost(), ShareCardView(), shareLink(), shareOnWeb() (+5 more)

### Community 25 - "src/mail.ts"
Cohesion: 0.22
Nodes (14): authPatch(), env(), main(), save(), Brand, brand(), env(), esc() (+6 more)

### Community 26 - "Règles pour Claude sur TITRE"
Cohesion: 0.40
Nodes (4): 1. Toujours le skill « ponytail », 2. Toujours la carte Graphify, 3. Rappels du projet, Règles pour Claude sur TITRE

### Community 27 - "Referral.tsx"
Cohesion: 0.15
Nodes (13): api, sb, Admin, Conf, CONF, ConfPanel(), date(), demo (+5 more)

### Community 28 - "headline.ts"
Cohesion: 0.20
Nodes (5): syncWidget(), WidgetProps, widget, widget, pushWidget()

### Community 29 - "Follow.tsx"
Cohesion: 0.16
Nodes (9): DEFAULTS, demoStats, fmt(), FollowConf, FollowPage(), ok(), real(), Stats (+1 more)

### Community 30 - "public.profiles"
Cohesion: 0.12
Nodes (32): public.is_staff(), public.profiles, public.suspend_user(), promo_attempts_user, public.admin_grant_premium(), public.admin_revoke_premium(), public.admin_sub_events(), public.admin_subscribers() (+24 more)

### Community 31 - "collect.ts"
Cohesion: 0.18
Nodes (14): collect(), collectAll(), CollectResult, slug(), Source, arr(), clean(), FeedItem (+6 more)

### Community 32 - "À faire une fois (environ 1 heure, hors délais de validation Apple et Google)"
Cohesion: 0.22
Nodes (8): 1. Les stores, 2. RevenueCat (gratuit jusqu'à 2 500 $ de revenus par mois), 3. Le webhook (RevenueCat prévient la base), 4. L'app, Bon à savoir, Ce qui est déjà fait dans le code, TITRE Premium : mettre en route les abonnements, À faire une fois (environ 1 heure, hors délais de validation Apple et Google)

### Community 33 - "public.app_settings"
Cohesion: 0.06
Nodes (30): public.admin_settings(), public.app_settings, public.handle_new_user(), public.needs_admin(), public.set_setting(), public.set_setting(), public.set_setting(), public.has_insult() (+22 more)

### Community 34 - "app/App.tsx"
Cohesion: 0.13
Nodes (13): AccountAsk, App(), editionSig(), framed(), Overlay, Phase, pickDevice(), pickSaved() (+5 more)

### Community 35 - "Back office TITRE"
Cohesion: 0.33
Nodes (5): Back office TITRE, Ce qu'on y fait, En local, Mettre en ligne (gratuit, GitHub Pages), Premier accès

### Community 36 - "TITRE : essayer l'app sur iPhone"
Cohesion: 0.33
Nodes (5): Ce qu'il faut, Lancer (5 minutes la première fois), Le widget « Titre du jour » (écran d'accueil), TITRE : essayer l'app sur iPhone, À essayer

### Community 38 - "public.comments"
Cohesion: 0.10
Nodes (30): comments_article, public.comments, public.reports, comments_guard, profiles_pseudo_lower, public.article_comments(), public.auto_hide_reported(), public.guard_comment() (+22 more)

### Community 44 - "app/src/Premium.tsx"
Cohesion: 0.09
Nodes (25): BRAND, RULES, TEXTS, s, DEMO_PLANS, DRAWER, PER, SOURCE (+17 more)

### Community 45 - "0025_regie_objectifs.sql"
Cohesion: 0.20
Nodes (14): public.ad_campaigns, public.ad_hit(), public.ad_stats, public.live_ads(), ad_impressions_at, ad_impressions_campaign, ad_impressions_device, ad_impressions_ip (+6 more)

### Community 46 - "0009_moderation_gestion.sql"
Cohesion: 0.10
Nodes (16): articles_audit, audit_log_at, comments_audit, flashes_audit, profiles_audit, public.admin_audit(), public.audit(), public.audit_log (+8 more)

### Community 47 - "0023_parrainage.sql"
Cohesion: 0.14
Nodes (13): public.user_reads, on_auth_user_referral, public.check_referral(), public.claim_referral(), public.link_referral(), public.my_referral(), public.referral_admin(), public.referral_codes (+5 more)

### Community 48 - "0022_reconnaissance.sql"
Cohesion: 0.25
Nodes (11): public.comment_votes, profiles_created, public.article_comments(), public.badge_holders(), public.badges, public.badges_of(), public.grant_badge(), public.track() (+3 more)

### Community 49 - "ads.ts"
Cohesion: 0.17
Nodes (16): adHit(), ADS, DEMO, Ev, flush(), key(), loadAds(), push() (+8 more)

### Community 50 - "q"
Cohesion: 0.26
Nodes (7): Alert, sendTopicAlerts(), pool, q(), startJournal(), DIR, migrate()

### Community 51 - "algo.ts"
Cohesion: 0.21
Nodes (13): fetchPicks(), deviceId(), isLive(), rpc(), flush(), loadMyEdition(), Pick, queue (+5 more)

### Community 52 - "0002_roles.sql"
Cohesion: 0.47
Nodes (5): on_auth_user_created, profiles_guard, public.guard_profile(), public.handle_new_user(), public.is_admin()

### Community 53 - "Topics.tsx"
Cohesion: 0.27
Nodes (13): articleTopics(), DRAWER, FollowRow(), loadTimeline(), onTopics(), styles, TimelineView(), toggleFrom() (+5 more)

### Community 62 - "notify.ts"
Cohesion: 0.36
Nodes (9): getLocal(), setLocal(), NOTIF, notifBody(), notifWanted(), parse(), schedule(), setNotif() (+1 more)

### Community 63 - "feel.ts"
Cohesion: 0.25
Nodes (5): Haptic, players, prefs, Sound, SOURCES

### Community 64 - "dates.ts"
Cohesion: 0.60
Nodes (5): cap(), fmt(), todayLabel(), tomorrowLabel(), yearLabel()

## Knowledge Gaps
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Api` connect `Api` to `src/App.tsx`, `data.ts`, `admin/src/Premium.tsx`, `Ads.tsx`, `Brand.tsx`, `account.ts`, `Algo.tsx`, `admin/src/Badges.tsx`, `Referral.tsx`, `Follow.tsx`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Should `src/App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07103825136612021 - nodes in this community are weakly interconnected._
- **Why does `auth.users` connect `public.comments` to `public.app_settings`, `0025_regie_objectifs.sql`, `0009_moderation_gestion.sql`, `0023_parrainage.sql`, `0022_reconnaissance.sql`, `0024_sujets_suivis.sql`, `0002_roles.sql`, `public.articles`, `public.profiles`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Should `data.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04576271186440678 - nodes in this community are weakly interconnected._
- **Why does `public.app_settings` connect `public.app_settings` to `0009_moderation_gestion.sql`, `public.comments`, `public.profiles`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Should `Api` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `admin/src/Premium.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07575757575757576 - nodes in this community are weakly interconnected._