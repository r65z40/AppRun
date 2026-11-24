# Graph Report - AppRun  (2026-11-24)

## Corpus Check
- 120 files · ~143,675 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: (none) 4, .xml 4, .example 3)

## Summary
- 1349 nodes · 3295 edges · 60 communities (44 shown, 16 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `38ec2e41`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ads.ts
- src/App.tsx
- data.ts
- Api
- admin/src/Premium.tsx
- ai.ts
- Ads.tsx
- brand.ts
- edition.ts
- Brand.tsx
- auth.users
- purchases.ts
- Feed.tsx
- Algo.tsx
- Screens.tsx
- run.ts
- app/src/Premium.tsx
- model
- public.articles
- 0013_moderation_lecteurs.sql
- admin/src/Badges.tsx
- Essayer TITRE en vrai (environ 15 minutes)
- flash.ts
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
- Sheets.tsx
- 0025_regie_objectifs.sql
- anon
- 0022_reconnaissance.sql
- q
- account.ts
- 0002_roles.sql
- Topics.tsx
- algo.sql
- follow.sql

## God Nodes (most connected - your core abstractions)
1. `Main()` - 72 edges
2. `Api` - 64 edges
3. `public.profiles` - 56 edges
4. `public.articles` - 48 edges
5. `public.comments` - 37 edges
6. `auth.users` - 37 edges
7. `feel()` - 32 edges
8. `public.app_settings` - 28 edges
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

## Communities (60 total, 16 thin omitted)

### Community 0 - "ads.ts"
Cohesion: 0.17
Nodes (16): adHit(), ADS, DEMO, Ev, flush(), key(), loadAds(), push() (+8 more)

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
Cohesion: 0.07
Nodes (36): AiStopped, budget, CardOut, CardSchema, checkCard(), checkFlash(), clamp(), cleanStories() (+28 more)

### Community 6 - "Ads.tsx"
Cohesion: 0.09
Nodes (32): AdsPage(), Campaign, CampaignForm(), days(), dayShift(), demoList, demoStats, Draft (+24 more)

### Community 7 - "brand.ts"
Cohesion: 0.11
Nodes (23): Boot(), getLocal(), setLocal(), apply(), applyRules(), applyShare(), bootBrand(), Config (+15 more)

### Community 8 - "edition.ts"
Cohesion: 0.08
Nodes (35): pickAds(), EMOJIS, FLASHES, PHOTOS, RUBRIC_LIST, BASE, buildColumns(), DEMO_BADGES (+27 more)

### Community 9 - "Brand.tsx"
Cohesion: 0.09
Nodes (34): Brand, BrandPage(), COLORS, FONT_CSS, FONTS, FORMATS, HOURS, Identity() (+26 more)

### Community 10 - "auth.users"
Cohesion: 0.16
Nodes (13): articles_audit, audit_log_at, comments_audit, flashes_audit, profiles_audit, public.admin_audit(), public.audit(), public.audit_log (+5 more)

### Community 11 - "purchases.ts"
Cohesion: 0.24
Nodes (11): buy(), BuyResult, hasPremium(), KEY, manage(), RC, restore(), sdk() (+3 more)

### Community 12 - "Feed.tsx"
Cohesion: 0.13
Nodes (30): summaryOf(), Background(), CardContent(), ColumnStack(), EmojiPicker(), FactRow(), Feed(), goRub() (+22 more)

### Community 13 - "Algo.tsx"
Cohesion: 0.10
Nodes (20): AlgoConf, AlgoPage(), DEFAULTS, demoReader, demoStats, demoWords, Keyword, ok() (+12 more)

### Community 14 - "Screens.tsx"
Cohesion: 0.11
Nodes (41): cap(), dayLabel(), flashTime(), fmt(), isoDay(), shortDay(), todayLabel(), tomorrowLabel() (+33 more)

### Community 15 - "run.ts"
Cohesion: 0.12
Nodes (26): cardText(), doubtIssue(), minorIssue(), usage, Journal, nothingNew(), spent(), startJournal() (+18 more)

### Community 16 - "app/src/Premium.tsx"
Cohesion: 0.11
Nodes (18): isPremium(), RULES, TEXTS, Haptic, players, prefs, Sound, SOURCES (+10 more)

### Community 17 - "model"
Cohesion: 0.22
Nodes (17): api(), cost(), EFFORT(), from(), judgeComments(), mockCard(), model(), reviewText() (+9 more)

### Community 18 - "public.articles"
Cohesion: 0.05
Nodes (68): articles_edition, articles_touch, comments_article, public.article_stats, public.articles, public.editions, public.is_staff(), public.raw_items (+60 more)

### Community 19 - "0013_moderation_lecteurs.sql"
Cohesion: 0.16
Nodes (10): comments_auto_suspend, comments_muted, public.audit(), public.auto_suspend(), public.guard_muted(), public.set_setting(), public.setting_keys, public.suspend_user() (+2 more)

### Community 20 - "admin/src/Badges.tsx"
Cohesion: 0.11
Nodes (17): Badge, BadgeRow(), BadgesPage(), Conf, CONF, ConfPanel(), demo, demoHolders (+9 more)

### Community 21 - "Essayer TITRE en vrai (environ 15 minutes)"
Cohesion: 0.10
Nodes (17): Algorithme « Mon édition » (sans IA), Ce qui reste ouvert, Dernière minute, En local, Moteur de contenu TITRE, Sujets suivis, À brancher (une fois), 1. Supabase : créer la base et noter 3 valeurs (5 min) (+9 more)

### Community 22 - "flash.ts"
Cohesion: 0.12
Nodes (19): setRubricHints(), Alert, sendTopicAlerts(), cfg, snapshot(), dedupe(), key(), Raw (+11 more)

### Community 24 - "ShareCard.tsx"
Cohesion: 0.19
Nodes (13): SHARE, Job, plain(), Result, ShareCardHost(), ShareCardView(), shareLink(), shareOnWeb() (+5 more)

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

### Community 30 - "public.profiles"
Cohesion: 0.15
Nodes (25): public.profiles, promo_attempts_user, public.admin_grant_premium(), public.admin_revoke_premium(), public.admin_sub_events(), public.admin_subscribers(), public.apply_store_event(), public.expire_premium() (+17 more)

### Community 31 - "collect.ts"
Cohesion: 0.18
Nodes (14): collect(), collectAll(), CollectResult, slug(), Source, arr(), clean(), FeedItem (+6 more)

### Community 32 - "À faire une fois (environ 1 heure, hors délais de validation Apple et Google)"
Cohesion: 0.22
Nodes (8): 1. Les stores, 2. RevenueCat (gratuit jusqu'à 2 500 $ de revenus par mois), 3. Le webhook (RevenueCat prévient la base), 4. L'app, Bon à savoir, Ce qui est déjà fait dans le code, TITRE Premium : mettre en route les abonnements, À faire une fois (environ 1 heure, hors délais de validation Apple et Google)

### Community 33 - "public.app_settings"
Cohesion: 0.07
Nodes (28): public.admin_settings(), public.app_settings, public.handle_new_user(), public.needs_admin(), public.set_setting(), public.set_setting(), public.set_setting(), public.has_insult() (+20 more)

### Community 34 - "app/App.tsx"
Cohesion: 0.11
Nodes (28): AccountAsk, App(), editionSig(), fetchPicks(), framed(), Main(), Overlay, Phase (+20 more)

### Community 35 - "Back office TITRE"
Cohesion: 0.33
Nodes (5): Back office TITRE, Ce qu'on y fait, En local, Mettre en ligne (gratuit, GitHub Pages), Premier accès

### Community 36 - "TITRE : essayer l'app sur iPhone"
Cohesion: 0.33
Nodes (5): Ce qu'il faut, Lancer (5 minutes la première fois), Le widget « Titre du jour » (écran d'accueil), TITRE : essayer l'app sur iPhone, À essayer

### Community 38 - "public.comments"
Cohesion: 0.11
Nodes (31): public.comment_votes, public.comments, public.reports, comments_guard, profiles_pseudo_lower, public.article_comments(), public.auto_hide_reported(), public.guard_comment() (+23 more)

### Community 44 - "Sheets.tsx"
Cohesion: 0.10
Nodes (31): BadgeIcons(), BadgeList(), BadgeToast(), pseudoColor(), ReaderCardView(), s, SavedTime(), Spark() (+23 more)

### Community 45 - "0025_regie_objectifs.sql"
Cohesion: 0.19
Nodes (14): public.ad_campaigns, public.ad_hit(), public.ad_stats, public.live_ads(), ad_impressions_at, ad_impressions_campaign, ad_impressions_device, ad_impressions_ip (+6 more)

### Community 46 - "anon"
Cohesion: 0.14
Nodes (12): engine_runs_started, public.engine_runs, public.dashboard(), public.sync_premium(), public.setting_json(), public.setting_int(), public.ai_spend(), public.follow_who() (+4 more)

### Community 47 - "0022_reconnaissance.sql"
Cohesion: 0.11
Nodes (22): profiles_created, public.badge_holders(), public.badges, public.badges_of(), public.grant_badge(), public.track(), public.user_badges, public.user_reads (+14 more)

### Community 48 - "q"
Cohesion: 0.21
Nodes (10): pool, q(), DIR, migrate(), AI_BOTS, aiBotsBlocked(), aiRefusal(), get() (+2 more)

### Community 49 - "account.ts"
Cohesion: 0.07
Nodes (67): Account(), accountsOn, ago(), api(), auth(), back(), blockAuthor(), blockedCount() (+59 more)

### Community 52 - "0002_roles.sql"
Cohesion: 0.47
Nodes (5): on_auth_user_created, profiles_guard, public.guard_profile(), public.handle_new_user(), public.is_admin()

### Community 53 - "Topics.tsx"
Cohesion: 0.11
Nodes (32): deviceId(), articleTopics(), DEMO_LIST, DEMO_WORDS, demoHas(), demoRead(), demoState(), demoTimeline() (+24 more)

## Knowledge Gaps
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Api` connect `Api` to `src/App.tsx`, `data.ts`, `admin/src/Premium.tsx`, `Ads.tsx`, `Brand.tsx`, `Algo.tsx`, `account.ts`, `admin/src/Badges.tsx`, `Referral.tsx`, `Follow.tsx`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Should `src/App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06646825396825397 - nodes in this community are weakly interconnected._
- **Why does `auth.users` connect `auth.users` to `public.app_settings`, `public.comments`, `0025_regie_objectifs.sql`, `anon`, `0022_reconnaissance.sql`, `public.articles`, `0013_moderation_lecteurs.sql`, `0002_roles.sql`, `public.profiles`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Should `data.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04519774011299435 - nodes in this community are weakly interconnected._
- **Why does `public.articles` connect `public.articles` to `public.app_settings`, `public.comments`, `auth.users`, `anon`, `0022_reconnaissance.sql`, `0013_moderation_lecteurs.sql`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Should `Api` be split into smaller, more focused modules?**
  _Cohesion score 0.038461538461538464 - nodes in this community are weakly interconnected._
- **Should `admin/src/Premium.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07575757575757576 - nodes in this community are weakly interconnected._