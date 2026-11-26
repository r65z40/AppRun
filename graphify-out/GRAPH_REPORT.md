# Graph Report - AppRun  (2026-11-26)

## Corpus Check
- 132 files · ~153,749 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: (none) 4, .xml 4, .example 3)

## Summary
- 1426 nodes · 3433 edges · 76 communities (52 shown, 24 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0ed7cefb`
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
- public.articles
- app/App.tsx
- Brand.tsx
- auth.users
- brand.ts
- Feed.tsx
- Algo.tsx
- Screens.tsx
- run.ts
- selectStories
- iphone-gratuit.js
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
- 0015_algorithme.sql
- Back office TITRE
- TITRE : essayer l'app sur iPhone
- anon
- setup-sql.sh
- run-local.sh
- 0022_reconnaissance.sql
- 0025_regie_objectifs.sql
- 0001_init.sql
- 0023_parrainage.sql
- q
- account.ts
- src/tdm.ts
- 0002_roles.sql
- Topics.tsx
- algo.sql
- follow.sql
- public.dispatch_workflow
- Passer sur un serveur à soi (plus tard)
- public
- cron.sh
- public.flashes
- ShareCard.tsx
- 0030_securite_perfs.sql
- Cost.tsx
- public.dashboard

## God Nodes (most connected - your core abstractions)
1. `Main()` - 76 edges
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
- `profiles_pseudo_lower` --indexes--> `public.profiles`  [EXTRACTED]
  backend/supabase/migrations/0006_community.sql → backend/supabase/migrations/0001_init.sql
- `public.pseudo_free()` --reads_from--> `public.profiles`  [EXTRACTED]
  backend/supabase/migrations/0006_community.sql → backend/supabase/migrations/0001_init.sql

## Import Cycles
- 2-file cycle: `admin/src/data.ts -> admin/src/demo.ts -> admin/src/data.ts`

## Communities (76 total, 24 thin omitted)

### Community 0 - "0024_sujets_suivis.sql"
Cohesion: 0.15
Nodes (23): public.algo_keywords, public.article_topics, public.find_topics(), algo_keywords_retag_flashes, public.drop_push(), public.follow_conf(), public.follow_stats(), public.follow_topic() (+15 more)

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
Nodes (30): CardSchema, checkCard(), checkFlash(), clamp(), cleanFacts(), cleanStories(), Flashes, FlashOut (+22 more)

### Community 6 - "Ads.tsx"
Cohesion: 0.09
Nodes (32): AdsPage(), Campaign, CampaignForm(), days(), dayShift(), demoList, demoStats, Draft (+24 more)

### Community 7 - "public.articles"
Cohesion: 0.18
Nodes (14): public.articles, public.editions, public.rubrics, public.top_articles(), public.article_emoji_stats, public.article_emojis, _cand, public.compose_edition() (+6 more)

### Community 8 - "app/App.tsx"
Cohesion: 0.05
Nodes (66): AccountAsk, App(), appScreen(), editionSig(), fetchPicks(), framed(), Main(), Overlay (+58 more)

### Community 9 - "Brand.tsx"
Cohesion: 0.08
Nodes (39): Brand, BrandPage(), COLORS, DAYS, FONT_CSS, FONTS, FORMATS, HOURS (+31 more)

### Community 10 - "auth.users"
Cohesion: 0.13
Nodes (16): articles_audit, audit_log_at, comments_audit, flashes_audit, profiles_audit, public.admin_audit(), public.audit(), public.audit_log (+8 more)

### Community 11 - "brand.ts"
Cohesion: 0.06
Nodes (44): Boot(), BadgeToast(), s, SavedTime(), Spark(), apply(), applyRules(), applyShare() (+36 more)

### Community 12 - "Feed.tsx"
Cohesion: 0.11
Nodes (43): BadgeIcons(), BadgeList(), pseudoColor(), ReaderCardView(), flashTime(), rubricOf(), summaryOf(), Background() (+35 more)

### Community 13 - "Algo.tsx"
Cohesion: 0.10
Nodes (20): AlgoConf, AlgoPage(), DEFAULTS, demoReader, demoStats, demoWords, Keyword, ok() (+12 more)

### Community 14 - "Screens.tsx"
Cohesion: 0.11
Nodes (41): legalText(), cap(), dayLabel(), fmt(), isoDay(), shortDay(), todayLabel(), tomorrowLabel() (+33 more)

### Community 15 - "run.ts"
Cohesion: 0.14
Nodes (20): cardText(), cleanAngles(), doubtIssue(), minorIssue(), setRubricHints(), Story, Alert, sendTopicAlerts() (+12 more)

### Community 16 - "selectStories"
Cohesion: 0.24
Nodes (16): api(), EFFORT(), from(), judgeComments(), lightModel(), mockCard(), reviewText(), rubricList() (+8 more)

### Community 17 - "iphone-gratuit.js"
Cohesion: 0.25
Nodes (4): app, { execSync }, fs, original

### Community 18 - "guard.ts"
Cohesion: 0.13
Nodes (13): AiStopped, budget, CardOut, Item, budget27, clean, invented, items (+5 more)

### Community 19 - "edition.ts"
Cohesion: 0.07
Nodes (41): adHit(), ADS, DEMO, Ev, flush(), key(), loadAds(), pickAds() (+33 more)

### Community 20 - "admin/src/Badges.tsx"
Cohesion: 0.11
Nodes (17): Badge, BadgeRow(), BadgesPage(), Conf, CONF, ConfPanel(), demo, demoHolders (+9 more)

### Community 21 - "Essayer TITRE en vrai (environ 15 minutes)"
Cohesion: 0.10
Nodes (17): Algorithme « Mon édition » (sans IA), Ce qui reste ouvert, Dernière minute, En local, Moteur de contenu TITRE, Sujets suivis, À brancher (une fois), 1. Supabase : créer la base et noter 3 valeurs (5 min) (+9 more)

### Community 22 - "flash.ts"
Cohesion: 0.14
Nodes (19): cost(), model(), usage, cfg, snapshot(), alerts(), args, AUTO (+11 more)

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

### Community 30 - "public.profiles"
Cohesion: 0.13
Nodes (26): public.profiles, promo_attempts_user, public.admin_grant_premium(), public.admin_revoke_premium(), public.admin_sub_events(), public.admin_subscribers(), public.apply_store_event(), public.expire_premium() (+18 more)

### Community 31 - "collect.ts"
Cohesion: 0.18
Nodes (14): collect(), collectAll(), CollectResult, slug(), Source, arr(), clean(), FeedItem (+6 more)

### Community 32 - "À faire une fois (environ 1 heure, hors délais de validation Apple et Google)"
Cohesion: 0.22
Nodes (8): 1. Les stores, 2. RevenueCat (gratuit jusqu'à 2 500 $ de revenus par mois), 3. Le webhook (RevenueCat prévient la base), 4. L'app, Bon à savoir, Ce qui est déjà fait dans le code, TITRE Premium : mettre en route les abonnements, À faire une fois (environ 1 heure, hors délais de validation Apple et Google)

### Community 33 - "public.app_settings"
Cohesion: 0.07
Nodes (27): public.admin_settings(), public.app_settings, public.handle_new_user(), public.needs_admin(), public.set_setting(), public.set_setting(), public.set_setting(), public.has_insult() (+19 more)

### Community 34 - "0015_algorithme.sql"
Cohesion: 0.16
Nodes (17): public.article_stats, public.reactions, algo_keywords_retag, articles_topics, public.admin_reader_algo(), public.algo_stats(), public.purge_reading_events(), public.reader_taste() (+9 more)

### Community 35 - "Back office TITRE"
Cohesion: 0.33
Nodes (5): Back office TITRE, Ce qu'on y fait, En local, Mettre en ligne (gratuit, GitHub Pages), Premier accès

### Community 36 - "TITRE : essayer l'app sur iPhone"
Cohesion: 0.25
Nodes (7): Ce qu'il faut, La vraie app sur iPhone sans payer (7 jours), La vraie app sur iPhone sans payer et sans Mac (7 jours), Lancer (5 minutes la première fois), Le widget « Titre du jour » (écran d'accueil), TITRE : essayer l'app sur iPhone, À essayer

### Community 38 - "anon"
Cohesion: 0.12
Nodes (14): engine_runs_started, public.engine_runs, public.setting_json(), public.setting_int(), public.ai_spend(), public.check_referral(), public.claim_referral(), public.follow_who() (+6 more)

### Community 44 - "0022_reconnaissance.sql"
Cohesion: 0.22
Nodes (11): profiles_created, public.badge_holders(), public.badges, public.badges_of(), public.grant_badge(), public.reader_card(), public.track(), public.user_badges (+3 more)

### Community 45 - "0025_regie_objectifs.sql"
Cohesion: 0.20
Nodes (14): public.ad_campaigns, public.ad_hit(), public.ad_stats, public.live_ads(), ad_impressions_at, ad_impressions_campaign, ad_impressions_device, ad_impressions_ip (+6 more)

### Community 46 - "0001_init.sql"
Cohesion: 0.23
Nodes (11): articles_edition, articles_touch, comments_article, public.is_staff(), public.raw_items, public.sources, public.touch_updated_at(), raw_items_published (+3 more)

### Community 47 - "0023_parrainage.sql"
Cohesion: 0.16
Nodes (10): on_auth_user_referral, public.link_referral(), public.my_referral(), public.referral_admin(), public.referral_codes, public.referral_from_signup(), public.referrals, public.user_reads_referral() (+2 more)

### Community 48 - "q"
Cohesion: 0.40
Nodes (4): pool, q(), DIR, migrate()

### Community 49 - "account.ts"
Cohesion: 0.05
Nodes (82): Account(), accountsOn, ago(), api(), auth(), back(), blockAuthor(), blockedCount() (+74 more)

### Community 51 - "src/tdm.ts"
Cohesion: 0.43
Nodes (6): AI_BOTS, aiBotsBlocked(), aiRefusal(), get(), tdmReserved(), b

### Community 52 - "0002_roles.sql"
Cohesion: 0.47
Nodes (5): on_auth_user_created, profiles_guard, public.guard_profile(), public.handle_new_user(), public.is_admin()

### Community 53 - "Topics.tsx"
Cohesion: 0.11
Nodes (30): articleTopics(), DEMO_LIST, DEMO_WORDS, demoHas(), demoRead(), demoState(), demoTimeline(), DRAWER (+22 more)

### Community 62 - "public.dispatch_workflow"
Cohesion: 0.28
Nodes (4): public.dispatch_log, public.dispatch_status(), public.dispatch_workflow(), public.launch_engine()

### Community 63 - "Passer sur un serveur à soi (plus tard)"
Cohesion: 0.25
Nodes (7): Ce qui est déjà prêt, Ce qui ne marchera plus pareil, Ce qui restera lié (et pourquoi), Coûts estimés par mois (ordre de grandeur, prix à vérifier le jour venu), Le serveur visé, Passer sur un serveur à soi (plus tard), Étapes, le jour venu

### Community 64 - "public"
Cohesion: 0.14
Nodes (29): public.comment_votes, public.comments, public.reports, comments_guard, profiles_pseudo_lower, public.article_comments(), public.auto_hide_reported(), public.guard_comment() (+21 more)

### Community 68 - "public.flashes"
Cohesion: 0.38
Nodes (6): flashes_published, flashes_touch, public.flashes, flashes_tag, public.tag_flash(), flashes_run

### Community 70 - "ShareCard.tsx"
Cohesion: 0.18
Nodes (14): SHARE, Job, plain(), Result, shareArticle(), ShareCardHost(), ShareCardView(), shareLink() (+6 more)

### Community 72 - "0030_securite_perfs.sql"
Cohesion: 0.33
Nodes (5): article_emojis_article, comment_votes_comment, comments_user, reactions_article, visits_user

### Community 76 - "Cost.tsx"
Cohesion: 0.31
Nodes (8): CostEstimate(), EFFORT, estimate(), eur(), fit(), Parts, PRICE, SpendDay

## Knowledge Gaps
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Api` connect `Api` to `src/App.tsx`, `data.ts`, `admin/src/Premium.tsx`, `Ads.tsx`, `Brand.tsx`, `Algo.tsx`, `account.ts`, `admin/src/Badges.tsx`, `Referral.tsx`, `Follow.tsx`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Should `0024_sujets_suivis.sql` be split into smaller, more focused modules?**
  _Cohesion score 0.1455026455026455 - nodes in this community are weakly interconnected._
- **Why does `feel()` connect `Feed.tsx` to `app/App.tsx`, `brand.ts`, `Screens.tsx`, `account.ts`, `Topics.tsx`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Should `src/App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06861239119303636 - nodes in this community are weakly interconnected._
- **Why does `auth.users` connect `auth.users` to `public`, `public.app_settings`, `0015_algorithme.sql`, `0024_sujets_suivis.sql`, `public.flashes`, `anon`, `public.articles`, `0022_reconnaissance.sql`, `0025_regie_objectifs.sql`, `0023_parrainage.sql`, `0002_roles.sql`, `public.profiles`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Should `data.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04519774011299435 - nodes in this community are weakly interconnected._
- **Should `Api` be split into smaller, more focused modules?**
  _Cohesion score 0.03636363636363636 - nodes in this community are weakly interconnected._