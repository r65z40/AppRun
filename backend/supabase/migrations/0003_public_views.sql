-- Ce que tout le monde peut voir des autres : le pseudo, et les votes sans leur auteur.
create or replace view public.profiles_public as select id, pseudo from public.profiles;
create or replace view public.comment_votes_public as select comment_id, value from public.comment_votes;
grant select on public.profiles_public, public.comment_votes_public to anon, authenticated;
-- Les visiteurs non connectés peuvent lire les commentaires visibles (la règle de 0001 filtre).
grant select on public.comments to anon;
