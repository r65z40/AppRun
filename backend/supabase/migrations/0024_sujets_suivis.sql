-- Suivre un sujet (« Ukraine », « Budget »…) : le lecteur suit un mot-clé, reçoit une alerte quand il bouge
-- et voit une petite frise de l'histoire (infos et Dernière minute qui en parlent).
--   • les sujets sont les mots-clés de l'algorithme (algo_keywords), gérés dans le back office ;
--   • une alerte = une notification envoyée par le moteur (service de notifications d'Expo, sans clé) ;
--   • jamais d'alerte pour un sujet sensible (migration 0016), ni pour une info publiée la nuit ;
--   • tout se règle dans le back office, Lecteurs > Sujets suivis (réglage JSON « FOLLOW »).

-- 1. Réglages ---------------------------------------------------------------------------------------------
insert into public.setting_keys (key) values ('FOLLOW') on conflict do nothing;

create or replace function public.follow_defaults() returns jsonb language sql immutable as $$
  select '{
    "enabled": true, "max_follows": 20,
    "alerts": true, "flashes": true, "min_importance": 6, "max_per_day": 3, "cooldown_hours": 4,
    "quiet_start": 22, "quiet_end": 8, "lookback_hours": 3,
    "timeline_days": 30, "timeline_max": 20,
    "alert_title": "{sujet}", "alert_body": "{titre}",
    "suggested": ["Ukraine", "Budget", "IA", "Climat", "Élections", "Football"]
  }'::jsonb;
$$;

-- Réglages en vigueur : ceux du back office par-dessus les valeurs par défaut (un JSON abîmé est ignoré).
create or replace function public.follow_conf() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s jsonb;
begin
  begin s := (select value::jsonb from public.app_settings where key = 'FOLLOW'); exception when others then s := null; end;
  return public.follow_defaults() || case when jsonb_typeof(s) = 'object' then s else '{}' end;
end $$;
grant execute on function public.follow_conf() to authenticated;

-- Heures calmes (heure de Paris) : de quiet_start à quiet_end, aucune alerte.
create or replace function public.follow_quiet(at timestamptz, c jsonb) returns boolean language sql stable as $$
  select case when qs = qe then false when qs < qe then h >= qs and h < qe else h >= qs or h < qe end
    from (select extract(hour from at at time zone 'Europe/Paris')::int h, (c->>'quiet_start')::int qs, (c->>'quiet_end')::int qe) x;
$$;

-- 2. Sujets proposés au suivi, et sujets des infos Dernière minute -----------------------------------------
-- Un mot-clé peut servir à l'algorithme sans être proposé au suivi (case dans le back office).
alter table public.algo_keywords add column if not exists followable boolean not null default true;
insert into public.algo_keywords (label, words) values
  ('Budget', '{budget de l''État,loi de finances,projet de budget,déficit public,dette publique,49.3}')
on conflict (label) do nothing;

