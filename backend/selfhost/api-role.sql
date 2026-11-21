-- Rôle de connexion de l'API : il ne fait rien par lui-même, il endosse « anon » ou « authenticated »
-- à chaque requête, et la sécurité ligne par ligne s'applique. Remplacer le mot de passe.
-- Usage : psql -v api_password="'un-long-mot-de-passe'" -f api-role.sql
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'titre_api') then
    create role titre_api login noinherit;
  end if;
end $$;
alter role titre_api password :api_password;
grant anon, authenticated to titre_api;
grant usage on schema public, auth to titre_api;
-- Inscription et connexion : seul accès direct de l'API, limité à la table des comptes.
grant select, insert on auth.users to titre_api;
