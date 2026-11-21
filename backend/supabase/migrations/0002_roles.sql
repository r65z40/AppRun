-- Seuls les admins changent les rôles ; la rédaction peut lire les profils (pseudos des commentaires).
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

drop policy if exists profiles_staff on public.profiles;
create policy profiles_staff_read on public.profiles for select using (public.is_staff());
create policy profiles_admin on public.profiles for all using (public.is_admin()) with check (public.is_admin());

-- Pour donner l'accès au back office au premier compte (à lancer une fois dans le SQL Editor) :
--   update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'vous@exemple.fr');
-- (le profil est créé automatiquement à l'inscription, voir ci-dessous)

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Garde-fou : un lecteur ne peut ni changer son rôle ni se passer Premium lui-même.
-- (Le serveur — clé service, auth.uid() vide — et les admins le peuvent.)
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and (new.role is distinct from old.role or new.premium is distinct from old.premium) then
    raise exception 'Modification réservée aux administrateurs';
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
for each row execute function public.guard_profile();