-- Dernière minute : case « sujet sensible » (cochée par l'IA ou la rédaction) et mots-clés repérés.
alter table public.flashes add column if not exists sensitive boolean not null default false;
alter table public.flashes add column if not exists topics text[] not null default '{}';
create or replace function public.tag_flash() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.topics := public.find_topics(new.title, new.sentence);
  return new;
end $$;
drop trigger if exists flashes_tag on public.flashes;
create trigger flashes_tag before insert or update of title, sentence on public.flashes
for each row execute function public.tag_flash();
create or replace function public.retag_flashes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.flashes set topics = public.find_topics(title, sentence) where published_at > now() - interval '90 days';
  return null;
end $$;
drop trigger if exists algo_keywords_retag_flashes on public.algo_keywords;
create trigger algo_keywords_retag_flashes after insert or update or delete on public.algo_keywords
for each statement execute function public.retag_flashes();
update public.flashes set topics = public.find_topics(title, sentence) where published_at > now() - interval '90 days';

-- 3. Sujets suivis, téléphones à prévenir, alertes envoyées -------------------------------------------------
-- who : identifiant du compte, ou « d: » + appareil sans compte (comme taste_resets).
create table if not exists public.topic_follows (
  who text not null,
  topic text not null,
  alerts boolean not null default true,
  created_at timestamptz not null default now(),
  seen_at timestamptz not null default now(),
  primary key (who, topic)
);
create index if not exists topic_follows_topic on public.topic_follows (topic);
alter table public.topic_follows enable row level security;
revoke all on public.topic_follows from anon, authenticated;

-- Adresse de notification du téléphone (jeton Expo), donnée par l'app quand le lecteur accepte les alertes.
create table if not exists public.push_devices (
  token text primary key check (char_length(token) between 10 and 200),
  device text not null check (char_length(device) between 8 and 64),
  user_id uuid references auth.users (id) on delete cascade,
  platform text,
  updated_at timestamptz not null default now()
);
create index if not exists push_devices_user on public.push_devices (user_id);
create index if not exists push_devices_device on public.push_devices (device);
alter table public.push_devices enable row level security;
revoke all on public.push_devices from anon, authenticated;

create table if not exists public.topic_alerts (
  id bigint generated always as identity primary key,
  who text not null,
  topic text not null,
  item text not null,          -- « a: » + info, ou « f: » + Dernière minute
  title text,
  sent_at timestamptz not null default now()
);
create index if not exists topic_alerts_who on public.topic_alerts (who, sent_at);
create index if not exists topic_alerts_at on public.topic_alerts (sent_at);
alter table public.topic_alerts enable row level security;
revoke all on public.topic_alerts from anon, authenticated;

-- Identité du lecteur : son compte s'il est connecté (les sujets suivis sans compte passent alors sur le compte).
create or replace function public.follow_who(d text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if char_length(coalesce(d, '')) not between 8 and 64 then raise exception 'Appareil inconnu'; end if;
  if auth.uid() is null then return 'd:' || d; end if;
  insert into public.topic_follows (who, topic, alerts, created_at, seen_at)
  select auth.uid()::text, topic, alerts, created_at, seen_at from public.topic_follows where who = 'd:' || d
  on conflict do nothing;
  delete from public.topic_follows where who = 'd:' || d;
  return auth.uid()::text;
end $$;
revoke all on function public.follow_who(text) from public, anon, authenticated;

-- 4. Pour l'app -------------------------------------------------------------------------------------------
-- Ce que l'app affiche : réglages utiles, sujets proposés, sujets suivis avec le nombre d'infos nouvelles.
create or replace function public.my_topics(d text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c jsonb := public.follow_conf(); w text := public.follow_who(d);
begin
  return jsonb_build_object(
    'enabled', (c->>'enabled')::boolean, 'alerts', (c->>'alerts')::boolean, 'max', (c->>'max_follows')::int,
    'suggested', coalesce((select jsonb_agg(s order by o) from jsonb_array_elements_text(c->'suggested') with ordinality x(s, o)
                            where exists (select 1 from public.algo_keywords k where k.label = s and k.active and k.followable)), '[]'),
    'available', coalesce((select jsonb_agg(k.label order by k.label) from public.algo_keywords k where k.active and k.followable), '[]'),
    'following', coalesce((select jsonb_agg(jsonb_build_object('topic', f.topic, 'alerts', f.alerts,
        'new', (select count(*) from public.articles a join public.article_topics t on t.article_id = a.id
                 where a.status = 'published' and f.topic = any (t.topics) and a.published_at > f.seen_at)
             + (select count(*) from public.flashes x where x.status = 'published' and f.topic = any (x.topics) and x.published_at > f.seen_at),
        'last_at', greatest(
          (select max(a.published_at) from public.articles a join public.article_topics t on t.article_id = a.id
            where a.status = 'published' and f.topic = any (t.topics)),
          (select max(x.published_at) from public.flashes x where x.status = 'published' and f.topic = any (x.topics))))
        order by f.created_at)
      from public.topic_follows f join public.algo_keywords k on k.label = f.topic and k.active and k.followable
     where f.who = w), '[]'));
end $$;
grant execute on function public.my_topics(text) to anon, authenticated;

-- Suivre / ne plus suivre un sujet, et couper ou rétablir ses alertes.
create or replace function public.follow_topic(d text, topic text, follow boolean, alerts boolean default true) returns jsonb
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare c jsonb := public.follow_conf(); w text := public.follow_who(d);
begin
  if not follow then
    delete from public.topic_follows f where f.who = w and f.topic = follow_topic.topic;
    return public.my_topics(d);
  end if;
  if not (c->>'enabled')::boolean then raise exception 'Le suivi des sujets est coupé pour le moment.'; end if;
  if not exists (select 1 from public.algo_keywords k where k.label = follow_topic.topic and k.active and k.followable) then
    raise exception 'Ce sujet ne peut pas être suivi.';
  end if;
  if not exists (select 1 from public.topic_follows f where f.who = w and f.topic = follow_topic.topic)
     and (select count(*) from public.topic_follows f where f.who = w) >= (c->>'max_follows')::int then
    raise exception 'Vous suivez déjà % sujets : retirez-en un pour suivre celui-ci.', (c->>'max_follows')::int;
  end if;
  insert into public.topic_follows (who, topic, alerts) values (w, follow_topic.topic, coalesce(alerts, true))
  on conflict (who, topic) do update set alerts = excluded.alerts;
  return public.my_topics(d);
end $$;
grant execute on function public.follow_topic(text, text, boolean, boolean) to anon, authenticated;

-- Sujets (proposés au suivi) de chaque info de l'édition, pour les boutons « Suivre » de l'app.
create or replace function public.topics_of(ids uuid[]) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(t.article_id, to_jsonb(array(
           select x from unnest(t.topics) x where exists (select 1 from public.algo_keywords k where k.label = x and k.active and k.followable)))), '{}')
    from public.article_topics t join public.articles a on a.id = t.article_id
   where t.article_id = any (ids[1:200]) and a.status = 'published';
$$;
grant execute on function public.topics_of(uuid[]) to anon, authenticated;

-- La frise d'un sujet : ses infos et Dernière minute récentes, de la plus récente à la plus ancienne.
-- L'ouvrir remet le compteur « nouveau » à zéro pour ce lecteur.
create or replace function public.topic_timeline(d text, topic text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c jsonb := public.follow_conf(); w text := public.follow_who(d); f public.topic_follows;
begin
  select * into f from public.topic_follows x where x.who = w and x.topic = topic_timeline.topic;
  update public.topic_follows x set seen_at = now() where x.who = w and x.topic = topic_timeline.topic;
  return jsonb_build_object(
    'topic', topic, 'following', f.who is not null, 'alerts', coalesce(f.alerts, true),
    'items', coalesce((select jsonb_agg(i order by i.at desc) from (
      select * from (
        select 'a' as kind, a.id, a.title, a.key_sentence as sentence, a.rubric_id as rubric, a.importance, a.edition_date as edition,
               a.published_at as at, a.published_at > coalesce(f.seen_at, now()) as fresh
          from public.articles a join public.article_topics t on t.article_id = a.id
         where a.status = 'published' and topic_timeline.topic = any (t.topics)
           and a.published_at > now() - make_interval(days => (c->>'timeline_days')::int)
        union all
        select 'f', x.id, x.title, x.sentence, x.rubric_id, x.importance, null, x.published_at, x.published_at > coalesce(f.seen_at, now())
          from public.flashes x
         where x.status = 'published' and topic_timeline.topic = any (x.topics)
           and x.published_at > now() - make_interval(days => (c->>'timeline_days')::int)
      ) u order by at desc limit greatest((c->>'timeline_max')::int, 1)
    ) i), '[]'));
end $$;
grant execute on function public.topic_timeline(text, text) to anon, authenticated;

-- L'app donne l'adresse de notification du téléphone (et la reprend à la connexion ou à la déconnexion).
create or replace function public.register_push(d text, token text, platform text default null) returns void
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if char_length(coalesce(d, '')) not between 8 and 64 or char_length(coalesce(register_push.token, '')) not between 10 and 200 then return; end if;
  perform public.follow_who(d);
  insert into public.push_devices (token, device, user_id, platform, updated_at) values (register_push.token, d, auth.uid(), left(register_push.platform, 20), now())
  on conflict (token) do update set device = excluded.device, user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end $$;
grant execute on function public.register_push(text, text, text) to anon, authenticated;

-- 5. Pour le moteur : les alertes à envoyer maintenant (et notées comme envoyées) --------------------------
-- Une alerte par lecteur et par passage au plus : l'info la plus importante parmi ses sujets suivis, publiée
-- depuis peu, ni sensible ni publiée pendant les heures calmes, pas déjà signalée, un délai entre deux alertes
-- du même sujet et un plafond par jour.
create or replace function public.take_topic_alerts()
returns table (token text, title text, body text, topic text, item text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare c jsonb := public.follow_conf();
  day0 timestamptz := date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris';
begin
  delete from public.topic_alerts where sent_at < now() - interval '60 days';
  delete from public.push_devices where updated_at < now() - interval '120 days';
  if not ((c->>'enabled')::boolean and (c->>'alerts')::boolean) or public.follow_quiet(now(), c) then return; end if;

  create temp table if not exists _ti (item text, topic text, title text, importance int, at timestamptz) on commit drop;
  truncate _ti;
  insert into _ti
  select 'a:' || a.id, t, a.title, a.importance, a.published_at
    from public.articles a join public.article_topics x on x.article_id = a.id, unnest(x.topics) t
   where a.status = 'published' and not a.sensitive   -- jamais d'alerte pour un sujet sensible
     and a.importance >= (c->>'min_importance')::int
     and a.published_at > now() - make_interval(hours => (c->>'lookback_hours')::int)
     and not public.follow_quiet(a.published_at, c)    -- l'édition du matin a déjà sa notification
  union all
  select 'f:' || f.id, t, f.title, f.importance, f.published_at
    from public.flashes f, unnest(f.topics) t
   where (c->>'flashes')::boolean and f.status = 'published' and not f.sensitive
     and f.importance >= (c->>'min_importance')::int
     and f.published_at > now() - make_interval(hours => (c->>'lookback_hours')::int)
     and not public.follow_quiet(f.published_at, c);

  create temp table if not exists _tp (who text, topic text, item text, title text) on commit drop;
  truncate _tp;
  insert into _tp
  select distinct on (tf.who) tf.who, i.topic, i.item, i.title
    from public.topic_follows tf
    join _ti i on i.topic = tf.topic
    join public.algo_keywords k on k.label = tf.topic and k.active and k.followable
   where tf.alerts and i.at > tf.created_at
     and exists (select 1 from public.push_devices p where p.user_id::text = tf.who or ('d:' || p.device = tf.who and p.user_id is null))
     and not exists (select 1 from public.topic_alerts l where l.who = tf.who and l.item = i.item)
     and not exists (select 1 from public.topic_alerts l where l.who = tf.who and l.topic = i.topic
                       and l.sent_at > now() - make_interval(hours => (c->>'cooldown_hours')::int))
     and (select count(*) from public.topic_alerts l where l.who = tf.who and l.sent_at >= day0) < (c->>'max_per_day')::int
   order by tf.who, i.importance desc, i.at desc;

  insert into public.topic_alerts (who, topic, item, title) select p.who, p.topic, p.item, p.title from _tp p;
  return query
  select pd.token,
         left(replace(replace(c->>'alert_title', '{sujet}', p.topic), '{titre}', p.title), 120),
         left(replace(replace(c->>'alert_body', '{sujet}', p.topic), '{titre}', p.title), 240),
         p.topic, p.item
    from _tp p join public.push_devices pd on pd.user_id::text = p.who or ('d:' || pd.device = p.who and pd.user_id is null);
end $$;
revoke all on function public.take_topic_alerts() from public, anon, authenticated;

-- Téléphone qui n'accepte plus les notifications (application supprimée) : on l'oublie.
create or replace function public.drop_push(tokens text[]) returns void
language sql security definer set search_path = public as $$
  delete from public.push_devices where token = any (tokens);
$$;
revoke all on function public.drop_push(text[]) from public, anon, authenticated;

-- 6. Back office ------------------------------------------------------------------------------------------
create or replace function public.follow_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Réservé à l''équipe'; end if;
  return jsonb_build_object(
    'followers', (select count(distinct who) from public.topic_follows),
    'follows', (select count(*) from public.topic_follows),
    'phones', (select count(*) from public.push_devices),
    'alerts_today', (select count(*) from public.topic_alerts
                      where sent_at >= date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris'),
    'alerts_7', (select count(*) from public.topic_alerts where sent_at > now() - interval '7 days'),
    'topics', coalesce((select jsonb_agg(x order by x.followers desc, x.topic) from (
        select k.label as topic, k.followable, k.active,
               (select count(*) from public.topic_follows f where f.topic = k.label) as followers,
               (select count(*) from public.topic_alerts l where l.topic = k.label and l.sent_at > now() - interval '7 days') as alerts_7,
               (select count(*) from public.article_topics t join public.articles a on a.id = t.article_id
                 where k.label = any (t.topics) and a.status = 'published' and a.published_at > now() - interval '30 days') as items_30
          from public.algo_keywords k) x), '[]'),
    'recent', coalesce((select jsonb_agg(r order by r.at desc) from (
        select l.topic, l.title, max(l.sent_at) as at, count(*) as readers
          from public.topic_alerts l where l.sent_at > now() - interval '7 days'
         group by l.topic, l.item, l.title order by max(l.sent_at) desc limit 20) r), '[]'));
end $$;
grant execute on function public.follow_stats() to authenticated;
