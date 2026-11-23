# Graph Report - AppRun  (2026-11-23)

## Corpus Check
- 112 files · ~134,780 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: (none) 4, .xml 4, .example 3)

## Summary
- 1293 nodes · 3135 edges · 58 communities (43 shown, 15 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8767dba9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- anon
- src/App.tsx
- data.ts
- Api
- admin/src/Premium.tsx
- ai.ts
- Ads.tsx
- brand.ts
- Topics.tsx
- Brand.tsx
- config.ts
- account.ts
- Feed.tsx
- Algo.tsx
- Screens.tsx
- pexels.ts
- public.dispatch_workflow
- Sheets.tsx
- edition.ts
- app/App.tsx
- admin/src/Badges.tsx
- Essayer TITRE en vrai (environ 15 minutes)
- run.ts
- public.articles
- ShareCard.tsx
- src/mail.ts
- Règles pour Claude sur TITRE
- Referral.tsx
- headline.ts
- Follow.tsx
- 0014_premium.sql
- q
- À faire une fois (environ 1 heure, hors délais de validation Apple et Google)
- public.app_settings
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
- 0013_moderation_lecteurs.sql
- 0002_roles.sql
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

## Communities (58 total, 15 thin omitted)

### Community 0 - "anon"
Cohesion: 0.19
Nodes (12): public.admin_audit(), public.delete_user(), public.set_banned(), public.set_banned(), public.suspend_user(), public.give_days(), public.sync_premium(), public.setting_json() (+4 more)

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
Nodes (38): api(), CardOut, CardSchema, checkCard(), clamp(), cleanStories(), cost(), EFFORT() (+30 more)

### Community 6 - "Ads.tsx"
Cohesion: 0.09
Nodes (32): AdsPage(), Campaign, CampaignForm(), days(), dayShift(), demoList, demoStats, Draft (+24 more)

### Community 7 - "brand.ts"
Cohesion: 0.07
Nodes (42): getLocal(), setLocal(), adHit(), ADS, DEMO, Ev, flush(), key() (+34 more)

### Community 8 - "Topics.tsx"
Cohesion: 0.10
Nodes (34): deviceId(), RUBRIC_LIST, articleTopics(), DEMO_LIST, DEMO_WORDS, demoHas(), demoRead(), demoState() (+26 more)

### Community 9 - "Brand.tsx"
Cohesion: 0.09
Nodes (33): Brand, BrandPage(), COLORS, FONT_CSS, FONTS, FORMATS, HOURS, Identity() (+25 more)

### Community 10 - "config.ts"
Cohesion: 0.28
Nodes (3): cfg, fmt(), pauseMessage()

### Community 11 - "account.ts"
Cohesion: 0.05
Nodes (87): editionSig(), Main(), pickDevice(), pickSaved(), Account(), accountsOn, ago(), api() (+79 more)

### Community 12 - "Feed.tsx"
Cohesion: 0.18
Nodes (25): flashTime(), Background(), CardContent(), ColumnStack(), EmojiPicker(), FactRow(), Feed(), goRub() (+17 more)

### Community 13 - "Algo.tsx"
Cohesion: 0.10
Nodes (20): AlgoConf, AlgoPage(), DEFAULTS, demoReader, demoStats, demoWords, Keyword, ok() (+12 more)

### Community 14 - "Screens.tsx"
Cohesion: 0.11
Nodes (33): BRAND, cap(), fmt(), todayLabel(), tomorrowLabel(), yearLabel(), Bravo(), Dot() (+25 more)

### Community 15 - "pexels.ts"
Cohesion: 0.29
Nodes (10): findPhoto(), fromPexels(), fromUnsplash(), pexels(), pexelsOn(), PickedPhoto, PPhoto, unsplash() (+2 more)

### Community 16 - "public.dispatch_workflow"
Cohesion: 0.38
Nodes (3): public.dispatch_log, public.dispatch_status(), public.dispatch_workflow()

### Community 17 - "Sheets.tsx"
Cohesion: 0.15
Nodes (23): BadgeIcons(), BadgeList(), BadgeToast(), pseudoColor(), ReaderCardView(), s, SavedTime(), Spark() (+15 more)

### Community 18 - "edition.ts"
Cohesion: 0.10
Nodes (25): pickAds(), RULES, EMOJIS, FLASHES, PHOTOS, BASE, buildColumns(), DEMO_BADGES (+17 more)

### Community 19 - "app/App.tsx"
Cohesion: 0.07
Nodes (34): AccountAsk, App(), fetchPicks(), framed(), Overlay, Phase, useFrame(), rpc() (+26 more)

### Community 20 - "admin/src/Badges.tsx"
Cohesion: 0.11
Nodes (17): Badge, BadgeRow(), BadgesPage(), Conf, CONF, ConfPanel(), demo, demoHolders (+9 more)

### Community 21 - "Essayer TITRE en vrai (environ 15 minutes)"
Cohesion: 0.10
Nodes (17): Algorithme « Mon édition » (sans IA), Ce qui reste ouvert, Dernière minute, En local, Moteur de contenu TITRE, Sujets suivis, À brancher (une fois), 1. Supabase : créer la base et noter 3 valeurs (5 min) (+9 more)

### Community 22 - "run.ts"
Cohesion: 0.11
Nodes (32): AiStopped, budget, checkFlash(), Item, minorIssue(), setRubricHints(), Story, usage (+24 more)

### Community 23 - "public.articles"
Cohesion: 0.06
Nodes (65): articles_edition, articles_touch, comments_article, public.article_stats, public.articles, public.editions, public.is_staff(), public.raw_items (+57 more)

### Community 24 - "ShareCard.tsx"
Cohesion: 0.18
Nodes (14): rubricOf(), Job, plain(), Result, shareArticle(), ShareCardHost(), ShareCardView(), shareLink() (+6 more)

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
Cohesion: 0.18
Nodes (6): RUBRICS, syncWidget(), WidgetProps, widget, widget, pushWidget()

### Community 29 - "Follow.tsx"
Cohesion: 0.15
Nodes (10): api, DEFAULTS, demoStats, fmt(), FollowConf, FollowPage(), ok(), real() (+2 more)

### Community 30 - "0014_premium.sql"
Cohesion: 0.14
Nodes (23): promo_attempts_user, public.admin_grant_premium(), public.admin_revoke_premium(), public.admin_sub_events(), public.admin_subscribers(), public.apply_store_event(), public.expire_premium(), public.my_subscription() (+15 more)

### Community 31 - "q"
Cohesion: 0.14
Nodes (17): collectAll(), CollectResult, slug(), Source, pool, q(), DIR, migrate() (+9 more)

### Community 32 - "À faire une fois (environ 1 heure, hors délais de validation Apple et Google)"
Cohesion: 0.22
Nodes (8): 1. Les stores, 2. RevenueCat (gratuit jusqu'à 2 500 $ de revenus par mois), 3. Le webhook (RevenueCat prévient la base), 4. L'app, Bon à savoir, Ce qui est déjà fait dans le code, TITRE Premium : mettre en route les abonnements, À faire une fois (environ 1 heure, hors délais de validation Apple et Google)

### Community 33 - "public.app_settings"
Cohesion: 0.09
Nodes (23): engine_runs_started, public.engine_runs, public.admin_settings(), public.app_settings, public.handle_new_user(), public.needs_admin(), public.set_setting(), public.set_setting() (+15 more)

### Community 35 - "Back office TITRE"
Cohesion: 0.33
Nodes (5): Back office TITRE, Ce qu'on y fait, En local, Mettre en ligne (gratuit, GitHub Pages), Premier accès

### Community 36 - "TITRE : essayer l'app sur iPhone"
Cohesion: 0.33
Nodes (5): Ce qu'il faut, Lancer (5 minutes la première fois), Le widget « Titre du jour » (écran d'accueil), TITRE : essayer l'app sur iPhone, À essayer

### Community 38 - "public.profiles"
Cohesion: 0.16
Nodes (27): public.comment_votes, public.comments, public.profiles, public.reports, comments_guard, profiles_pseudo_lower, public.article_comments(), public.auto_hide_reported() (+19 more)

### Community 44 - "Account.tsx"
Cohesion: 0.12
Nodes (21): Boot(), DRAWER, Mode, myReferral(), referralLink(), styles, Invite(), plural() (+13 more)

### Community 45 - "0025_regie_objectifs.sql"
Cohesion: 0.19
Nodes (14): public.ad_campaigns, public.ad_hit(), public.ad_stats, public.live_ads(), ad_impressions_at, ad_impressions_campaign, ad_impressions_device, ad_impressions_ip (+6 more)

### Community 46 - "0009_moderation_gestion.sql"
Cohesion: 0.11
Nodes (14): articles_audit, audit_log_at, comments_audit, flashes_audit, profiles_audit, public.audit(), public.audit_log, public.dashboard() (+6 more)

### Community 47 - "0023_parrainage.sql"
Cohesion: 0.15
Nodes (12): on_auth_user_referral, public.check_referral(), public.claim_referral(), public.link_referral(), public.my_referral(), public.referral_admin(), public.referral_codes, public.referral_from_signup() (+4 more)

### Community 48 - "0022_reconnaissance.sql"
Cohesion: 0.32
Nodes (9): public.badge_holders(), public.badges, public.badges_of(), public.grant_badge(), public.track(), public.user_badges, public.user_reads, public.user_stats (+1 more)

### Community 50 - "0013_moderation_lecteurs.sql"
Cohesion: 0.19
Nodes (8): comments_auto_suspend, comments_muted, public.auto_suspend(), public.guard_muted(), public.set_setting(), public.setting_keys, public.reader_card(), public.engine_status()

### Community 52 - "0002_roles.sql"
Cohesion: 0.47
Nodes (5): on_auth_user_created, profiles_guard, public.guard_profile(), public.handle_new_user(), public.is_admin()

## Knowledge Gaps
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Api` connect `Api` to `src/App.tsx`, `data.ts`, `admin/src/Premium.tsx`, `Ads.tsx`, `Brand.tsx`, `account.ts`, `Algo.tsx`, `admin/src/Badges.tsx`, `Referral.tsx`, `Follow.tsx`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Should `src/App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06597222222222222 - nodes in this community are weakly interconnected._
- **Why does `auth.users` connect `public.profiles` to `anon`, `public.app_settings`, `0025_regie_objectifs.sql`, `0009_moderation_gestion.sql`, `0023_parrainage.sql`, `0022_reconnaissance.sql`, `0013_moderation_lecteurs.sql`, `0002_roles.sql`, `public.articles`, `0014_premium.sql`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Should `data.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.046756282875511396 - nodes in this community are weakly interconnected._
- **Why does `public.profiles` connect `public.profiles` to `anon`, `public.app_settings`, `0009_moderation_gestion.sql`, `0023_parrainage.sql`, `0022_reconnaissance.sql`, `0013_moderation_lecteurs.sql`, `0002_roles.sql`, `public.articles`, `0014_premium.sql`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Should `Api` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._
- **Should `admin/src/Premium.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07575757575757576 - nodes in this community are weakly interconnected._