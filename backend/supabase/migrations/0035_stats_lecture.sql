-- Statistiques de lecture (tableau de bord), tirées du journal reading_events déjà tenu par l'app.
-- Rien de nouveau n'est noté : un lecteur qui a coupé « Édition selon mes goûts » n'envoie aucun signal, il n'est donc pas compté.
create or replace function public.reading_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Réservé à l''équipe'; end if;
  return (
    with ev as (select * from public.reading_events where at > now() - interval '7 days'),
    -- Une journée de lecteur = un appareil, un jour (heure de Paris) : combien d'infos différentes il a vues.
    d as (select count(distinct article_id) seen from ev where kind = 'view' group by device, (at at time zone 'Europe/Paris')::date)
    select jsonb_build_object(
      -- Infos les plus vues : temps médian sur la carte, ouvertes en plein écran, lues jusqu'au bout.
      'articles', coalesce((select jsonb_agg(t order by t.readers desc) from (
          select a.title, a.rubric_id,
                 count(distinct e.device) filter (where e.kind = 'view') readers,
                 round((percentile_cont(0.5) within group (order by e.ms) filter (where e.kind = 'view'))::numeric / 1000, 1) median_s,
                 count(distinct e.device) filter (where e.kind = 'summary') opened,
                 count(distinct e.device) filter (where e.kind = 'summary_end') finished
            from ev e join public.articles a on a.id = e.article_id
           group by a.id order by 3 desc limit 10) t), '[]'),
      'days', (select count(*) from d),
      -- Décrochage : part des journées où le lecteur a vu au moins n infos.
      'reach', (select jsonb_agg(jsonb_build_object('n', n, 'days', (select count(*) from d where d.seen >= n)) order by n)
                  from unnest(array[1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 24, 32]) n)));
end $$;
revoke all on function public.reading_stats() from public, anon;
grant execute on function public.reading_stats() to authenticated;
