-- Modération et gestion des lecteurs complètes : suspensions temporaires, suspension automatique
-- des récidivistes, fiche lecteur (historique, export RGPD, pseudo réinitialisé), filtres.

-- 0. Bloc commun aux fils modération, publicité, premium et back office (copié tel quel, idempotent) :
-- la liste des réglages autorisés devient une table, chacun y ajoute ses clés sans redéfinir set_setting.
create table if not exists public.setting_keys (key text primary key);
alter table public.setting_keys enable row level security;
insert into public.setting_keys (key) values
  ('ANTHROPIC_API_KEY'), ('UNSPLASH_ACCESS_KEY'), ('PEXELS_API_KEY'),
  ('ENGINE_PAUSED'), ('TITRE_MODEL'), ('TITRE_EFFORT'), ('AI_GUIDELINES'), ('AI_AVOID'),
  ('WINDOW_HOURS'), ('PER_RUBRIC'), ('MAX_CARDS'), ('MAX_ESSENTIAL'), ('MIN_IMPORTANCE'), ('MIN_SOURCES'),
  ('AUTO_PUBLISH'), ('AUTO_FIX'), ('PUBLISH_FLAGGED'), ('PUBLISH_MIN_IMPORTANCE'),
  ('FLASH_ENABLED'), ('FLASH_AUTO_PUBLISH'), ('FLASH_MIN_IMPORTANCE'), ('FLASH_MIN_SOURCES'), ('FLASH_MAX_PER_DAY'),
  ('BANNED_WORDS'), ('AI_MODERATION'), ('MODERATION'), ('LIVE_UPDATES'), ('LIVE_MIN_IMPORTANCE'), ('COMMENTS_MODE')
on conflict do nothing;

create or replace function public.set_setting(k text, v text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  if not exists (select 1 from public.setting_keys where key = k) then
    raise exception 'Réglage inconnu : %', k;
  end if;
  if char_length(coalesce(v, '')) > 2000 then raise exception 'Valeur trop longue (2 000 caractères au plus)'; end if;
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
