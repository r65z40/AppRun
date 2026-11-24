-- Audit sécurité et performances (24/11).

-- 1. Fraude pub : l'ancien compteur ad_hit ajoutait des affichages et des clics sans aucune limite,
-- pour n'importe qui. L'app passe par ad_hits (plafonds par appareil et par adresse IP) depuis 0025.
revoke execute on function public.ad_hit(uuid, boolean) from public, anon, authenticated;

-- 2. Index manquants sur les chemins lus à chaque ouverture de l'app ou à chaque commentaire.
create index if not exists reactions_article on public.reactions (article_id);          -- likes d'une info
create index if not exists article_emojis_article on public.article_emojis (article_id); -- emoji d'une info
create index if not exists comment_votes_comment on public.comment_votes (comment_id);   -- votes sous les commentaires
create index if not exists comments_user on public.comments (user_id, created_at desc);  -- « 5 commentaires par minute »
create index if not exists visits_user on public.visits (user_id, day);                  -- séries de jours, fiche lecteur
