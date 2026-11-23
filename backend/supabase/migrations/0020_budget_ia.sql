-- Budget de l'IA : plafond de dépense par jour et par mois, et interrupteur qui coupe toute dépense.
-- Les montants sont en dollars, comme la facture d'Anthropic et le Tableau de bord (estimation par run_cost).
insert into public.setting_keys (key) values ('AI_OFF'), ('AI_BUDGET_DAY'), ('AI_BUDGET_MONTH') on conflict do nothing;

-- Dépense estimée de l'IA aujourd'hui et ce mois-ci (heure de Paris), passages en cours compris.
-- Appelée par le moteur (sans compte) et par l'équipe dans le back office.
create or replace function public.ai_spend() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare today date := (now() at time zone 'Europe/Paris')::date;
begin
  if auth.uid() is not null and not public.is_staff() then raise exception 'Réservé à l''équipe'; end if;
  return jsonb_build_object(
    'today', (select coalesce(sum(public.run_cost(stats)), 0) from public.engine_runs where (started_at at time zone 'Europe/Paris')::date = today),
    'month', (select coalesce(sum(public.run_cost(stats)), 0) from public.engine_runs where date_trunc('month', started_at at time zone 'Europe/Paris') = date_trunc('month', today::timestamp)));
end $$;
revoke all on function public.ai_spend() from public, anon;
grant execute on function public.ai_spend() to authenticated;
