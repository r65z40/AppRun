-- Deux modèles d'IA : TITRE_MODEL écrit les cartes, TITRE_MODEL_LIGHT (Haiku par défaut) fait le reste
-- (choisir les sujets, relire, Dernière minute, modération). Le coût d'un passage additionne les deux.
insert into public.setting_keys (key) values ('TITRE_MODEL_LIGHT') on conflict do nothing;

-- shortcut: tarifs Anthropic de novembre 2026 ($/million de jetons) écrits ici, à mettre à jour s'ils changent.
create or replace function public.run_cost(stats jsonb) returns numeric
language sql immutable as $$
  select coalesce(sum(
           (coalesce((u->>'input')::numeric, 0) * case when m like 'claude-haiku%' then 0.10 when m like 'claude-sonnet%' then 2 else 4 end
          + coalesce((u->>'output')::numeric, 0) * case when m like 'claude-haiku%' then 0.50 when m like 'claude-sonnet%' then 10 else 20 end) / 1e6), 0)
    from (values (stats->>'model', stats->'ai'), (stats->'ai'->'light'->>'model', stats->'ai'->'light')) v(m, u);
$$;
