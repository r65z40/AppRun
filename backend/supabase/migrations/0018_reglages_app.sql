-- Tout ce qui restait écrit en dur devient réglable dans le back office (Personnalisation > Règles de l'app,
-- Messages compte et Premium ; Réglages > Modération). Chaque réglage vide garde la valeur d'origine.

insert into public.setting_keys (key) values ('APP_RULES'), ('NUDGES'), ('COMMENT_RATE'), ('REPORTS_TO_HIDE')
on conflict do nothing;

-- Entier réglé dans le back office, borné ; sinon la valeur par défaut.
create or replace function public.setting_int(k text, def int, lo int, hi int) returns int
language plpgsql stable security definer set search_path = public as $$
declare v int;
begin
  select value::int into v from public.app_settings where key = k;
  return greatest(lo, least(hi, coalesce(v, def)));
exception when others then
  return def;
end $$;
revoke all on function public.setting_int(text, int, int, int) from public, anon, authenticated;

-- Garde-fous des commentaires : le nombre de commentaires par minute se règle (5 par défaut).
create or replace function public.guard_comment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_staff() then return new; end if;
  if exists (select 1 from public.profiles where id = new.user_id and banned) then
    raise exception 'Votre compte ne peut plus commenter';
  end if;
  if not exists (select 1 from public.profiles where id = new.user_id and pseudo is not null) then
    raise exception 'Choisissez un pseudo avant de commenter';
  end if;
  if not exists (select 1 from public.articles where id = new.article_id and status = 'published') then
    raise exception 'Cette info n''est plus en ligne';
  end if;
  if public.has_insult(new.text) then
    raise exception 'Ce commentaire contient un mot interdit. Reformulez sans insulte.';
  end if;
  if (select count(*) from public.comments where user_id = new.user_id and created_at > now() - interval '1 minute')
     >= public.setting_int('COMMENT_RATE', 5, 1, 60) then
    raise exception 'Doucement : attendez un instant avant de commenter à nouveau';
  end if;
  new.text := trim(new.text);
  return new;
end $$;

-- Masquage automatique : au N-ième signalement (3 par défaut, 0 = jamais).
create or replace function public.auto_hide_reported() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int := public.setting_int('REPORTS_TO_HIDE', 3, 0, 50);
begin
  if n > 0 and (select count(*) from public.reports where comment_id = new.comment_id and not resolved) >= n then
    update public.comments set status = 'hidden' where id = new.comment_id and status = 'visible';
  end if;
  return new;
end $$;

-- Réglages publics lus par l'app : on ajoute les règles de l'app et les messages compte / Premium.
create or replace function public.app_config() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'comments_mode', coalesce((select value from public.app_settings where key = 'COMMENTS_MODE'), 'comments'),
    'brand', public.setting_json('BRAND'),
    'texts', public.setting_json('APP_TEXTS'),
    'notifications', public.setting_json('NOTIFICATIONS'),
    'rules', public.setting_json('APP_RULES'),
    'nudges', public.setting_json('NUDGES')
  );
$$;
grant execute on function public.app_config() to anon, authenticated;
