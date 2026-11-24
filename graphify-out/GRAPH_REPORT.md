# Graph Report - AppRun  (2026-11-24)

## Corpus Check
- 119 files · ~141,566 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: (none) 4, .xml 4, .example 3)

## Summary
- 1342 nodes · 3271 edges · 65 communities (49 shown, 16 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bd2a7ff7`
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
- edition.ts
- Brand.tsx
- 0009_moderation_gestion.sql
- app/src/Premium.tsx
- Feed.tsx
- Algo.tsx
- Screens.tsx
- run.ts
- Main
- model
- public.articles
- 0022_reconnaissance.sql
- admin/src/Badges.tsx
- Essayer TITRE en vrai (environ 15 minutes)
- flash.ts
- 0010_lecteurs.sql
- ShareCard.tsx
- src/mail.ts
- Règles pour Claude sur TITRE
- Referral.tsx
- headline.ts
- Follow.tsx
- anon
- collect.ts
- À faire une fois (environ 1 heure, hors délais de validation Apple et Google)
- public.app_settings
- app/App.tsx
- Back office TITRE
- TITRE : essayer l'app sur iPhone
- public.profiles
- setup-sql.sh
- run-local.sh
- Sheets.tsx
- 0025_regie_objectifs.sql
- public.flashes
- 0023_parrainage.sql
- q
- account.ts
- Invite.tsx
- pexels.ts
- 0002_roles.sql
- Topics.tsx
- algo.sql
- follow.sql
- config.ts
- src/tdm.ts

## God Nodes (most connected - your core abstractions)
1. `Main()` - 70 edges
2. `Api` - 64 edges
3. `public.profiles` - 56 edges
4. `public.articles` - 47 edges
5. `public.comments` - 37 edges
6. `auth.users` - 37 edges
7. `feel()` - 31 edges
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
- `public.is_moderator()` --reads_from--> `public.profiles`  [EXTRACTED]
  backend/supabase/migrations/0009_moderation_gestion.sql → backend/supabase/migrations/0001_init.sql
- `reactions_article` --indexes--> `public.reactions`  [EXTRACTED]
  backend/supabase/migrations/0030_securite_perfs.sql → backend/supabase/migrations/0001_init.sql

## Import Cycles
- 2-file cycle: `admin/src/data.ts -> admin/src/demo.ts -> admin/src/data.ts`

## Communities (65 total, 16 thin omitted)

### Community 0 - "Account.tsx"
Cohesion: 0.18
Nodes (16): Account(), blockedCount(), DRAWER, emit(), Field(), french(), Mode, readerCard() (+8 more)

### Community 1 - "src/App.tsx"
Cohesion: 0.07
Nodes (56): ReaderTaste(), ADMIN_ONLY, ago(), AI_TABS, AIPage(), AITab, allowed(), App() (+48 more)

### Community 2 - "data.ts"
Cohesion: 0.04
Nodes (56): AppMessage, Article, Audience, AUDIENCES, AuditEntry, Comment, Dashboard, Edition (+48 more)

### Community 4 - "admin/src/Premium.tsx"
Cohesion: 0.08
Nodes (31): Codes(), FILTERS, live(), ok(), Period, PERIOD, Plan, PremiumApi (+23 more)

### Community 5 - "ai.ts"
Cohesion: 0.08
Nodes (33): AiStopped, budget, CardSchema, checkCard(), clamp(), cleanStories(), Flashes, FlashOut (+25 more)

### Community 6 - "Ads.tsx"
Cohesion: 0.09
Nodes (32): AdsPage(), Campaign, CampaignForm(), days(), dayShift(), demoList, demoStats, Draft (+24 more)

### Community 7 - "brand.ts"
Cohesion: 0.12
Nodes (23): getLocal(), setLocal(), apply(), applyRules(), applyShare(), bootBrand(), Config, DEF (+15 more)

### Community 8 - "edition.ts"
Cohesion: 0.07
Nodes (38): adHit(), ADS, DEMO, Ev, flush(), key(), loadAds(), pickAds() (+30 more)

### Community 9 - "Brand.tsx"
Cohesion: 0.09
Nodes (33): Brand, BrandPage(), COLORS, FONT_CSS, FONTS, FORMATS, HOURS, Identity() (+25 more)

### Community 10 - "0009_moderation_gestion.sql"
Cohesion: 0.12
Nodes (14): articles_audit, audit_log_at, comments_audit, flashes_audit, profiles_audit, public.admin_audit(), public.audit(), public.audit_log (+6 more)

### Community 11 - "app/src/Premium.tsx"
Cohesion: 0.12
Nodes (26): isPremium(), loadPlans(), MySub, mySubscription(), Plan, day(), DEMO_PLANS, DRAWER (+18 more)

### Community 12 - "Feed.tsx"
Cohesion: 0.14
Nodes (34): flashTime(), rubricOf(), Background(), CardContent(), ColumnStack(), EmojiPicker(), FactRow(), Feed() (+26 more)

### Community 13 - "Algo.tsx"
Cohesion: 0.10
Nodes (20): AlgoConf, AlgoPage(), DEFAULTS, demoReader, demoStats, demoWords, Keyword, ok() (+12 more)

### Community 14 - "Screens.tsx"
Cohesion: 0.11
Nodes (39): accountsOn, cap(), dayLabel(), fmt(), isoDay(), shortDay(), todayLabel(), tomorrowLabel() (+31 more)

### Community 15 - "run.ts"
Cohesion: 0.16
Nodes (17): CardOut, cardText(), doubtIssue(), minorIssue(), Story, dedupe(), key(), Raw (+9 more)

### Community 16 - "Main"
Cohesion: 0.14
Nodes (20): editionSig(), Main(), pickDevice(), pickSaved(), api(), blockAuthor(), currentMe(), deleteComment() (+12 more)

### Community 17 - "model"
Cohesion: 0.22
Nodes (17): api(), cost(), EFFORT(), from(), judgeComments(), mockCard(), model(), reviewText() (+9 more)

### Community 18 - "public.articles"
Cohesion: 0.06
Nodes (63): articles_edition, articles_touch, comments_article, public.article_stats, public.articles, public.editions, public.is_staff(), public.raw_items (+55 more)

### Community 19 - "0022_reconnaissance.sql"
Cohesion: 0.22
Nodes (12): public.comment_votes, public.article_comments(), public.badge_holders(), public.badges, public.badges_of(), public.grant_badge(), public.reader_card(), public.track() (+4 more)

### Community 20 - "admin/src/Badges.tsx"
Cohesion: 0.11
Nodes (17): Badge, BadgeRow(), BadgesPage(), Conf, CONF, ConfPanel(), demo, demoHolders (+9 more)

### Community 21 - "Essayer TITRE en vrai (environ 15 minutes)"
Cohesion: 0.10
Nodes (17): Algorithme « Mon édition » (sans IA), Ce qui reste ouvert, Dernière minute, En local, Moteur de contenu TITRE, Sujets suivis, À brancher (une fois), 1. Supabase : créer la base et noter 3 valeurs (5 min) (+9 more)

### Community 22 - "flash.ts"
Cohesion: 0.17
Nodes (18): checkFlash(), setRubricHints(), usage, Alert, sendTopicAlerts(), snapshot(), alerts(), args (+10 more)

### Community 23 - "0010_lecteurs.sql"
Cohesion: 0.15
Nodes (13): comments_mode_guard, public.app_config(), public.app_messages, public.article_comments(), public.article_emoji_stats, public.article_emojis, public.guard_comments_mode(), public.set_setting() (+5 more)

### Community 24 - "ShareCard.tsx"
Cohesion: 0.08
Nodes (28): Boot(), BRAND, SHARE, Job, plain(), Result, ShareCardHost(), ShareCardView() (+20 more)

### Community 25 - "src/mail.ts"
Cohesion: 0.22
Nodes (14): authPatch(), env(), main(), save(), Brand, brand(), env(), esc() (+6 more)

### Community 26 - "Règles pour Claude sur TITRE"
Cohesion: 0.40
Nodes (4): 1. Toujours le skill « ponytail », 2. Toujours la carte Graphify, 3. Rappels du projet, Règles pour Claude sur TITRE

### Community 27 - "Referral.tsx"
Cohesion: 0.16
Nodes (12): api, Admin, Conf, CONF, ConfPanel(), date(), demo, Recent (+4 more)

### Community 28 - "headline.ts"
Cohesion: 0.20
Nodes (5): syncWidget(), WidgetProps, widget, widget, pushWidget()

### Community 29 - "Follow.tsx"
Cohesion: 0.15
Nodes (10): sb, DEFAULTS, demoStats, fmt(), FollowConf, FollowPage(), ok(), real() (+2 more)

### Community 30 - "anon"
Cohesion: 0.11
Nodes (31): public.suspend_user(), promo_attempts_user, public.admin_grant_premium(), public.admin_revoke_premium(), public.admin_sub_events(), public.admin_subscribers(), public.apply_store_event(), public.expire_premium() (+23 more)

### Community 31 - "collect.ts"
Cohesion: 0.18
Nodes (14): collect(), collectAll(), CollectResult, slug(), Source, arr(), clean(), FeedItem (+6 more)

### Community 32 - "À faire une fois (environ 1 heure, hors délais de validation Apple et Google)"
Cohesion: 0.22
Nodes (8): 1. Les stores, 2. RevenueCat (gratuit jusqu'à 2 500 $ de revenus par mois), 3. Le webhook (RevenueCat prévient la base), 4. L'app, Bon à savoir, Ce qui est déjà fait dans le code, TITRE Premium : mettre en route les abonnements, À faire une fois (environ 1 heure, hors délais de validation Apple et Google)

### Community 33 - "public.app_settings"
Cohesion: 0.08
Nodes (21): public.admin_settings(), public.app_settings, public.handle_new_user(), public.needs_admin(), public.set_setting(), public.set_setting(), public.set_setting(), public.has_insult() (+13 more)

### Community 34 - "app/App.tsx"
Cohesion: 0.06
Nodes (38): AccountAsk, App(), fetchPicks(), framed(), Overlay, Phase, useFrame(), flush() (+30 more)

### Community 35 - "Back office TITRE"
Cohesion: 0.33
Nodes (5): Back office TITRE, Ce qu'on y fait, En local, Mettre en ligne (gratuit, GitHub Pages), Premier accès

### Community 36 - "TITRE : essayer l'app sur iPhone"
Cohesion: 0.33
Nodes (5): Ce qu'il faut, Lancer (5 minutes la première fois), Le widget « Titre du jour » (écran d'accueil), TITRE : essayer l'app sur iPhone, À essayer

### Community 38 - "public.profiles"
Cohesion: 0.13
Nodes (31): public.comments, public.profiles, public.reports, comments_guard, profiles_pseudo_lower, public.article_comments(), public.auto_hide_reported(), public.guard_comment() (+23 more)

### Community 44 - "Sheets.tsx"
Cohesion: 0.20
Nodes (13): BadgeIcons(), BadgeList(), BadgeToast(), pseudoColor(), ReaderCardView(), s, SavedTime(), Spark() (+5 more)

### Community 45 - "0025_regie_objectifs.sql"
Cohesion: 0.19
Nodes (15): public.ad_campaigns, public.ad_hit(), public.ad_stats, public.live_ads(), ad_impressions_at, ad_impressions_campaign, ad_impressions_device, ad_impressions_ip (+7 more)

### Community 46 - "public.flashes"
Cohesion: 0.21
Nodes (9): flashes_published, flashes_touch, public.flashes, engine_runs_started, public.engine_runs, public.engine_status(), flashes_run, public.engine_status() (+1 more)

### Community 47 - "0023_parrainage.sql"
Cohesion: 0.15
Nodes (12): on_auth_user_referral, public.check_referral(), public.claim_referral(), public.link_referral(), public.my_referral(), public.referral_admin(), public.referral_codes, public.referral_from_signup() (+4 more)

### Community 48 - "q"
Cohesion: 0.40
Nodes (4): pool, q(), DIR, migrate()

### Community 49 - "account.ts"
Cohesion: 0.14
Nodes (28): ago(), auth(), back(), catchReferral(), cleanCode(), colorOf(), COLORS, LinkEvent (+20 more)

### Community 50 - "Invite.tsx"
Cohesion: 0.36
Nodes (8): claimReferral(), myReferral(), Referral, referralLink(), Invite(), plural(), s, Stat()

### Community 51 - "pexels.ts"
Cohesion: 0.29
Nodes (10): findPhoto(), fromPexels(), fromUnsplash(), pexels(), pexelsOn(), PickedPhoto, PPhoto, unsplash() (+2 more)

### Community 52 - "0002_roles.sql"
Cohesion: 0.47
Nodes (5): on_auth_user_created, profiles_guard, public.guard_profile(), public.handle_new_user(), public.is_admin()

### Community 53 - "Topics.tsx"
Cohesion: 0.11
Nodes (32): deviceId(), articleTopics(), DEMO_LIST, DEMO_WORDS, demoHas(), demoRead(), demoState(), demoTimeline() (+24 more)

### Community 62 - "config.ts"
Cohesion: 0.28
Nodes (3): cfg, fmt(), pauseMessage()

### Community 63 - "src/tdm.ts"
Cohesion: 0.43
Nodes (6): AI_BOTS, aiBotsBlocked(), aiRefusal(), get(), tdmReserved(), b

## Knowledge Gaps
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Api` connect `Api` to `Account.tsx`, `src/App.tsx`, `data.ts`, `admin/src/Premium.tsx`, `Ads.tsx`, `Brand.tsx`, `Algo.tsx`, `admin/src/Badges.tsx`, `Referral.tsx`, `Follow.tsx`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Should `src/App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06646825396825397 - nodes in this community are weakly interconnected._
- **Why does `auth.users` connect `public.profiles` to `public.app_settings`, `0009_moderation_gestion.sql`, `0025_regie_objectifs.sql`, `public.flashes`, `0023_parrainage.sql`, `public.articles`, `0022_reconnaissance.sql`, `0002_roles.sql`, `0010_lecteurs.sql`, `anon`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Should `data.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04480874316939891 - nodes in this community are weakly interconnected._
- **Why does `Main()` connect `Main` to `Account.tsx`, `app/App.tsx`, `brand.ts`, `edition.ts`, `app/src/Premium.tsx`, `Sheets.tsx`, `Feed.tsx`, `Screens.tsx`, `account.ts`, `Topics.tsx`, `ShareCard.tsx`, `headline.ts`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Should `Api` be split into smaller, more focused modules?**
  _Cohesion score 0.038461538461538464 - nodes in this community are weakly interconnected._
- **Should `admin/src/Premium.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07575757575757576 - nodes in this community are weakly interconnected._