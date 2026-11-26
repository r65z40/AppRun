# Graph Report - AppRun  (2026-11-26)

## Corpus Check
- 131 files · ~153,215 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: (none) 4, .xml 4, .example 3)

## Summary
- 1420 nodes · 3423 edges · 72 communities (49 shown, 23 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fe9fdd17`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- 0024_sujets_suivis.sql
- src/App.tsx
- data.ts
- Api
- admin/src/Premium.tsx
- ai.ts
- Ads.tsx
- brand.ts
- app/App.tsx
- Brand.tsx
- auth.users
- Sheets.tsx
- Feed.tsx
- Algo.tsx
- Screens.tsx
- run.ts
- model
- iphone-gratuit.js
- guard.ts
- ads.ts
- admin/src/Badges.tsx
- Essayer TITRE en vrai (environ 15 minutes)
- flash.ts
- pexels.ts
- src/mail.ts
- Règles pour Claude sur TITRE
- Referral.tsx
- headline.ts
- Follow.tsx
- anon
- collect.ts
- À faire une fois (environ 1 heure, hors délais de validation Apple et Google)
- public.app_settings
- public.articles
- Back office TITRE
- TITRE : essayer l'app sur iPhone
- public.engine_status
- setup-sql.sh
- run-local.sh
- app/src/Premium.tsx
- 0025_regie_objectifs.sql
- purchases.ts
- 0022_reconnaissance.sql
- account.ts
- src/tdm.ts
- 0002_roles.sql
- Topics.tsx
- algo.sql
- follow.sql
- Passer sur un serveur à soi (plus tard)
- public.profiles
- cron.sh
- ShareCard.tsx
- 0010_lecteurs.sql
- Cost.tsx
- public.dashboard

## God Nodes (most connected - your core abstractions)
1. `Main()` - 75 edges
2. `Api` - 65 edges
3. `public.profiles` - 56 edges
4. `public.articles` - 49 edges
5. `auth.users` - 38 edges
6. `public.comments` - 37 edges
7. `feel()` - 33 edges
8. `public.app_settings` - 30 edges
9. `App()` - 25 edges
10. `Account()` - 24 edges

## Surprising Connections (you probably didn't know these)
- `public.is_admin()` --reads_from--> `public.profiles`  [EXTRACTED]
  backend/supabase/migrations/0002_roles.sql → backend/supabase/migrations/0001_init.sql
- `public.handle_new_user()` --writes_to--> `public.profiles`  [EXTRACTED]
  backend/supabase/migrations/0005_settings.sql → backend/supabase/migrations/0001_init.sql
- `public.needs_admin()` --reads_from--> `public.profiles`  [EXTRACTED]
  backend/supabase/migrations/0005_settings.sql → backend/supabase/migrations/0001_init.sql
- `public.is_moderator()` --reads_from--> `public.profiles`  [EXTRACTED]
  backend/supabase/migrations/0009_moderation_gestion.sql → backend/supabase/migrations/0001_init.sql
- `profiles_created` --indexes--> `public.profiles`  [EXTRACTED]
  backend/supabase/migrations/0022_reconnaissance.sql → backend/supabase/migrations/0001_init.sql

## Import Cycles
- 2-file cycle: `admin/src/data.ts -> admin/src/demo.ts -> admin/src/data.ts`

## Communities (72 total, 23 thin omitted)

### Community 0 - "0024_sujets_suivis.sql"
Cohesion: 0.09
Nodes (33): flashes_published, flashes_touch, public.flashes, algo_keywords_retag, public.algo_keywords, public.article_topics, public.find_topics(), public.retag_articles() (+25 more)

### Community 1 - "src/App.tsx"
Cohesion: 0.07
Nodes (57): ReaderTaste(), ADMIN_ONLY, ago(), AI_TABS, AIPage(), AITab, allowed(), App() (+49 more)

### Community 2 - "data.ts"
Cohesion: 0.05
Nodes (55): AppMessage, Article, Audience, AUDIENCES, AuditEntry, Comment, Dashboard, Edition (+47 more)

### Community 4 - "admin/src/Premium.tsx"
Cohesion: 0.08
Nodes (31): Codes(), FILTERS, live(), ok(), Period, PERIOD, Plan, PremiumApi (+23 more)

### Community 5 - "ai.ts"
Cohesion: 0.09
Nodes (30): CardSchema, checkCard(), checkFlash(), clamp(), cleanFacts(), cleanStories(), cost(), Flashes (+22 more)

### Community 6 - "Ads.tsx"
Cohesion: 0.09
Nodes (32): AdsPage(), Campaign, CampaignForm(), days(), dayShift(), demoList, demoStats, Draft (+24 more)

### Community 7 - "brand.ts"
Cohesion: 0.11
Nodes (24): Boot(), getLocal(), setLocal(), apply(), applyRules(), applyShare(), bootBrand(), Config (+16 more)

### Community 8 - "app/App.tsx"
Cohesion: 0.05
Nodes (65): AccountAsk, App(), appScreen(), editionSig(), fetchPicks(), framed(), Main(), Overlay (+57 more)

### Community 9 - "Brand.tsx"
Cohesion: 0.08
Nodes (39): Brand, BrandPage(), COLORS, DAYS, FONT_CSS, FONTS, FORMATS, HOURS (+31 more)

### Community 10 - "auth.users"
Cohesion: 0.12
Nodes (17): articles_audit, audit_log_at, comments_audit, flashes_audit, profiles_audit, public.admin_audit(), public.audit(), public.audit_log (+9 more)

### Community 11 - "Sheets.tsx"
Cohesion: 0.10
Nodes (37): BadgeIcons(), BadgeList(), BadgeToast(), pseudoColor(), ReaderCardView(), s, SavedTime(), Spark() (+29 more)

### Community 12 - "Feed.tsx"
Cohesion: 0.13
Nodes (29): flashTime(), Background(), CardContent(), ColumnStack(), EmojiPicker(), FactRow(), Feed(), goRub() (+21 more)

### Community 13 - "Algo.tsx"
Cohesion: 0.10
Nodes (20): AlgoConf, AlgoPage(), DEFAULTS, demoReader, demoStats, demoWords, Keyword, ok() (+12 more)

### Community 14 - "Screens.tsx"
Cohesion: 0.10
Nodes (42): cap(), dayLabel(), fmt(), isoDay(), shortDay(), todayLabel(), tomorrowLabel(), yearLabel() (+34 more)

### Community 15 - "run.ts"
Cohesion: 0.14
Nodes (22): cardText(), doubtIssue(), minorIssue(), setRubricHints(), Story, usage, dedupe(), key() (+14 more)

### Community 16 - "model"
Cohesion: 0.21
Nodes (19): api(), EFFORT(), from(), judgeComments(), mockCard(), model(), reviewText(), rubricList() (+11 more)

### Community 17 - "iphone-gratuit.js"
Cohesion: 0.25
Nodes (4): app, { execSync }, fs, original

### Community 18 - "guard.ts"
Cohesion: 0.12
Nodes (14): AiStopped, budget, CardOut, cleanAngles(), Item, budget27, clean, invented (+6 more)

### Community 19 - "ads.ts"
Cohesion: 0.16
Nodes (17): adHit(), ADS, DEMO, Ev, flush(), key(), loadAds(), push() (+9 more)

### Community 20 - "admin/src/Badges.tsx"
Cohesion: 0.11
Nodes (17): Badge, BadgeRow(), BadgesPage(), Conf, CONF, ConfPanel(), demo, demoHolders (+9 more)

### Community 21 - "Essayer TITRE en vrai (environ 15 minutes)"
Cohesion: 0.10
Nodes (17): Algorithme « Mon édition » (sans IA), Ce qui reste ouvert, Dernière minute, En local, Moteur de contenu TITRE, Sujets suivis, À brancher (une fois), 1. Supabase : créer la base et noter 3 valeurs (5 min) (+9 more)

### Community 22 - "flash.ts"
Cohesion: 0.14
Nodes (15): Alert, sendTopicAlerts(), cfg, snapshot(), pool, q(), alerts(), args (+7 more)

### Community 23 - "pexels.ts"
Cohesion: 0.29
Nodes (10): findPhoto(), fromPexels(), fromUnsplash(), pexels(), pexelsOn(), PickedPhoto, PPhoto, unsplash() (+2 more)

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

### Community 30 - "anon"
Cohesion: 0.11
Nodes (30): promo_attempts_user, public.admin_grant_premium(), public.admin_revoke_premium(), public.admin_sub_events(), public.admin_subscribers(), public.apply_store_event(), public.expire_premium(), public.give_days() (+22 more)

### Community 31 - "collect.ts"
Cohesion: 0.18
Nodes (14): collect(), collectAll(), CollectResult, slug(), Source, arr(), clean(), FeedItem (+6 more)

### Community 32 - "À faire une fois (environ 1 heure, hors délais de validation Apple et Google)"
Cohesion: 0.22
Nodes (8): 1. Les stores, 2. RevenueCat (gratuit jusqu'à 2 500 $ de revenus par mois), 3. Le webhook (RevenueCat prévient la base), 4. L'app, Bon à savoir, Ce qui est déjà fait dans le code, TITRE Premium : mettre en route les abonnements, À faire une fois (environ 1 heure, hors délais de validation Apple et Google)

### Community 33 - "public.app_settings"
Cohesion: 0.08
Nodes (22): public.admin_settings(), public.app_settings, public.handle_new_user(), public.needs_admin(), public.set_setting(), public.set_setting(), public.set_setting(), public.has_insult() (+14 more)

### Community 34 - "public.articles"
Cohesion: 0.12
Nodes (30): articles_edition, articles_touch, comments_article, public.article_stats, public.articles, public.editions, public.is_staff(), public.reactions (+22 more)

### Community 35 - "Back office TITRE"
Cohesion: 0.33
Nodes (5): Back office TITRE, Ce qu'on y fait, En local, Mettre en ligne (gratuit, GitHub Pages), Premier accès

### Community 36 - "TITRE : essayer l'app sur iPhone"
Cohesion: 0.25
Nodes (7): Ce qu'il faut, La vraie app sur iPhone sans payer (7 jours), La vraie app sur iPhone sans payer et sans Mac (7 jours), Lancer (5 minutes la première fois), Le widget « Titre du jour » (écran d'accueil), TITRE : essayer l'app sur iPhone, À essayer

### Community 38 - "public.engine_status"
Cohesion: 0.15
Nodes (13): public.raw_items, public.sources, raw_items_published, engine_runs_started, public.engine_runs, public.purge_raw_items(), public.source_stats(), raw_items_when (+5 more)

### Community 44 - "app/src/Premium.tsx"
Cohesion: 0.10
Nodes (18): isPremium(), RULES, TEXTS, Haptic, players, prefs, Sound, SOURCES (+10 more)

### Community 45 - "0025_regie_objectifs.sql"
Cohesion: 0.20
Nodes (14): public.ad_campaigns, public.ad_hit(), public.ad_stats, public.live_ads(), ad_impressions_at, ad_impressions_campaign, ad_impressions_device, ad_impressions_ip (+6 more)

### Community 46 - "purchases.ts"
Cohesion: 0.24
Nodes (11): buy(), BuyResult, hasPremium(), KEY, manage(), RC, restore(), sdk() (+3 more)

### Community 47 - "0022_reconnaissance.sql"
Cohesion: 0.10
Nodes (23): profiles_created, public.app_config(), public.badge_holders(), public.badges, public.badges_of(), public.grant_badge(), public.track(), public.user_badges (+15 more)

### Community 49 - "account.ts"
Cohesion: 0.07
Nodes (68): Account(), accountsOn, ago(), api(), auth(), back(), blockAuthor(), blockedCount() (+60 more)

### Community 51 - "src/tdm.ts"
Cohesion: 0.43
Nodes (6): AI_BOTS, aiBotsBlocked(), aiRefusal(), get(), tdmReserved(), b

### Community 52 - "0002_roles.sql"
Cohesion: 0.47
Nodes (5): on_auth_user_created, profiles_guard, public.guard_profile(), public.handle_new_user(), public.is_admin()

### Community 53 - "Topics.tsx"
Cohesion: 0.11
Nodes (33): deviceId(), articleTopics(), DEMO_LIST, DEMO_WORDS, demoHas(), demoRead(), demoState(), demoTimeline() (+25 more)

### Community 63 - "Passer sur un serveur à soi (plus tard)"
Cohesion: 0.25
Nodes (7): Ce qui est déjà prêt, Ce qui ne marchera plus pareil, Ce qui restera lié (et pourquoi), Coûts estimés par mois (ordre de grandeur, prix à vérifier le jour venu), Le serveur visé, Passer sur un serveur à soi (plus tard), Étapes, le jour venu

### Community 64 - "public.profiles"
Cohesion: 0.13
Nodes (33): public.comment_votes, public.comments, public.profiles, public.reports, comments_guard, profiles_pseudo_lower, public.article_comments(), public.auto_hide_reported() (+25 more)

### Community 70 - "ShareCard.tsx"
Cohesion: 0.18
Nodes (15): SHARE, rubricOf(), Job, plain(), Result, shareArticle(), ShareCardHost(), ShareCardView() (+7 more)

### Community 72 - "0010_lecteurs.sql"
Cohesion: 0.16
Nodes (12): comments_mode_guard, public.app_config(), public.app_messages, public.article_emoji_stats, public.article_emojis, public.guard_comments_mode(), public.set_setting(), article_emojis_article (+4 more)

### Community 76 - "Cost.tsx"
Cohesion: 0.31
Nodes (8): CostEstimate(), EFFORT, estimate(), eur(), fit(), Parts, PRICE, SpendDay

## Knowledge Gaps
- **23 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Api` connect `Api` to `src/App.tsx`, `data.ts`, `admin/src/Premium.tsx`, `Ads.tsx`, `Brand.tsx`, `Algo.tsx`, `account.ts`, `admin/src/Badges.tsx`, `Referral.tsx`, `Follow.tsx`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Should `0024_sujets_suivis.sql` be split into smaller, more focused modules?**
  _Cohesion score 0.09390243902439024 - nodes in this community are weakly interconnected._
- **Why does `feel()` connect `Feed.tsx` to `app/App.tsx`, `Sheets.tsx`, `app/src/Premium.tsx`, `Screens.tsx`, `account.ts`, `Topics.tsx`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Should `src/App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06861239119303636 - nodes in this community are weakly interconnected._
- **Why does `public.articles` connect `public.articles` to `public.profiles`, `0024_sujets_suivis.sql`, `public.engine_status`, `0010_lecteurs.sql`, `auth.users`, `0022_reconnaissance.sql`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Should `data.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04519774011299435 - nodes in this community are weakly interconnected._
- **Should `Api` be split into smaller, more focused modules?**
  _Cohesion score 0.03636363636363636 - nodes in this community are weakly interconnected._