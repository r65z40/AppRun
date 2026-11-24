-- « Pourquoi c'est important » : une phrase écrite par l'IA dans le même appel que la carte,
-- affichée dans la lecture plein écran (réglage APP_RULES.show_matters, 1 par défaut) et modifiable dans Articles.
alter table public.articles add column if not exists matters text;
