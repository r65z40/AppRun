-- Algorithme « Mon édition » (cahier des charges §16), sans IA : des points, des mots-clés et des règles réglables.
--   • l'app note ce que fait le lecteur (temps sur la carte, « Lire », source, partage, « Moins de sujets comme ça ») ;
--   • likes, dislikes et commentaires viennent des tables existantes ;
--   • chaque signal donne des points à une rubrique et aux mots-clés de l'info, points qui perdent la moitié
--     de leur valeur en 21 jours ;
--   • l'édition = sujets majeurs pour tous + infos choisies selon les goûts + découverte.
-- Tout se règle dans le back office (Lecteurs > Algorithme) : poids, proportions, mots-clés.

-- 1. Réglages : un seul réglage ALGO (JSON), complété par les valeurs par défaut ------------------------
insert into public.setting_keys (key) values ('ALGO') on conflict do nothing;

create or replace function public.algo_defaults() returns jsonb language sql immutable as $$
  select '{
    "enabled": true,
    "share_essential": 25, "share_discovery": 12,
    "w_importance": 45, "w_affinity": 35, "w_collective": 10, "w_fresh": 10,
    "affinity_start": 10, "ramp": 50, "half_life": 21, "smooth": 5,
    "skip_ms": 2000, "long_ms": 12000, "min_views": 200, "max_rubric": 50, "keep_days": 90,
    "signals": {"click": 3, "share": 3, "summary_end": 2, "like": 2, "comment": 2, "summary": 1.5,
                "source": 1, "long": 1, "back": 0.5, "skip": -0.5, "dislike": -0.5, "less": -3}
  }'::jsonb;
$$;

-- Réglages en vigueur : ceux du back office par-dessus les valeurs par défaut (un JSON abîmé est ignoré).
create or replace function public.algo_conf() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d jsonb := public.algo_defaults(); s jsonb;
begin
  begin s := (select value::jsonb from public.app_settings where key = 'ALGO'); exception when others then s := null; end;
  if jsonb_typeof(s) is distinct from 'object' then return d; end if;
  return d || (s - 'signals') || jsonb_build_object('signals', d->'signals' || coalesce(case when jsonb_typeof(s->'signals') = 'object' then s->'signals' end, '{}'));
end $$;

