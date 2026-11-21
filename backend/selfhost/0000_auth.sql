-- Hébergement chez soi (sans Supabase) : ce que Supabase fournissait, en version minimale.
-- À exécuter AVANT les migrations 0001 et 0002, en tant que propriétaire de la base.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

create extension if not exists pgcrypto;
create schema if not exists auth;

-- Comptes : e-mail + mot de passe (haché par l'API, jamais stocké en clair).
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  password_hash text,
  created_at timestamptz not null default now()
);

-- Identifiant du compte connecté, posé par l'API au début de chaque requête.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
