-- Fouille de textes par l'IA : le moteur note chaque nuit si le média la refuse (robots.txt, tdmrep.json).
-- Une source qui refuse est désactivée, sauf si l'équipe l'a réactivée en connaissance de cause (ai_accepted).
alter table public.sources add column if not exists ai_refusal text;
alter table public.sources add column if not exists ai_checked_at timestamptz;
alter table public.sources add column if not exists ai_accepted boolean not null default false;
