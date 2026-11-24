# Graph Report - AppRun  (2026-11-24)

## Corpus Check
- 119 files · ~140,962 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: (none) 4, .xml 4, .example 3)

## Summary
- 1338 nodes · 3247 edges · 66 communities (48 shown, 18 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ae951661`
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
- pexels.ts
- Brand.tsx
- auth.users
- app/src/Premium.tsx
- Feed.tsx
- Algo.tsx
- Screens.tsx
- run.ts
- public.articles
- model
- 0015_algorithme.sql
- edition.ts
- admin/src/Badges.tsx
- Essayer TITRE en vrai (environ 15 minutes)
- flash.ts
- 0024_sujets_suivis.sql
- ShareCard.tsx
- src/mail.ts
- Règles pour Claude sur TITRE
- Referral.tsx
- headline.ts
- Follow.tsx
- 0014_premium.sql
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
- public
- 0022_reconnaissance.sql
- q
- config.ts
- public.rubrics
- public.article_emojis
- 0002_roles.sql
- topics.ts
- algo.sql
- follow.sql
- public.flashes
- public.dashboard
- public.compose_edition

## God Nodes (most connected - your core abstractions)
1. `Main()` - 68 edges
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
- `releaseY()` --calls--> `feel()`  [EXTRACTED]
  app/src/Feed.tsx → app/src/feel.ts
- `public.is_admin()` --reads_from--> `public.profiles`  [EXTRACTED]
  backend/supabase/migrations/0002_roles.sql → backend/supabase/migrations/0001_init.sql
- `public.handle_new_user()` --writes_to--> `public.profiles`  [EXTRACTED]
  backend/supabase/migrations/0005_settings.sql → backend/supabase/migrations/0001_init.sql
- `public.needs_admin()` --reads_from--> `public.profiles`  [EXTRACTED]
  backend/supabase/migrations/0005_settings.sql → backend/supabase/migrations/0001_init.sql
- `public.is_moderator()` --reads_from--> `public.profiles`  [EXTRACTED]
  backend/supabase/migrations/0009_moderation_gestion.sql → backend/supabase/migrations/0001_init.sql

## Import Cycles
- 2-file cycle: `admin/src/data.ts -> admin/src/demo.ts -> admin/src/data.ts`

## Communities (66 total, 18 thin omitted)

### Community 0 - "account.ts"
Cohesion: 0.06
Nodes (82): Main(), Account(), ago(), api(), auth(), back(), blockAuthor(), blockedCount() (+74 more)

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
Cohesion: 0.11
Nodes (23): Boot(), getLocal(), setLocal(), apply(), applyRules(), applyShare(), bootBrand(), Config (+15 more)

### Community 8 - "pexels.ts"
Cohesion: 0.29
Nodes (10): findPhoto(), fromPexels(), fromUnsplash(), pexels(), pexelsOn(), PickedPhoto, PPhoto, unsplash() (+2 more)

### Community 9 - "Brand.tsx"
Cohesion: 0.09
Nodes (33): Brand, BrandPage(), COLORS, FONT_CSS, FONTS, FORMATS, HOURS, Identity() (+25 more)

### Community 10 - "auth.users"
Cohesion: 0.15
Nodes (14): articles_audit, audit_log_at, comments_audit, flashes_audit, profiles_audit, public.admin_audit(), public.audit(), public.audit_log (+6 more)

### Community 11 - "app/src/Premium.tsx"
Cohesion: 0.15
Nodes (12): MySub, Plan, TEXTS, day(), DEMO_PLANS, DRAWER, euros(), Line() (+4 more)

### Community 12 - "Feed.tsx"
Cohesion: 0.15
Nodes (27): flashTime(), Background(), CardContent(), ColumnStack(), FactRow(), Feed(), goRub(), releaseX() (+19 more)

### Community 13 - "Algo.tsx"
Cohesion: 0.10
Nodes (20): AlgoConf, AlgoPage(), DEFAULTS, demoReader, demoStats, demoWords, Keyword, ok() (+12 more)

### Community 14 - "Screens.tsx"
Cohesion: 0.10
Nodes (43): accountsOn, EmojiPicker(), feel(), Bravo(), Dot(), DRAWER, End(), fmt() (+35 more)

### Community 15 - "run.ts"
Cohesion: 0.16
Nodes (17): CardOut, cardText(), doubtIssue(), minorIssue(), Story, dedupe(), key(), Raw (+9 more)

### Community 16 - "public.articles"
Cohesion: 0.20
Nodes (17): articles_edition, articles_touch, comments_article, public.article_stats, public.articles, public.editions, public.is_staff(), public.reactions (+9 more)

### Community 17 - "model"
Cohesion: 0.22
Nodes (17): api(), cost(), EFFORT(), from(), judgeComments(), mockCard(), model(), reviewText() (+9 more)

### Community 18 - "0015_algorithme.sql"
Cohesion: 0.17
Nodes (13): algo_keywords_retag, articles_topics, _cand, public.algo_conf(), public.compose_edition(), public.purge_reading_events(), public.reading_events, public.retag_articles() (+5 more)

### Community 19 - "edition.ts"
Cohesion: 0.07
Nodes (38): pickAds(), RULES, EMOJIS, FLASHES, PHOTOS, RUBRIC_LIST, BASE, buildColumns() (+30 more)

### Community 20 - "admin/src/Badges.tsx"
Cohesion: 0.11
Nodes (17): Badge, BadgeRow(), BadgesPage(), Conf, CONF, ConfPanel(), demo, demoHolders (+9 more)

### Community 21 - "Essayer TITRE en vrai (environ 15 minutes)"
Cohesion: 0.10
Nodes (17): Algorithme « Mon édition » (sans IA), Ce qui reste ouvert, Dernière minute, En local, Moteur de contenu TITRE, Sujets suivis, À brancher (une fois), 1. Supabase : créer la base et noter 3 valeurs (5 min) (+9 more)

### Community 22 - "flash.ts"
Cohesion: 0.17
Nodes (18): checkFlash(), setRubricHints(), usage, Alert, sendTopicAlerts(), snapshot(), alerts(), args (+10 more)

### Community 23 - "0024_sujets_suivis.sql"
Cohesion: 0.15
Nodes (23): public.algo_keywords, public.article_topics, public.find_topics(), algo_keywords_retag_flashes, public.drop_push(), public.follow_conf(), public.follow_stats(), public.follow_topic() (+15 more)

### Community 24 - "ShareCard.tsx"
Cohesion: 0.09
Nodes (28): BRAND, SHARE, Splash(), Job, plain(), Result, ShareCardHost(), ShareCardView() (+20 more)

### Community 25 - "src/mail.ts"
Cohesion: 0.14
Nodes (20): authPatch(), env(), main(), save(), Brand, brand(), env(), esc() (+12 more)

### Community 26 - "Règles pour Claude sur TITRE"
Cohesion: 0.40
Nodes (4): 1. Toujours le skill « ponytail », 2. Toujours la carte Graphify, 3. Rappels du projet, Règles pour Claude sur TITRE

### Community 27 - "Referral.tsx"
Cohesion: 0.16
Nodes (12): api, Admin, Conf, CONF, ConfPanel(), date(), demo, Recent (+4 more)

### Community 28 - "headline.ts"
Cohesion: 0.18
Nodes (6): RUBRICS, syncWidget(), WidgetProps, widget, widget, pushWidget()

### Community 29 - "Follow.tsx"
Cohesion: 0.15
Nodes (10): sb, DEFAULTS, demoStats, fmt(), FollowConf, FollowPage(), ok(), real() (+2 more)

### Community 30 - "0014_premium.sql"
Cohesion: 0.13
Nodes (24): promo_attempts_user, public.admin_grant_premium(), public.admin_revoke_premium(), public.admin_sub_events(), public.admin_subscribers(), public.apply_store_event(), public.expire_premium(), public.give_days() (+16 more)

### Community 31 - "collect.ts"
Cohesion: 0.18
Nodes (14): collect(), collectAll(), CollectResult, slug(), Source, arr(), clean(), FeedItem (+6 more)

### Community 32 - "À faire une fois (environ 1 heure, hors délais de validation Apple et Google)"
Cohesion: 0.22
Nodes (8): 1. Les stores, 2. RevenueCat (gratuit jusqu'à 2 500 $ de revenus par mois), 3. Le webhook (RevenueCat prévient la base), 4. L'app, Bon à savoir, Ce qui est déjà fait dans le code, TITRE Premium : mettre en route les abonnements, À faire une fois (environ 1 heure, hors délais de validation Apple et Google)

### Community 33 - "public.app_settings"
Cohesion: 0.08
Nodes (23): public.admin_settings(), public.app_settings, public.handle_new_user(), public.needs_admin(), public.set_setting(), public.set_setting(), public.set_setting(), public.has_insult() (+15 more)

### Community 34 - "app/App.tsx"
Cohesion: 0.09
Nodes (18): AccountAsk, App(), editionSig(), framed(), Overlay, Phase, pickDevice(), pickSaved() (+10 more)

### Community 35 - "Back office TITRE"
Cohesion: 0.33
Nodes (5): Back office TITRE, Ce qu'on y fait, En local, Mettre en ligne (gratuit, GitHub Pages), Premier accès

### Community 36 - "TITRE : essayer l'app sur iPhone"
Cohesion: 0.33
Nodes (5): Ce qu'il faut, Lancer (5 minutes la première fois), Le widget « Titre du jour » (écran d'accueil), TITRE : essayer l'app sur iPhone, À essayer

### Community 38 - "public.profiles"
Cohesion: 0.11
Nodes (37): public.comment_votes, public.comments, public.profiles, public.reports, comments_guard, profiles_pseudo_lower, public.article_comments(), public.auto_hide_reported() (+29 more)

### Community 44 - "Sheets.tsx"
Cohesion: 0.14
Nodes (23): BadgeIcons(), BadgeList(), BadgeToast(), pseudoColor(), ReaderCardView(), s, SavedTime(), Spark() (+15 more)

### Community 45 - "0025_regie_objectifs.sql"
Cohesion: 0.20
Nodes (14): public.ad_campaigns, public.ad_hit(), public.ad_stats, public.live_ads(), ad_impressions_at, ad_impressions_campaign, ad_impressions_device, ad_impressions_ip (+6 more)

### Community 46 - "public"
Cohesion: 0.14
Nodes (12): engine_runs_started, public.engine_runs, public.sync_premium(), public.setting_json(), public.setting_int(), public.ai_spend(), public.follow_who(), public.ad_pacing() (+4 more)

### Community 47 - "0022_reconnaissance.sql"
Cohesion: 0.11
Nodes (21): public.badge_holders(), public.badges, public.badges_of(), public.grant_badge(), public.track(), public.user_badges, public.user_reads, public.user_stats (+13 more)

### Community 48 - "q"
Cohesion: 0.40
Nodes (4): pool, q(), DIR, migrate()

### Community 49 - "config.ts"
Cohesion: 0.28
Nodes (3): cfg, fmt(), pauseMessage()

### Community 50 - "public.rubrics"
Cohesion: 0.36
Nodes (7): public.raw_items, public.rubrics, public.sources, raw_items_published, public.purge_raw_items(), public.source_stats(), raw_items_when

### Community 51 - "public.article_emojis"
Cohesion: 0.25
Nodes (7): public.article_emoji_stats, public.article_emojis, article_emojis_article, comment_votes_comment, comments_user, reactions_article, visits_user

### Community 52 - "0002_roles.sql"
Cohesion: 0.47
Nodes (5): on_auth_user_created, profiles_guard, public.guard_profile(), public.handle_new_user(), public.is_admin()

### Community 53 - "topics.ts"
Cohesion: 0.06
Nodes (44): fetchPicks(), deviceId(), rpc(), adHit(), ADS, DEMO, Ev, flush() (+36 more)

### Community 62 - "public.flashes"
Cohesion: 0.38
Nodes (6): flashes_published, flashes_touch, public.flashes, flashes_tag, public.tag_flash(), flashes_run

## Knowledge Gaps
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Api` connect `Api` to `account.ts`, `src/App.tsx`, `data.ts`, `admin/src/Premium.tsx`, `Ads.tsx`, `Brand.tsx`, `Algo.tsx`, `admin/src/Badges.tsx`, `Referral.tsx`, `Follow.tsx`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Should `account.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05867665418227216 - nodes in this community are weakly interconnected._
- **Why does `auth.users` connect `auth.users` to `public.app_settings`, `public.profiles`, `0025_regie_objectifs.sql`, `public`, `0022_reconnaissance.sql`, `public.articles`, `0015_algorithme.sql`, `public.article_emojis`, `0002_roles.sql`, `0024_sujets_suivis.sql`, `0014_premium.sql`, `public.flashes`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Should `src/App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06646825396825397 - nodes in this community are weakly interconnected._
- **Why does `public.profiles` connect `public.profiles` to `public.app_settings`, `auth.users`, `public`, `0022_reconnaissance.sql`, `public.articles`, `0002_roles.sql`, `0014_premium.sql`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Should `data.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04480874316939891 - nodes in this community are weakly interconnected._
- **Should `Api` be split into smaller, more focused modules?**
  _Cohesion score 0.038461538461538464 - nodes in this community are weakly interconnected._