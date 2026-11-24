# Graph Report - AppRun  (2026-11-24)

## Corpus Check
- 122 files · ~145,076 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: (none) 4, .xml 4, .example 3)

## Summary
- 1360 nodes · 3305 edges · 68 communities (49 shown, 19 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a6141586`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- edition.ts
- src/App.tsx
- data.ts
- Api
- admin/src/Premium.tsx
- ai.ts
- Ads.tsx
- brand.ts
- remote.ts
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
- 0010_lecteurs.sql
- admin/src/Badges.tsx
- Essayer TITRE en vrai (environ 15 minutes)
- flash.ts
- pexels.ts
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
- app/src/Badges.tsx
- 0025_regie_objectifs.sql
- public
- 0022_reconnaissance.sql
- q
- account.ts
- Invite.tsx
- config.ts
- 0002_roles.sql
- Topics.tsx
- algo.sql
- follow.sql
- src/tdm.ts
- Passer sur un serveur à soi (plus tard)
- public.dashboard
- cron.sh

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

## Communities (68 total, 19 thin omitted)

### Community 0 - "edition.ts"
Cohesion: 0.08
Nodes (36): adHit(), ADS, DEMO, Ev, flush(), key(), loadAds(), pickAds() (+28 more)

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
Cohesion: 0.08
Nodes (33): AiStopped, budget, CardSchema, checkCard(), clamp(), cleanStories(), Flashes, FlashOut (+25 more)

### Community 6 - "Ads.tsx"
Cohesion: 0.09
Nodes (32): AdsPage(), Campaign, CampaignForm(), days(), dayShift(), demoList, demoStats, Draft (+24 more)

### Community 7 - "brand.ts"
Cohesion: 0.09
Nodes (26): Boot(), apply(), applyRules(), applyShare(), bootBrand(), Config, DEF, fetchConfig() (+18 more)

### Community 8 - "remote.ts"
Cohesion: 0.13
Nodes (20): EMOJIS, FLASHES, PHOTOS, RUBRIC_LIST, RUBRICS, AppMessage, FlashRow, get() (+12 more)

### Community 9 - "Brand.tsx"
Cohesion: 0.09
Nodes (34): Brand, BrandPage(), COLORS, FONT_CSS, FONTS, FORMATS, HOURS, Identity() (+26 more)

### Community 10 - "0009_moderation_gestion.sql"
Cohesion: 0.16
Nodes (14): articles_audit, audit_log_at, comments_audit, flashes_audit, profiles_audit, public.admin_audit(), public.audit(), public.audit_log (+6 more)

### Community 11 - "app/src/Premium.tsx"
Cohesion: 0.12
Nodes (27): isPremium(), loadPlans(), MySub, mySubscription(), Plan, reloadMe(), day(), DEMO_PLANS (+19 more)

### Community 12 - "Feed.tsx"
Cohesion: 0.10
Nodes (39): flashTime(), rubricOf(), summaryOf(), Background(), CardContent(), ColumnStack(), EmojiPicker(), FactRow() (+31 more)

### Community 13 - "Algo.tsx"
Cohesion: 0.10
Nodes (20): AlgoConf, AlgoPage(), DEFAULTS, demoReader, demoStats, demoWords, Keyword, ok() (+12 more)

### Community 14 - "Screens.tsx"
Cohesion: 0.12
Nodes (38): accountsOn, cap(), dayLabel(), fmt(), isoDay(), shortDay(), todayLabel(), tomorrowLabel() (+30 more)

### Community 15 - "run.ts"
Cohesion: 0.16
Nodes (17): CardOut, cardText(), doubtIssue(), minorIssue(), Story, dedupe(), key(), Raw (+9 more)

### Community 16 - "Main"
Cohesion: 0.15
Nodes (21): Main(), ago(), colorOf(), currentMe(), getLocal(), isLive(), loadComments(), myEmojis() (+13 more)

### Community 17 - "model"
Cohesion: 0.22
Nodes (17): api(), cost(), EFFORT(), from(), judgeComments(), mockCard(), model(), reviewText() (+9 more)

### Community 18 - "public.articles"
Cohesion: 0.05
Nodes (70): articles_edition, articles_touch, comments_article, public.article_stats, public.articles, public.editions, public.is_staff(), public.raw_items (+62 more)

### Community 19 - "0010_lecteurs.sql"
Cohesion: 0.16
Nodes (12): comments_mode_guard, public.app_config(), public.app_messages, public.article_emoji_stats, public.article_emojis, public.guard_comments_mode(), public.set_setting(), article_emojis_article (+4 more)

### Community 20 - "admin/src/Badges.tsx"
Cohesion: 0.11
Nodes (17): Badge, BadgeRow(), BadgesPage(), Conf, CONF, ConfPanel(), demo, demoHolders (+9 more)

### Community 21 - "Essayer TITRE en vrai (environ 15 minutes)"
Cohesion: 0.10
Nodes (17): Algorithme « Mon édition » (sans IA), Ce qui reste ouvert, Dernière minute, En local, Moteur de contenu TITRE, Sujets suivis, À brancher (une fois), 1. Supabase : créer la base et noter 3 valeurs (5 min) (+9 more)

### Community 22 - "flash.ts"
Cohesion: 0.17
Nodes (18): checkFlash(), setRubricHints(), usage, Alert, sendTopicAlerts(), snapshot(), alerts(), args (+10 more)

### Community 23 - "pexels.ts"
Cohesion: 0.29
Nodes (10): findPhoto(), fromPexels(), fromUnsplash(), pexels(), pexelsOn(), PickedPhoto, PPhoto, unsplash() (+2 more)

### Community 24 - "ShareCard.tsx"
Cohesion: 0.16
Nodes (16): SHARE, onShare(), Job, plain(), Result, shareArticle(), ShareCardHost(), ShareCardView() (+8 more)

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
Cohesion: 0.18
Nodes (6): BRAND, syncWidget(), WidgetProps, widget, widget, pushWidget()

### Community 29 - "Follow.tsx"
Cohesion: 0.16
Nodes (9): DEFAULTS, demoStats, fmt(), FollowConf, FollowPage(), ok(), real(), Stats (+1 more)

### Community 30 - "anon"
Cohesion: 0.12
Nodes (27): promo_attempts_user, public.admin_grant_premium(), public.admin_revoke_premium(), public.admin_sub_events(), public.admin_subscribers(), public.apply_store_event(), public.expire_premium(), public.give_days() (+19 more)

### Community 31 - "collect.ts"
Cohesion: 0.18
Nodes (14): collect(), collectAll(), CollectResult, slug(), Source, arr(), clean(), FeedItem (+6 more)

### Community 32 - "À faire une fois (environ 1 heure, hors délais de validation Apple et Google)"
Cohesion: 0.22
Nodes (8): 1. Les stores, 2. RevenueCat (gratuit jusqu'à 2 500 $ de revenus par mois), 3. Le webhook (RevenueCat prévient la base), 4. L'app, Bon à savoir, Ce qui est déjà fait dans le code, TITRE Premium : mettre en route les abonnements, À faire une fois (environ 1 heure, hors délais de validation Apple et Google)

### Community 33 - "public.app_settings"
Cohesion: 0.07
Nodes (25): public.admin_settings(), public.app_settings, public.handle_new_user(), public.needs_admin(), public.set_setting(), public.set_setting(), public.set_setting(), public.has_insult() (+17 more)

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
Cohesion: 0.14
Nodes (31): public.comment_votes, public.comments, public.profiles, public.reports, comments_guard, profiles_pseudo_lower, public.article_comments(), public.auto_hide_reported() (+23 more)

### Community 44 - "app/src/Badges.tsx"
Cohesion: 0.39
Nodes (8): BadgeIcons(), BadgeList(), BadgeToast(), pseudoColor(), ReaderCardView(), s, Spark(), alpha()

### Community 45 - "0025_regie_objectifs.sql"
Cohesion: 0.19
Nodes (14): public.ad_campaigns, public.ad_hit(), public.ad_stats, public.live_ads(), ad_impressions_at, ad_impressions_campaign, ad_impressions_device, ad_impressions_ip (+6 more)

### Community 46 - "public"
Cohesion: 0.23
Nodes (7): engine_runs_started, public.engine_runs, public.ai_spend(), public.engine_status(), public.ai_spend_history(), public.engine_status(), public.unpublish_run()

### Community 47 - "0022_reconnaissance.sql"
Cohesion: 0.10
Nodes (22): public.badge_holders(), public.badges, public.badges_of(), public.grant_badge(), public.reader_card(), public.track(), public.user_badges, public.user_reads (+14 more)

### Community 48 - "q"
Cohesion: 0.40
Nodes (4): pool, q(), DIR, migrate()

### Community 49 - "account.ts"
Cohesion: 0.10
Nodes (50): Account(), api(), auth(), back(), blockAuthor(), blockedCount(), catchReferral(), claimReferral() (+42 more)

### Community 50 - "Invite.tsx"
Cohesion: 0.33
Nodes (8): myReferral(), Referral, referralLink(), Invite(), plural(), s, Stat(), st

### Community 51 - "config.ts"
Cohesion: 0.28
Nodes (3): cfg, fmt(), pauseMessage()

### Community 52 - "0002_roles.sql"
Cohesion: 0.47
Nodes (5): on_auth_user_created, profiles_guard, public.guard_profile(), public.handle_new_user(), public.is_admin()

### Community 53 - "Topics.tsx"
Cohesion: 0.09
Nodes (38): fetchPicks(), deviceId(), rpc(), flush(), loadMyEdition(), resetTaste(), articleTopics(), DEMO_LIST (+30 more)

### Community 62 - "src/tdm.ts"
Cohesion: 0.43
Nodes (6): AI_BOTS, aiBotsBlocked(), aiRefusal(), get(), tdmReserved(), b

### Community 63 - "Passer sur un serveur à soi (plus tard)"
Cohesion: 0.25
Nodes (7): Ce qui est déjà prêt, Ce qui ne marchera plus pareil, Ce qui restera lié (et pourquoi), Coûts estimés par mois (ordre de grandeur, prix à vérifier le jour venu), Le serveur visé, Passer sur un serveur à soi (plus tard), Étapes, le jour venu

## Knowledge Gaps
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Api` connect `Api` to `src/App.tsx`, `data.ts`, `admin/src/Premium.tsx`, `Ads.tsx`, `Brand.tsx`, `Algo.tsx`, `account.ts`, `admin/src/Badges.tsx`, `Referral.tsx`, `Follow.tsx`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Should `edition.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07827260458839407 - nodes in this community are weakly interconnected._
- **Why does `auth.users` connect `public.profiles` to `public.app_settings`, `0009_moderation_gestion.sql`, `0025_regie_objectifs.sql`, `public`, `0022_reconnaissance.sql`, `public.articles`, `0010_lecteurs.sql`, `0002_roles.sql`, `anon`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Should `src/App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07103825136612021 - nodes in this community are weakly interconnected._
- **Why does `public.articles` connect `public.articles` to `public.app_settings`, `public.profiles`, `0009_moderation_gestion.sql`, `public`, `0022_reconnaissance.sql`, `0010_lecteurs.sql`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Should `data.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04519774011299435 - nodes in this community are weakly interconnected._
- **Should `Api` be split into smaller, more focused modules?**
  _Cohesion score 0.038461538461538464 - nodes in this community are weakly interconnected._