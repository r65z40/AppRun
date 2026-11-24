-- « Voir les angles » : sur un sujet qui divise, comment chaque média l'aborde, en une phrase neutre réécrite par l'IA
-- (même appel que la carte, aucun coût en plus). Vide le plus souvent ; l'app n'affiche le lien qu'à partir de 2 angles.
alter table public.articles add column if not exists angles jsonb;  -- [{source, text}] ou null
insert into public.setting_keys (key) values ('MEDIA_ANGLES') on conflict do nothing;
