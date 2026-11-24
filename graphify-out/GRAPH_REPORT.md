# Graph Report - AppRun  (2026-11-24)

## Corpus Check
- 116 files · ~136,816 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: (none) 4, .xml 4, .example 3)

## Summary
- 1308 nodes · 3161 edges · 66 communities (50 shown, 16 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `300acefe`
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
- public.dispatch_workflow
- Sheets.tsx
- edition.ts
- remote.ts
- admin/src/Badges.tsx
- Essayer TITRE en vrai (environ 15 minutes)
- flash.ts
- 0015_algorithme.sql
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
- public.articles
- setup-sql.sh
- run-local.sh
- Account.tsx
- 0025_regie_objectifs.sql
- 0009_moderation_gestion.sql
- 0023_parrainage.sql
- auth.users
- ads.ts
- q
- algo.ts
- 0002_roles.sql
- Topics.tsx
- algo.sql
- follow.sql
- Main
- feel.ts
- src/tdm.ts

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
- `public.is_admin()` --reads_from--> `public.profiles`  [EXTRACTED]
  backend/supabase/migrations/0002_roles.sql → backend/supabase/migrations/0001_init.sql
- `public.handle_new_user()` --writes_to--> `public.profiles`  [EXTRACTED]
  backend/supabase/migrations/0005_settings.sql → backend/supabase/migrations/0001_init.sql
- `public.needs_admin()` --reads_from--> `public.profiles`  [EXTRACTED]
  backend/supabase/migrations/0005_settings.sql → backend/supabase/migrations/0001_init.sql
- `profiles_pseudo_lower` --indexes--> `public.profiles`  [EXTRACTED]
  backend/supabase/migrations/0006_community.sql → backend/supabase/migrations/0001_init.sql
- `public.pseudo_free()` --reads_from--> `public.profiles`  [EXTRACTED]
  backend/supabase/migrations/0006_community.sql → backend/supabase/migrations/0001_init.sql

## Import Cycles
- 2-file cycle: `admin/src/data.ts -> admin/src/demo.ts -> admin/src/data.ts`

## Communities (66 total, 16 thin omitted)

### Community 0 - "public.engine_runs"
Cohesion: 0.40
Nodes (4): engine_runs_started, public.engine_runs, public.has_insult(), public.moderation_cost()

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
Cohesion: 0.10
Nodes (25): apply(), applyRules(), applyShare(), bootBrand(), BRAND, Config, DEF, fetchConfig() (+17 more)

### Community 8 - "topics.ts"
Cohesion: 0.13
Nodes (13): DEMO_LIST, DEMO_WORDS, demoHas(), demoTimeline(), Followed, Listener, listeners, norm() (+5 more)

### Community 9 - "Brand.tsx"
Cohesion: 0.09
Nodes (33): Brand, BrandPage(), COLORS, FONT_CSS, FONTS, FORMATS, HOURS, Identity() (+25 more)

### Community 10 - "config.ts"
Cohesion: 0.21
Nodes (5): usage, cfg, Row, fmt(), pauseMessage()

### Community 11 - "account.ts"
Cohesion: 0.06
Nodes (76): Account(), accountsOn, ago(), api(), auth(), back(), blockAuthor(), blockedCount() (+68 more)

### Community 12 - "Feed.tsx"
Cohesion: 0.16
Nodes (23): Background(), CardContent(), ColumnStack(), EmojiPicker(), FactRow(), Feed(), goRub(), releaseX() (+15 more)

### Community 13 - "Algo.tsx"
Cohesion: 0.10
Nodes (20): AlgoConf, AlgoPage(), DEFAULTS, demoReader, demoStats, demoWords, Keyword, ok() (+12 more)

### Community 14 - "Screens.tsx"
Cohesion: 0.14
Nodes (27): myReferral(), referralLink(), Invite(), plural(), s, Stat(), Bravo(), Dot() (+19 more)

### Community 15 - "run.ts"
Cohesion: 0.14
Nodes (21): minorIssue(), setRubricHints(), Story, findPhoto(), fromPexels(), fromUnsplash(), pexels(), pexelsOn() (+13 more)

### Community 16 - "public.dispatch_workflow"
Cohesion: 0.28
Nodes (4): public.dispatch_log, public.dispatch_status(), public.dispatch_workflow(), public.launch_engine()

### Community 17 - "Sheets.tsx"
Cohesion: 0.17
Nodes (23): BadgeIcons(), BadgeList(), pseudoColor(), ReaderCardView(), cap(), flashTime(), fmt(), todayLabel() (+15 more)

### Community 18 - "edition.ts"
Cohesion: 0.13
Nodes (19): pickAds(), RULES, BASE, buildColumns(), DEMO_BADGES, DEMO_READS, demoCard(), insertAds() (+11 more)

### Community 19 - "remote.ts"
Cohesion: 0.13
Nodes (19): EMOJIS, FLASHES, PHOTOS, RUBRIC_LIST, RUBRICS, AppMessage, FlashRow, get() (+11 more)

### Community 20 - "admin/src/Badges.tsx"
Cohesion: 0.11
Nodes (17): Badge, BadgeRow(), BadgesPage(), Conf, CONF, ConfPanel(), demo, demoHolders (+9 more)

### Community 21 - "Essayer TITRE en vrai (environ 15 minutes)"
Cohesion: 0.10
Nodes (17): Algorithme « Mon édition » (sans IA), Ce qui reste ouvert, Dernière minute, En local, Moteur de contenu TITRE, Sujets suivis, À brancher (une fois), 1. Supabase : créer la base et noter 3 valeurs (5 min) (+9 more)

### Community 22 - "flash.ts"
Cohesion: 0.16
Nodes (17): AiStopped, budget, Item, snapshot(), dedupe(), key(), Raw, url() (+9 more)

### Community 23 - "0015_algorithme.sql"
Cohesion: 0.07
Nodes (46): public.editions, public.rubrics, flashes_published, flashes_touch, public.flashes, algo_keywords_retag, articles_topics, _cand (+38 more)

### Community 24 - "ShareCard.tsx"
Cohesion: 0.13
Nodes (19): rubricOf(), Welcome(), Job, plain(), Result, shareArticle(), ShareCardHost(), ShareCardView() (+11 more)

### Community 25 - "src/mail.ts"
Cohesion: 0.22
Nodes (14): authPatch(), env(), main(), save(), Brand, brand(), env(), esc() (+6 more)

### Community 26 - "Règles pour Claude sur TITRE"
Cohesion: 0.40
Nodes (4): 1. Toujours le skill « ponytail », 2. Toujours la carte Graphify, 3. Rappels du projet, Règles pour Claude sur TITRE

### Community 27 - "Referral.tsx"
Cohesion: 0.16
Nodes (12): sb, Admin, Conf, CONF, ConfPanel(), date(), demo, Recent (+4 more)

### Community 28 - "headline.ts"
Cohesion: 0.20
Nodes (5): syncWidget(), WidgetProps, widget, widget, pushWidget()

### Community 29 - "Follow.tsx"
Cohesion: 0.15
Nodes (10): api, DEFAULTS, demoStats, fmt(), FollowConf, FollowPage(), ok(), real() (+2 more)

### Community 30 - "public.profiles"
Cohesion: 0.11
Nodes (37): public.profiles, public.admin_audit(), public.delete_user(), public.set_banned(), public.set_banned(), public.suspend_user(), promo_attempts_user, public.admin_grant_premium() (+29 more)

### Community 31 - "collect.ts"
Cohesion: 0.18
Nodes (14): collect(), collectAll(), CollectResult, slug(), Source, arr(), clean(), FeedItem (+6 more)

### Community 32 - "À faire une fois (environ 1 heure, hors délais de validation Apple et Google)"
Cohesion: 0.22
Nodes (8): 1. Les stores, 2. RevenueCat (gratuit jusqu'à 2 500 $ de revenus par mois), 3. Le webhook (RevenueCat prévient la base), 4. L'app, Bon à savoir, Ce qui est déjà fait dans le code, TITRE Premium : mettre en route les abonnements, À faire une fois (environ 1 heure, hors délais de validation Apple et Google)

### Community 33 - "public.app_settings"
Cohesion: 0.08
Nodes (26): public.admin_settings(), public.app_settings, public.handle_new_user(), public.needs_admin(), public.set_setting(), public.set_setting(), public.set_setting(), public.has_insult() (+18 more)

### Community 34 - "app/App.tsx"
Cohesion: 0.18
Nodes (9): AccountAsk, App(), framed(), Overlay, Phase, useFrame(), initFeel(), OnbResult (+1 more)

### Community 35 - "Back office TITRE"
Cohesion: 0.33
Nodes (5): Back office TITRE, Ce qu'on y fait, En local, Mettre en ligne (gratuit, GitHub Pages), Premier accès

### Community 36 - "TITRE : essayer l'app sur iPhone"
Cohesion: 0.33
Nodes (5): Ce qu'il faut, Lancer (5 minutes la première fois), Le widget « Titre du jour » (écran d'accueil), TITRE : essayer l'app sur iPhone, À essayer

### Community 38 - "public.articles"
Cohesion: 0.10
Nodes (38): articles_edition, articles_touch, comments_article, public.article_stats, public.articles, public.comment_votes, public.comments, public.is_staff() (+30 more)

### Community 44 - "Account.tsx"
Cohesion: 0.13
Nodes (14): Boot(), DRAWER, Mode, styles, BadgeToast(), s, SavedTime(), Spark() (+6 more)

### Community 45 - "0025_regie_objectifs.sql"
Cohesion: 0.19
Nodes (14): public.ad_campaigns, public.ad_hit(), public.ad_stats, public.live_ads(), ad_impressions_at, ad_impressions_campaign, ad_impressions_device, ad_impressions_ip (+6 more)

### Community 46 - "0009_moderation_gestion.sql"
Cohesion: 0.10
Nodes (14): articles_audit, audit_log_at, comments_audit, flashes_audit, profiles_audit, public.audit(), public.audit_log, public.dashboard() (+6 more)

### Community 47 - "0023_parrainage.sql"
Cohesion: 0.15
Nodes (11): on_auth_user_referral, public.check_referral(), public.claim_referral(), public.link_referral(), public.my_referral(), public.referral_codes, public.referral_from_signup(), public.referrals (+3 more)

### Community 48 - "auth.users"
Cohesion: 0.18
Nodes (17): public.reports, public.admin_users(), public.visits, public.admin_users(), public.reset_pseudo(), profiles_created, public.badge_holders(), public.badges (+9 more)

### Community 49 - "ads.ts"
Cohesion: 0.16
Nodes (17): adHit(), ADS, DEMO, Ev, flush(), key(), loadAds(), push() (+9 more)

### Community 50 - "q"
Cohesion: 0.26
Nodes (7): Alert, sendTopicAlerts(), pool, q(), startJournal(), DIR, migrate()

### Community 51 - "algo.ts"
Cohesion: 0.24
Nodes (11): fetchPicks(), deviceId(), ping(), rpc(), flush(), loadMyEdition(), Pick, queue (+3 more)

### Community 52 - "0002_roles.sql"
Cohesion: 0.47
Nodes (5): on_auth_user_created, profiles_guard, public.guard_profile(), public.handle_new_user(), public.is_admin()

### Community 53 - "Topics.tsx"
Cohesion: 0.23
Nodes (18): articleTopics(), demoRead(), demoState(), DRAWER, emit(), follow(), FollowRow(), loadTimeline() (+10 more)

### Community 62 - "Main"
Cohesion: 0.15
Nodes (21): editionSig(), Main(), pickDevice(), pickSaved(), currentMe(), getLocal(), isLive(), myEmojis() (+13 more)

### Community 63 - "feel.ts"
Cohesion: 0.25
Nodes (5): Haptic, players, prefs, Sound, SOURCES

### Community 64 - "src/tdm.ts"
Cohesion: 0.43
Nodes (6): AI_BOTS, aiBotsBlocked(), aiRefusal(), get(), tdmReserved(), b

## Knowledge Gaps
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Api` connect `Api` to `src/App.tsx`, `data.ts`, `admin/src/Premium.tsx`, `Ads.tsx`, `Brand.tsx`, `account.ts`, `Algo.tsx`, `admin/src/Badges.tsx`, `Referral.tsx`, `Follow.tsx`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Should `src/App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06646825396825397 - nodes in this community are weakly interconnected._
- **Why does `auth.users` connect `auth.users` to `public.app_settings`, `public.articles`, `0025_regie_objectifs.sql`, `0009_moderation_gestion.sql`, `0023_parrainage.sql`, `0002_roles.sql`, `0015_algorithme.sql`, `public.profiles`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Should `data.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04576271186440678 - nodes in this community are weakly interconnected._
- **Why does `Main()` connect `Main` to `app/App.tsx`, `brand.ts`, `topics.ts`, `account.ts`, `Account.tsx`, `Feed.tsx`, `Screens.tsx`, `ads.ts`, `edition.ts`, `algo.ts`, `remote.ts`, `Sheets.tsx`, `Topics.tsx`, `ShareCard.tsx`, `headline.ts`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Should `Api` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `admin/src/Premium.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07575757575757576 - nodes in this community are weakly interconnected._