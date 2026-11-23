-- Personnalisation de l'app depuis le back office (page « Personnalisation ») :
-- identité (nom, logo, couleurs, police), textes de l'app, notification du matin et e-mails des comptes.
-- Chaque groupe est un réglage JSON ; l'app le lit au démarrage et garde ses valeurs par défaut si rien n'est réglé.

insert into public.setting_keys (key) values
  ('BRAND'), ('APP_TEXTS'), ('NOTIFICATIONS'),
  ('MAIL_SENDER_NAME'), ('MAIL_SENDER_EMAIL'),
  ('SMTP_HOST'), ('SMTP_PORT'), ('SMTP_USER'), ('SMTP_PASS_KEY'),
  ('MAIL_CONFIRM_SUBJECT'), ('MAIL_CONFIRM_BODY'), ('MAIL_RESET_SUBJECT'), ('MAIL_RESET_BODY')
on conflict do nothing;

-- (bloc commun) set_setting : les modèles d'e-mails et les textes de l'app peuvent dépasser 2 000 caractères.
create or replace function public.set_setting(k text, v text)
returns void language plpgsql security definer set search_path = public as $$
declare lim int := case when k like 'MAIL_%_BODY' or k = 'APP_TEXTS' then 10000 else 2000 end;
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  if not exists (select 1 from public.setting_keys where key = k) then
    raise exception 'Réglage inconnu : %', k;
  end if;
  if char_length(coalesce(v, '')) > lim then raise exception 'Valeur trop longue (% caractères au plus)', lim; end if;
  if coalesce(trim(v), '') = '' then
    delete from public.app_settings where key = k;
  else
    insert into public.app_settings (key, value, updated_at, updated_by) values (k, trim(v), now(), auth.uid())
    on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
  end if;
  insert into public.audit_log (actor, action, target, detail)
  values (auth.uid(), 'Réglage modifié', k, case when k like '%_KEY' then 'clé remplacée' else left(coalesce(trim(v), ''), 200) end);
end $$;
-- (fin du bloc commun)

-- Lit un réglage JSON ; un contenu abîmé est ignoré (l'app garde alors ses valeurs par défaut).
create or replace function public.setting_json(k text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v text;
begin
  select value into v from public.app_settings where key = k;
  if v is null then return null; end if;
  return v::jsonb;
exception when others then
  return null;
end $$;
revoke all on function public.setting_json(text) from public, anon, authenticated;

-- Réglages publics lus par l'app (rien de secret) : on y ajoute l'identité, les textes et la notification.
create or replace function public.app_config() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'comments_mode', coalesce((select value from public.app_settings where key = 'COMMENTS_MODE'), 'comments'),
    'brand', public.setting_json('BRAND'),
    'texts', public.setting_json('APP_TEXTS'),
    'notifications', public.setting_json('NOTIFICATIONS')
  );
$$;
grant execute on function public.app_config() to anon, authenticated;
