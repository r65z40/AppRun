# Graph Report - AppRun  (2026-11-25)

## Corpus Check
- 130 files · ~152,570 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: (none) 4, .xml 4, .example 3)

## Summary
- 1410 nodes · 3414 edges · 73 communities (49 shown, 24 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6e2a259a`
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
- 0009_moderation_gestion.sql
- public.articles
- Feed.tsx
- Algo.tsx
- Screens.tsx
- run.ts
- 0015_algorithme.sql
- guard.ts
- edition.ts
- admin/src/Badges.tsx
- Essayer TITRE en vrai (environ 15 minutes)
- flash.ts
- pexels.ts
- src/mail.ts
- Règles pour Claude sur TITRE
- Referral.tsx
- headline.ts
- Follow.tsx
- public.profiles
- collect.ts
- À faire une fois (environ 1 heure, hors délais de validation Apple et Google)
- public.app_settings
- Back office TITRE
- TITRE : essayer l'app sur iPhone
- anon
- setup-sql.sh
- run-local.sh
- app/src/Premium.tsx
- 0025_regie_objectifs.sql
- 0022_reconnaissance.sql
- q
- account.ts
- src/tdm.ts
- 0002_roles.sql
- Topics.tsx
- algo.sql
- follow.sql
- public.rubrics
- Passer sur un serveur à soi (plus tard)
- auth.users
- cron.sh
- ShareCard.tsx
- public.article_emojis
- Cost.tsx
- public.compose_edition
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
- `Main()` --calls--> `currentMe()`  [EXTRACTED]
  app/App.tsx → app/src/account.ts
- `Main()` --calls--> `myEmojis()`  [EXTRACTED]
  app/App.tsx → app/src/account.ts
- `Main()` --calls--> `myReactions()`  [EXTRACTED]
  app/App.tsx → app/src/account.ts
- `Main()` --calls--> `takeLinkEvent()`  [EXTRACTED]
  app/App.tsx → app/src/account.ts
- `releaseY()` --calls--> `feel()`  [EXTRACTED]
  app/src/Feed.tsx → app/src/feel.ts

## Import Cycles
- 2-file cycle: `admin/src/data.ts -> admin/src/demo.ts -> admin/src/data.ts`

## Communities (73 total, 24 thin omitted)

### Community 0 - "0024_sujets_suivis.sql"
Cohesion: 0.11
Nodes (28): flashes_published, flashes_touch, public.flashes, public.algo_keywords, public.find_topics(), algo_keywords_retag_flashes, flashes_tag, public.drop_push() (+20 more)

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
Cohesion: 0.08
Nodes (41): api(), CardSchema, checkCard(), checkFlash(), clamp(), cleanFacts(), cleanStories(), EFFORT() (+33 more)

### Community 6 - "Ads.tsx"
Cohesion: 0.09
Nodes (32): AdsPage(), Campaign, CampaignForm(), days(), dayShift(), demoList, demoStats, Draft (+24 more)

### Community 7 - "brand.ts"
Cohesion: 0.07
Nodes (39): Boot(), getLocal(), setLocal(), restore(), apply(), applyRules(), applyShare(), bootBrand() (+31 more)

### Community 8 - "app/App.tsx"
Cohesion: 0.07
Nodes (48): AccountAsk, App(), appScreen(), editionSig(), fetchPicks(), framed(), Main(), Overlay (+40 more)

### Community 9 - "Brand.tsx"
Cohesion: 0.08
Nodes (39): Brand, BrandPage(), COLORS, DAYS, FONT_CSS, FONTS, FORMATS, HOURS (+31 more)

### Community 10 - "0009_moderation_gestion.sql"
Cohesion: 0.16
Nodes (14): articles_audit, audit_log_at, comments_audit, flashes_audit, profiles_audit, public.admin_audit(), public.audit(), public.audit_log (+6 more)

### Community 11 - "public.articles"
Cohesion: 0.20
Nodes (12): articles_edition, articles_touch, comments_article, public.article_stats, public.articles, public.is_staff(), public.reactions, public.touch_updated_at() (+4 more)

### Community 12 - "Feed.tsx"
Cohesion: 0.09
Nodes (45): BadgeIcons(), BadgeList(), BadgeToast(), pseudoColor(), ReaderCardView(), s, SavedTime(), Spark() (+37 more)

### Community 13 - "Algo.tsx"
Cohesion: 0.10
Nodes (20): AlgoConf, AlgoPage(), DEFAULTS, demoReader, demoStats, demoWords, Keyword, ok() (+12 more)

### Community 14 - "Screens.tsx"
Cohesion: 0.11
Nodes (40): cap(), dayLabel(), fmt(), isoDay(), shortDay(), todayLabel(), tomorrowLabel(), yearLabel() (+32 more)

### Community 15 - "run.ts"
Cohesion: 0.16
Nodes (17): cardText(), cleanAngles(), doubtIssue(), minorIssue(), Story, dedupe(), key(), Raw (+9 more)

### Community 16 - "0015_algorithme.sql"
Cohesion: 0.17
Nodes (19): algo_keywords_retag, articles_topics, _cand, public.admin_reader_algo(), public.algo_conf(), public.algo_stats(), public.article_topics, public.compose_edition() (+11 more)

### Community 18 - "guard.ts"
Cohesion: 0.13
Nodes (13): AiStopped, budget, CardOut, Item, budget27, clean, invented, items (+5 more)

### Community 19 - "edition.ts"
Cohesion: 0.07
Nodes (38): adHit(), ADS, DEMO, Ev, flush(), key(), loadAds(), pickAds() (+30 more)

### Community 20 - "admin/src/Badges.tsx"
Cohesion: 0.11
Nodes (17): Badge, BadgeRow(), BadgesPage(), Conf, CONF, ConfPanel(), demo, demoHolders (+9 more)

### Community 21 - "Essayer TITRE en vrai (environ 15 minutes)"
Cohesion: 0.10
Nodes (17): Algorithme « Mon édition » (sans IA), Ce qui reste ouvert, Dernière minute, En local, Moteur de contenu TITRE, Sujets suivis, À brancher (une fois), 1. Supabase : créer la base et noter 3 valeurs (5 min) (+9 more)

### Community 22 - "flash.ts"
Cohesion: 0.13
Nodes (22): cost(), judgeComments(), model(), setRubricHints(), usage, cfg, snapshot(), args (+14 more)

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
Cohesion: 0.16
Nodes (12): api, Admin, Conf, CONF, ConfPanel(), date(), demo, Recent (+4 more)

### Community 28 - "headline.ts"
Cohesion: 0.20
Nodes (5): syncWidget(), WidgetProps, widget, widget, pushWidget()

### Community 29 - "Follow.tsx"
Cohesion: 0.15
Nodes (10): sb, DEFAULTS, demoStats, fmt(), FollowConf, FollowPage(), ok(), real() (+2 more)

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
Nodes (27): public.admin_settings(), public.app_settings, public.handle_new_user(), public.needs_admin(), public.set_setting(), public.set_setting(), public.set_setting(), public.has_insult() (+19 more)

### Community 35 - "Back office TITRE"
Cohesion: 0.33
Nodes (5): Back office TITRE, Ce qu'on y fait, En local, Mettre en ligne (gratuit, GitHub Pages), Premier accès

### Community 36 - "TITRE : essayer l'app sur iPhone"
Cohesion: 0.33
Nodes (5): Ce qu'il faut, Lancer (5 minutes la première fois), Le widget « Titre du jour » (écran d'accueil), TITRE : essayer l'app sur iPhone, À essayer

### Community 38 - "anon"
Cohesion: 0.11
Nodes (17): engine_runs_started, public.engine_runs, public.suspend_user(), public.sync_premium(), public.setting_json(), public.setting_int(), public.ai_spend(), public.dispatch_log (+9 more)

### Community 44 - "app/src/Premium.tsx"
Cohesion: 0.10
Nodes (30): isPremium(), BRAND, day(), DEMO_PLANS, DRAWER, euros(), Line(), PER (+22 more)

### Community 45 - "0025_regie_objectifs.sql"
Cohesion: 0.19
Nodes (14): public.ad_campaigns, public.ad_hit(), public.ad_stats, public.live_ads(), ad_impressions_at, ad_impressions_campaign, ad_impressions_device, ad_impressions_ip (+6 more)

### Community 47 - "0022_reconnaissance.sql"
Cohesion: 0.10
Nodes (23): profiles_created, public.badge_holders(), public.badges, public.badges_of(), public.grant_badge(), public.reader_card(), public.track(), public.user_badges (+15 more)

### Community 48 - "q"
Cohesion: 0.27
Nodes (7): Alert, sendTopicAlerts(), pool, q(), alerts(), DIR, migrate()

### Community 49 - "account.ts"
Cohesion: 0.06
Nodes (72): Account(), accountsOn, ago(), api(), auth(), back(), blockAuthor(), blockedCount() (+64 more)

### Community 51 - "src/tdm.ts"
Cohesion: 0.43
Nodes (6): AI_BOTS, aiBotsBlocked(), aiRefusal(), get(), tdmReserved(), b

### Community 52 - "0002_roles.sql"
Cohesion: 0.47
Nodes (5): on_auth_user_created, profiles_guard, public.guard_profile(), public.handle_new_user(), public.is_admin()

### Community 53 - "Topics.tsx"
Cohesion: 0.10
Nodes (34): FLASHES, RUBRIC_LIST, RUBRICS, articleTopics(), DEMO_LIST, DEMO_WORDS, demoHas(), demoRead() (+26 more)

### Community 62 - "public.rubrics"
Cohesion: 0.23
Nodes (9): public.raw_items, public.rubrics, public.sources, raw_items_published, public.purge_raw_items(), public.source_stats(), raw_items_when, _cand (+1 more)

### Community 63 - "Passer sur un serveur à soi (plus tard)"
Cohesion: 0.25
Nodes (7): Ce qui est déjà prêt, Ce qui ne marchera plus pareil, Ce qui restera lié (et pourquoi), Coûts estimés par mois (ordre de grandeur, prix à vérifier le jour venu), Le serveur visé, Passer sur un serveur à soi (plus tard), Étapes, le jour venu

### Community 64 - "auth.users"
Cohesion: 0.13
Nodes (29): public.comment_votes, public.comments, public.reports, comments_guard, profiles_pseudo_lower, public.article_comments(), public.auto_hide_reported(), public.guard_comment() (+21 more)

### Community 70 - "ShareCard.tsx"
Cohesion: 0.20
Nodes (13): Job, plain(), Result, shareArticle(), ShareCardHost(), ShareCardView(), shareLink(), shareOnWeb() (+5 more)

### Community 72 - "public.article_emojis"
Cohesion: 0.25
Nodes (7): public.article_emoji_stats, public.article_emojis, article_emojis_article, comment_votes_comment, comments_user, reactions_article, visits_user

### Community 76 - "Cost.tsx"
Cohesion: 0.31
Nodes (8): CostEstimate(), EFFORT, estimate(), eur(), fit(), Parts, PRICE, SpendDay

### Community 78 - "public.compose_edition"
Cohesion: 0.67
Nodes (3): public.editions, _cand, public.compose_edition()

## Knowledge Gaps
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Api` connect `Api` to `src/App.tsx`, `data.ts`, `admin/src/Premium.tsx`, `Ads.tsx`, `Brand.tsx`, `Algo.tsx`, `account.ts`, `admin/src/Badges.tsx`, `Referral.tsx`, `Follow.tsx`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Should `0024_sujets_suivis.sql` be split into smaller, more focused modules?**
  _Cohesion score 0.11229946524064172 - nodes in this community are weakly interconnected._
- **Why does `Main()` connect `app/App.tsx` to `ShareCard.tsx`, `brand.ts`, `app/src/Premium.tsx`, `Feed.tsx`, `Screens.tsx`, `account.ts`, `edition.ts`, `Topics.tsx`, `headline.ts`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Should `src/App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07344632768361582 - nodes in this community are weakly interconnected._
- **Why does `auth.users` connect `auth.users` to `0024_sujets_suivis.sql`, `public.app_settings`, `anon`, `public.article_emojis`, `0009_moderation_gestion.sql`, `public.articles`, `0025_regie_objectifs.sql`, `0022_reconnaissance.sql`, `0015_algorithme.sql`, `0002_roles.sql`, `public.profiles`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Should `data.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04519774011299435 - nodes in this community are weakly interconnected._
- **Should `Api` be split into smaller, more focused modules?**
  _Cohesion score 0.03636363636363636 - nodes in this community are weakly interconnected._