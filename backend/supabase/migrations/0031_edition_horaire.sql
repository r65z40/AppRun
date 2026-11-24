-- Édition renouvelée au fil de la journée : chaque heure, le moteur ajoute les infos nouvelles et importantes,
-- et « Mon édition » garde le nombre d'infos choisi avec les plus importantes du moment en haut.
-- L'importance d'une info s'efface avec les heures (réglage ALGO.decay_hours, 6 h par défaut, 0 = jamais) :
-- une info dépassée descend, puis sort de l'édition vers « Charger plus ». Sous les sujets majeurs,
-- les infos sont rangées du plus pertinent au moins pertinent. Aucun appel à l'IA en plus.

create or replace function public.algo_defaults() returns jsonb language sql immutable as $$
  select '{
    "enabled": true,
    "share_essential": 25, "share_discovery": 12,
    "w_importance": 45, "w_affinity": 35, "w_collective": 10, "w_fresh": 10,
    "affinity_start": 10, "ramp": 50, "half_life": 21, "smooth": 5, "decay_hours": 6,
    "skip_ms": 2000, "long_ms": 12000, "min_views": 200, "max_rubric": 50, "keep_days": 90,
    "signals": {"click": 3, "share": 3, "summary_end": 2, "like": 2, "comment": 2, "summary": 1.5,
                "source": 1, "long": 1, "back": 0.5, "skip": -0.5, "dislike": -0.5, "less": -3}
  }'::jsonb;
$$;

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
  -- Dernier jour ayant une info en ligne (comme l'app) : pas besoin d'attendre la fin du passage du matin.
  ed date := (select max(a.edition_date) from public.articles a where a.status = 'published');
  -- Une info perd la moitié de son importance toutes les decay_hours heures (0 = jamais) : les plus fraîches remontent.
  dh numeric := coalesce((c->>'decay_hours')::numeric, 0);
  r record;
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
    aff numeric, fav text, sc numeric, slot text, why text, ord int, ci numeric) on commit drop;
  truncate _cand;

  insert into _cand (id, rubric, rname, essential, importance, aff, fav, sc, ci)
  with art0 as (
    select a.id, a.rubric_id, rb.name, a.essential, a.sensitive, a.importance, coalesce(a.published_at, a.created_at) as at,
           coalesce(t.topics, '{}') as topics
      from public.articles a join public.rubrics rb on rb.id = a.rubric_id
      left join public.article_topics t on t.article_id = a.id
     where a.edition_date = ed and a.status = 'published'
       -- « Moins de sujets comme ça » : cette info-là ne revient pas.
       and not exists (select 1 from public.reading_events e where e.article_id = a.id and e.kind = 'less'
                        and ((uid is not null and e.user_id = uid) or (uid is null and e.device = dev)))
  ),
  -- Importance du moment : la note de la rédaction, qui s'efface avec les heures.
  art as (
    select art0.*, art0.importance * case when dh > 0 then power(0.5, greatest(0, extract(epoch from now() - art0.at)) / 3600 / dh) else 1 end as ci
      from art0
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
         (wi * a2.ci / 10.0
          + wa * (a2.ra + a2.ta) / 2
          -- Sujet sensible : jamais poussé parce qu'il attire les clics (intérêt collectif neutre).
          + (c->>'w_collective')::numeric * case when a2.sensitive then 0.5 else coalesce((select pr from coll_rank where coll_rank.article_id = a2.id), 0.5) end
          + (c->>'w_fresh')::numeric * greatest(0, 1 - extract(epoch from now() - a2.at) / 86400)) / 100
, a2.ci
    from aff2 a2;

  -- À ne pas manquer : les sujets les plus importants du moment, pour tout le monde (ils tournent dans la journée).
  update _cand set slot = 'ess', why = 'Sujet majeur du moment, proposé à tout le monde.'
   where id in (select id from _cand order by ci desc, essential desc, sc desc limit n_ess);
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

  -- Ordre : les sujets majeurs en tête, puis du plus pertinent au moins pertinent (plus on descend, moins c'est important).
  update _cand set ord = x.n from (select id, row_number() over (order by (slot = 'ess') desc, sc desc) - 1 as n
                                     from _cand where slot is not null) x where _cand.id = x.id;
  -- Après l'édition : tout le reste, pour « Charger plus ».
  update _cand set slot = 'more', why = 'Pour aller plus loin aujourd''hui.',
         ord = 1000 + x.n from (select id, row_number() over (order by sc desc) n from _cand where slot is null) x where _cand.id = x.id;

  return query select _cand.id, _cand.slot, _cand.why, round(_cand.sc, 3), _cand.ord from _cand order by _cand.ord;
end $$;
revoke all on function public.compose_edition(uuid, text, text[], int, boolean) from public, anon, authenticated;
