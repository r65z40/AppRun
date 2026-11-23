-- Lancer le moteur depuis le back office, d'un clic : édition, mise à jour, Dernière minute,
-- ou passage à blanc (mode test : l'IA choisit et écrit, rien n'est publié).
-- Passe par le jeton GitHub saisi dans IA > Clés (GITHUB_DISPATCH_KEY), comme la relance automatique (0021).
create or replace function public.launch_engine(what text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare wf text; inputs jsonb; label text;
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  case what
    when 'edition' then wf := 'edition.yml'; inputs := '{"mode": "force"}';
    when 'update' then wf := 'edition.yml'; inputs := '{"mode": "update"}';
    when 'test' then wf := 'edition.yml'; inputs := '{"mode": "test"}';
    when 'flash' then wf := 'flash.yml'; inputs := '{}';
    when 'flash_test' then wf := 'flash.yml'; inputs := '{"mode": "test"}';
    else raise exception 'Passage inconnu : %', what;
  end case;
  if not exists (select 1 from public.app_settings where key = 'GITHUB_DISPATCH_KEY' and value <> '') or to_regnamespace('net') is null then
    return jsonb_build_object('ok', false, 'reason', 'token');
  end if;
  label := wf || coalesce(' ' || nullif(inputs->>'mode', ''), '');
  -- Un double clic ne lance pas deux passages.
  if exists (select 1 from public.dispatch_log where workflow = label and at > now() - interval '1 minute') then
    return jsonb_build_object('ok', false, 'reason', 'recent');
  end if;
  perform public.dispatch_workflow(wf, inputs);
  insert into public.audit_log (actor, action, target, detail) values (auth.uid(), 'Moteur lancé à la main', what, label);
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.launch_engine(text) from public, anon;
grant execute on function public.launch_engine(text) to authenticated;