-- 2. Mots-clés (liste gérée par l'équipe) et mots-clés repérés dans chaque info -------------------------
create table if not exists public.algo_keywords (
  id bigint generated always as identity primary key,
  label text not null unique check (char_length(label) between 2 and 40),
  words text[] not null default '{}',   -- variantes cherchées dans le texte (le libellé est toujours cherché)
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.algo_keywords enable row level security;
drop policy if exists algo_keywords_staff on public.algo_keywords;
create policy algo_keywords_staff on public.algo_keywords for all using (public.is_staff()) with check (public.is_staff());
revoke all on public.algo_keywords from anon;

create table if not exists public.article_topics (
  article_id uuid primary key references public.articles (id) on delete cascade,
  topics text[] not null default '{}'
);
alter table public.article_topics enable row level security;
drop policy if exists article_topics_staff on public.article_topics;
create policy article_topics_staff on public.article_topics for select using (public.is_staff());
revoke all on public.article_topics from anon;

-- Mots-clés d'une info, par fréquence : une occurrence dans le titre compte double, 6 mots-clés au plus.
-- Le texte de l'info est normalisé une seule fois (« materialized » : sinon une fois par mot-clé, ~300 ms par article,
-- et l'installation de la base expirait). norm_text ne garde que des lettres et des espaces simples : un mot est compté
-- « entouré d'espaces », par remplacement, sans expression régulière.
create or replace function public.word_count(hay text, w text) returns int language sql immutable as $$
  select (length(hay) - length(replace(hay, ' ' || w || ' ', ' '))) / (length(w) + 1);
$$;
create or replace function public.find_topics(title text, body text) returns text[]
language sql stable security definer set search_path = public as $$
  with t as materialized (select ' ' || replace(public.norm_text(title), ' ', '  ') || ' ' as ti, ' ' || replace(public.norm_text(body), ' ', '  ') || ' ' as bo),
  hits as (
    select k.label, sum(2 * public.word_count(t.ti, replace(w, ' ', '  ')) + public.word_count(t.bo, replace(w, ' ', '  '))) as n
      from public.algo_keywords k, t,
           lateral (select distinct trim(public.norm_text(x)) as w from unnest(k.words || k.label) x) v
     where k.active and v.w <> ''
     group by k.label
  )
  select coalesce(array_agg(label order by n desc, label), '{}') from (select * from hits where n > 0 order by n desc, label limit 6) h;
$$;

create or replace function public.article_text(a public.articles) returns text language sql immutable as $$
  select concat_ws(' ', a.key_sentence,
    (select string_agg(f->>'text', ' ') from jsonb_array_elements(coalesce(a.facts, '[]')) f),
    (select string_agg(s, ' ') from jsonb_array_elements_text(coalesce(a.summary, '[]')) s));
$$;

create or replace function public.tag_article() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.article_topics (article_id, topics) values (new.id, public.find_topics(new.title, public.article_text(new)))
  on conflict (article_id) do update set topics = excluded.topics;
  return new;
end $$;
drop trigger if exists articles_topics on public.articles;
create trigger articles_topics after insert or update of title, key_sentence, facts, summary on public.articles
for each row execute function public.tag_article();

-- Liste de mots-clés modifiée : les infos récentes sont réétiquetées tout de suite.
create or replace function public.retag_articles() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.article_topics (article_id, topics)
  select a.id, public.find_topics(a.title, public.article_text(a)) from public.articles a
   where a.edition_date >= current_date - (public.algo_conf()->>'keep_days')::int
  on conflict (article_id) do update set topics = excluded.topics;
  return null;
end $$;
drop trigger if exists algo_keywords_retag on public.algo_keywords;
create trigger algo_keywords_retag after insert or update or delete on public.algo_keywords
for each statement execute function public.retag_articles();

-- 3. Journal de lecture (écrit par l'app, lu seulement par les calculs ci-dessous) ----------------------
create table if not exists public.reading_events (
  id bigint generated always as identity primary key,
  device text not null check (char_length(device) between 8 and 64),
  user_id uuid references auth.users (id) on delete cascade,
  article_id uuid not null references public.articles (id) on delete cascade,
  kind text not null check (kind in ('view', 'summary', 'summary_end', 'source', 'click', 'share', 'back', 'less')),
  ms int,
  at timestamptz not null default now()
);
create index if not exists reading_events_user on public.reading_events (user_id, at);
create index if not exists reading_events_device on public.reading_events (device, at);
create index if not exists reading_events_article on public.reading_events (article_id);
alter table public.reading_events enable row level security;
revoke all on public.reading_events from anon, authenticated;

-- « Remettre mes goûts à zéro » : les signaux plus anciens sont ignorés (likes compris).
create table if not exists public.taste_resets (
  who text primary key,               -- identifiant du compte, ou « d: » + appareil sans compte
  at timestamptz not null default now()
);
alter table public.taste_resets enable row level security;
revoke all on public.taste_resets from anon, authenticated;

-- L'app envoie ses signaux par paquets : [{ "a": id de l'info, "k": type, "ms": durée }].
-- Au premier envoi connecté, les signaux de l'appareil passent sur le compte (rien n'est perdu à l'inscription).
create or replace function public.track(d text, ev jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if char_length(coalesce(d, '')) not between 8 and 64 or jsonb_typeof(ev) <> 'array' then return; end if;
  if auth.uid() is not null then
    update public.reading_events set user_id = auth.uid() where device = d and user_id is null;
  end if;
  insert into public.reading_events (device, user_id, article_id, kind, ms)
  select d, auth.uid(), a.id, e->>'k', least(greatest((e->>'ms')::int, 0), 600000)
    from (select value e from jsonb_array_elements(ev) limit 100) x
    join public.articles a on a.id::text = e->>'a' and a.status = 'published'
   where e->>'k' in ('view', 'summary', 'summary_end', 'source', 'click', 'share', 'back', 'less');
end $$;
grant execute on function public.track(text, jsonb) to anon, authenticated;

create or replace function public.reset_taste(d text) returns void
language sql security definer set search_path = public as $$
  delete from public.reading_events where (auth.uid() is not null and user_id = auth.uid()) or (device = d and user_id is null);
  insert into public.taste_resets (who, at) values (coalesce(auth.uid()::text, 'd:' || d), now())
  on conflict (who) do update set at = now();
$$;
grant execute on function public.reset_taste(text) to anon, authenticated;

-- 4. Profil de goûts : points par rubrique et par mot-clé, qui s'effacent avec le temps --------------------
-- Lecteur connecté : uid ; sans compte : son appareil (dev). Renvoie
-- { rubrics: {id: points}, topics: {mot-clé: points}, n: nombre de signaux }.
create or replace function public.reader_taste(uid uuid, dev text) returns jsonb
language sql stable security definer set search_path = public as $$
  with c as (select public.algo_conf() c),
  since as (
    select greatest(now() - make_interval(days => (c->>'keep_days')::int),
                    coalesce((select at from public.taste_resets where who = coalesce(uid::text, 'd:' || dev)), '-infinity')) t
      from c
  ),
  sig as (
    select e.article_id, e.at,
           case when e.kind <> 'view' then (c->'signals'->>e.kind)::numeric
                when e.ms < (c->>'skip_ms')::int then (c->'signals'->>'skip')::numeric
                when e.ms >= (c->>'long_ms')::int then (c->'signals'->>'long')::numeric
                else 0 end as w
      from public.reading_events e, c, since
     where e.at > since.t and ((uid is not null and e.user_id = uid) or (uid is null and e.device = dev and e.user_id is null))
    union all
    select r.article_id, r.created_at, (c->'signals'->>case when r.value = 1 then 'like' else 'dislike' end)::numeric
      from public.reactions r, c, since where uid is not null and r.user_id = uid and r.created_at > since.t
    union all
    select distinct on (m.article_id) m.article_id, m.created_at, (c->'signals'->>'comment')::numeric
      from public.comments m, c, since where uid is not null and m.user_id = uid and m.created_at > since.t
  ),
  w as (
    select s.article_id, s.w * power(0.5, extract(epoch from now() - s.at) / 86400 / (c->>'half_life')::numeric) as w
      from sig s, c where s.w <> 0
  )
  select jsonb_build_object(
    'rubrics', coalesce((select jsonb_object_agg(rubric_id, round(p, 2)) from (
        select a.rubric_id, sum(w.w) p from w join public.articles a on a.id = w.article_id group by a.rubric_id) x), '{}'),
    'topics', coalesce((select jsonb_object_agg(t, round(p, 2)) from (
        select t, sum(w.w) p from w join public.article_topics at on at.article_id = w.article_id, unnest(at.topics) t
         group by t order by abs(sum(w.w)) desc limit 100) y), '{}'),
    'n', (select count(*) from w));
$$;
revoke all on function public.reader_taste(uuid, text) from public, anon, authenticated;

-- 5. L'édition d'un lecteur --------------------------------------------------------------------------
-- Toutes les infos publiées de la dernière édition, dans l'ordre où le lecteur doit les voir : d'abord les
-- `quota` cartes de son édition (slot ess / pv / dec), puis le reste pour « Charger plus » (slot more).
create or replace function public.compose_edition(uid uuid, dev text, active text[], quota int, perso boolean default true)
returns table (article_id uuid, slot text, reason text, score numeric, pos int)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  c jsonb := public.algo_conf();
  taste jsonb := case when perso and (c->>'enabled')::boolean then public.reader_taste(uid, dev) else '{"rubrics":{},"topics":{},"n":0}' end;
  k numeric := greatest((c->>'smooth')::numeric, 0.1);
  wa numeric; wi numeric;
  n_ess int; n_dec int; cap int;
  ed date := (select e.date from public.editions e where e.status = 'published' order by e.date desc limit 1);
  r record; prev1 text; prev2 text; i int := 0; mid int;
begin
  quota := least(greatest(coalesce(quota, 8), 1), 100);
  active := coalesce(active, '{}');
  -- Le poids des goûts monte avec le nombre de signaux ; ce qu'il ne prend pas va à l'importance.
  wa := case when not (perso and (c->>'enabled')::boolean) then 0
             else (c->>'affinity_start')::numeric + ((c->>'w_affinity')::numeric - (c->>'affinity_start')::numeric)
                  * least(1, (taste->>'n')::numeric / greatest((c->>'ramp')::numeric, 1)) end;
  wi := (c->>'w_importance')::numeric + (c->>'w_affinity')::numeric - wa;
  n_ess := greatest(1, round(quota * (c->>'share_essential')::numeric / 100));
  n_dec := case when (c->>'share_discovery')::numeric > 0 then greatest(1, round(quota * (c->>'share_discovery')::numeric / 100)) else 0 end;
  cap := case when cardinality(active) <= 2 then quota else greatest(1, ceil(quota * (c->>'max_rubric')::numeric / 100)) end;

  create temp table if not exists _cand (id uuid, rubric text, rname text, essential boolean, importance int,
    aff numeric, fav text, sc numeric, slot text, why text, ord int) on commit drop;
  truncate _cand;

  insert into _cand (id, rubric, rname, essential, importance, aff, fav, sc)
  with art as (
    select a.id, a.rubric_id, rb.name, a.essential, a.importance, coalesce(a.published_at, a.created_at) as at,
           coalesce(t.topics, '{}') as topics
      from public.articles a join public.rubrics rb on rb.id = a.rubric_id
      left join public.article_topics t on t.article_id = a.id
     where a.edition_date = ed and a.status = 'published'
       -- « Moins de sujets comme ça » : cette info-là ne revient pas.
       and not exists (select 1 from public.reading_events e where e.article_id = a.id and e.kind = 'less'
                        and ((uid is not null and e.user_id = uid) or (uid is null and e.device = dev)))
  ),
  -- Intérêt collectif : part des lecteurs qui ouvrent, partagent ou cliquent (rang parmi les infos assez vues).
  coll as (
    select e.article_id, count(distinct e.device) filter (where e.kind = 'view') as views,
           count(distinct e.device) filter (where e.kind = 'summary') + 2 * count(distinct e.device) filter (where e.kind in ('share', 'click')) as eng
      from public.reading_events e where e.article_id in (select id from art) group by e.article_id
  ),
  coll_rank as (
    select article_id, percent_rank() over (order by eng::numeric / views) as pr
      from coll where views >= (c->>'min_views')::int
  ),
  aff as (
    select art.*,
           0.5 + 0.5 * coalesce((taste->'rubrics'->>art.rubric_id)::numeric, 0) / (abs(coalesce((taste->'rubrics'->>art.rubric_id)::numeric, 0)) + k) as ra,
           (select t from unnest(art.topics) t where (taste->'topics'->>t)::numeric > 0 order by (taste->'topics'->>t)::numeric desc limit 1) as fav
      from art
  ),
  aff2 as (
    select aff.*, coalesce((select avg(case when taste->'topics' ? t
                    then 0.5 + 0.5 * (taste->'topics'->>t)::numeric / (abs((taste->'topics'->>t)::numeric) + k) else aff.ra end)
                  from unnest(aff.topics) t), aff.ra) as ta
      from aff
  )
  select a2.id, a2.rubric_id, a2.name, a2.essential, a2.importance, (a2.ra + a2.ta) / 2, a2.fav,
         (wi * a2.importance / 10.0
          + wa * (a2.ra + a2.ta) / 2
          + (c->>'w_collective')::numeric * coalesce((select pr from coll_rank where coll_rank.article_id = a2.id), 0.5)
          + (c->>'w_fresh')::numeric * greatest(0, 1 - extract(epoch from now() - a2.at) / 86400)) / 100
    from aff2 a2;

  -- À ne pas manquer : les sujets majeurs du jour, pour tout le monde.
  update _cand set slot = 'ess', why = 'Sujet majeur du jour, proposé à tout le monde.'
   where id in (select id from _cand order by essential desc, importance desc, sc desc limit n_ess);
  -- Découverte : un sujet important d'une rubrique non suivie (sinon de la rubrique la moins lue).
  update _cand set slot = 'dec', why = 'Pour découvrir la rubrique ' || rname || '.'
   where id in (select id from _cand where slot is null
                 order by (rubric = any (active)), aff, importance desc, sc desc limit n_dec);
  -- Pour vous : meilleurs scores dans les rubriques suivies, sans qu'une rubrique prenne plus que sa part.
  for r in select * from _cand where slot is null order by (rubric = any (active)) desc, sc desc loop
    exit when (select count(*) from _cand where slot is not null) >= quota;
    continue when (select count(*) from _cand where _cand.rubric = r.rubric and slot is not null) >= cap
              and exists (select 1 from _cand x where x.slot is null and x.id <> r.id and (select count(*) from _cand y where y.rubric = x.rubric and y.slot is not null) < cap);
    update _cand set slot = 'pv', why = case when r.fav is not null then 'Vous lisez souvent : ' || r.fav || '.'
                                             when r.rubric = any (active) then 'Vous suivez la rubrique ' || r.rname || '.'
                                             else 'Une info importante du jour.' end
     where id = r.id;
  end loop;

  -- Ordre : les sujets majeurs en tête (d'abord celui qui vous parle le plus), puis le meilleur score
  -- en évitant trois infos de suite de la même rubrique ; la découverte au milieu.
  update _cand set ord = 0 where id = (select id from _cand where slot = 'ess' order by aff desc, sc desc limit 1);
  prev1 := (select rubric from _cand where ord = 0);
  mid := (select count(*) from _cand where slot is not null) / 2;
  loop
    i := i + 1;
    select * into r from _cand where ord is null and slot is not null
     order by (slot = 'ess') desc, (slot = 'dec' and i >= mid) desc, (slot = 'dec') asc,
              coalesce(rubric = prev1 and rubric = prev2, false) asc, aff desc, sc desc limit 1;
    exit when not found;
    update _cand set ord = i where id = r.id;
    prev2 := prev1; prev1 := r.rubric;
  end loop;
  -- Après l'édition : tout le reste, pour « Charger plus ».
  update _cand set slot = 'more', why = 'Pour aller plus loin aujourd''hui.',
         ord = 1000 + x.n from (select id, row_number() over (order by sc desc) n from _cand where slot is null) x where _cand.id = x.id;

  return query select _cand.id, _cand.slot, _cand.why, round(_cand.sc, 3), _cand.ord from _cand order by _cand.ord;
end $$;
revoke all on function public.compose_edition(uuid, text, text[], int, boolean) from public, anon, authenticated;

-- Pour l'app : l'édition du lecteur connecté, ou de l'appareil sans compte.
create or replace function public.my_edition(d text, active text[], quota int, perso boolean default true)
returns table (article_id uuid, slot text, reason text, pos int)
language sql security definer set search_path = public as $$
  select e.article_id, e.slot, e.reason, e.pos from public.compose_edition(auth.uid(), d, active, quota, perso) e;
$$;
grant execute on function public.my_edition(text, text[], int, boolean) to anon, authenticated;

-- 6. Back office ------------------------------------------------------------------------------------------
-- Fiche d'un lecteur : ses goûts et l'édition qu'il recevrait maintenant (avec ses rubriques et son quota).
create or replace function public.admin_reader_algo(uid uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.profiles; act text[]; qt int;
begin
  if not public.is_staff() then raise exception 'Réservé à l''équipe'; end if;
  select * into p from public.profiles where id = uid;
  act := coalesce((select array_agg(x) from jsonb_array_elements_text(case when jsonb_typeof(p.prefs->'active') = 'array' then p.prefs->'active' end) x), '{}');
  qt := coalesce((p.prefs->>'quota')::int, 8);
  return jsonb_build_object(
    'taste', public.reader_taste(uid, null), 'active', act, 'quota', qt,
    'edition', coalesce((select jsonb_agg(jsonb_build_object('title', a.title, 'rubric', a.rubric_id, 'slot', e.slot, 'reason', e.reason, 'score', e.score) order by e.pos)
                 from public.compose_edition(uid, null, act, qt) e join public.articles a on a.id = e.article_id where e.slot <> 'more'), '[]'));
end $$;
revoke all on function public.admin_reader_algo(uuid) from public, anon;
grant execute on function public.admin_reader_algo(uuid) to authenticated;

-- Statistiques des 7 derniers jours.
create or replace function public.algo_stats() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Réservé à l''équipe'; end if;
  return jsonb_build_object(
    'readers_7', (select count(distinct coalesce(user_id::text, device)) from public.reading_events where at > now() - interval '7 days'),
    'events_7', coalesce((select jsonb_object_agg(kind, n) from (select kind, count(*) n from public.reading_events where at > now() - interval '7 days' group by kind) x), '{}'),
    'likes_7', (select count(*) from public.reactions where value = 1 and created_at > now() - interval '7 days'),
    'dislikes_7', (select count(*) from public.reactions where value = -1 and created_at > now() - interval '7 days'),
    'resets_7', (select count(*) from public.taste_resets where at > now() - interval '7 days'),
    'topics', coalesce((select jsonb_agg(jsonb_build_object('topic', t, 'articles', n_a, 'reads', n_r) order by n_r desc) from (
        select t.t, count(distinct x.article_id) n_a, count(e.id) filter (where e.kind in ('summary', 'click', 'share')) n_r
          from public.article_topics x
          join public.articles a on a.id = x.article_id
          cross join lateral unnest(x.topics) t(t)
          left join public.reading_events e on e.article_id = x.article_id and e.at > now() - interval '7 days'
         where a.edition_date > current_date - 7 group by t.t order by 3 desc, 2 desc limit 15) y), '[]'),
    'untagged', (select count(*) from public.articles a left join public.article_topics t on t.article_id = a.id
                  where a.edition_date > current_date - 7 and a.status = 'published' and coalesce(cardinality(t.topics), 0) = 0));
end $$;
revoke all on function public.algo_stats() from public, anon;
grant execute on function public.algo_stats() to authenticated;

-- Journal de lecture plus vieux que la durée de conservation : effacé (appelé par le moteur).
create or replace function public.purge_reading_events() returns int
language sql security definer set search_path = public as $$
  with d as (delete from public.reading_events where at < now() - make_interval(days => (public.algo_conf()->>'keep_days')::int) returning 1)
  select count(*)::int from d;
$$;
revoke all on function public.purge_reading_events() from public, anon, authenticated;

-- 7. Mots-clés de départ (modifiables dans le back office) ------------------------------------------------
-- Volontairement aucun parti, candidat ni religion : on ne profile pas les opinions (RGPD art. 9).
insert into public.algo_keywords (label, words) values
  ('IA', '{intelligence artificielle,ChatGPT,OpenAI,Mistral AI,algorithme}'),
  ('Cybersécurité', '{cyberattaque,piratage,rançongiciel,hacker,fuite de données}'),
  ('Smartphones', '{iPhone,Android,smartphone,téléphone portable}'),
  ('Espace', '{fusée,satellite,Nasa,ESA,astronaute,Lune}'),
  ('Santé', '{hôpital,médecin,vaccin,épidémie,maladie,Sécurité sociale}'),
  ('Climat', '{réchauffement,canicule,CO2,émissions,COP,sécheresse}'),
  ('Énergie', '{électricité,nucléaire,EDF,pétrole,gaz,solaire,éolien}'),
  ('Transports', '{SNCF,train,TGV,métro,aérien,avion,grève des transports}'),
  ('Automobile', '{voiture,véhicule électrique,Renault,Stellantis,Tesla}'),
  ('Immobilier', '{logement,loyer,crédit immobilier,prix de l''immobilier}'),
  ('Emploi', '{chômage,embauche,licenciement,salaire,France Travail}'),
  ('Inflation', '{pouvoir d''achat,hausse des prix,BCE,taux d''intérêt}'),
  ('Impôts', '{fiscalité,impôt,taxe,TVA,budget}'),
  ('Retraites', '{retraite,pension,réforme des retraites}'),
  ('Bourse', '{CAC 40,marchés financiers,actionnaires,Wall Street}'),
  ('Entreprises', '{start-up,startup,PME,rachat,chiffre d''affaires}'),
  ('Agriculture', '{agriculteur,agricole,récolte,élevage,PAC}'),
  ('Éducation', '{école,lycée,université,enseignant,bac,élève}'),
  ('Justice', '{procès,tribunal,condamné,juge,enquête}'),
  ('Sécurité', '{police,gendarmerie,délinquance,attentat}'),
  ('Élections', '{élection,scrutin,vote,sondage,campagne électorale}'),
  ('Parlement', '{Assemblée nationale,Sénat,député,sénateur,projet de loi}'),
  ('Europe', '{Union européenne,UE,Bruxelles,Commission européenne,Parlement européen}'),
  ('États-Unis', '{Washington,Maison Blanche,américain,Congrès américain}'),
  ('Chine', '{Pékin,chinois}'),
  ('Ukraine', '{Kiev,Russie,Moscou,Kremlin}'),
  ('Proche-Orient', '{Israël,Gaza,Liban,Iran,Palestinien}'),
  ('Afrique', '{africain,Sahel,Maghreb}'),
  ('Football', '{Ligue 1,Ligue des champions,PSG,Mbappé,footballeur}'),
  ('Rugby', '{XV de France,Top 14,Six Nations}'),
  ('Tennis', '{Roland-Garros,Wimbledon,ATP,WTA}'),
  ('Cyclisme', '{Tour de France,vélo,peloton}'),
  ('Formule 1', '{F1,Grand Prix}'),
  ('Jeux olympiques', '{JO,olympique,paralympique}'),
  ('Cinéma', '{film,festival de Cannes,box-office,réalisateur}'),
  ('Musique', '{concert,album,chanteur,chanteuse,festival}'),
  ('Livres', '{roman,écrivain,prix Goncourt,librairie}'),
  ('Séries', '{série,Netflix,streaming}'),
  ('Jeux vidéo', '{jeu vidéo,console,PlayStation,Nintendo,Xbox}'),
  ('Environnement', '{biodiversité,pollution,océan,forêt,recyclage}')
on conflict (label) do nothing;
