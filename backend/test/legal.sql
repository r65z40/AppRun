-- Pages légales lisibles par tous (et rien d'autre), suppression du compte par le lecteur.
\set QUIET on
\set ON_ERROR_STOP on
\echo --- Pages légales et suppression du compte
set role anon;
select case when public.legal_text('LEGAL_PRIVACY') like 'Politique de confidentialité%' and public.legal_text('LEGAL_TERMS') <> '' and public.legal_text('LEGAL_NOTICE') <> ''
  and public.legal_text('SMTP_PASS_KEY') is null then 'OK  pages légales publiques, autres réglages fermés' else 'ÉCHEC  pages légales' end;
select case when not has_function_privilege('anon', 'public.delete_my_account()', 'execute') then 'OK  suppression de compte fermée sans connexion' else 'ÉCHEC  suppression ouverte' end;
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d1', 'parti@test.fr'), ('00000000-0000-0000-0000-0000000000d2', 'chef2@test.fr') on conflict do nothing;
update profiles set pseudo = 'Parti' where id = '00000000-0000-0000-0000-0000000000d1';
update profiles set pseudo = 'Chef2', role = 'admin' where id = '00000000-0000-0000-0000-0000000000d2';
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select delete_my_account();
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d2';
do $$ begin perform delete_my_account(); raise exception 'staff supprimé'; exception when others then if sqlerrm = 'staff supprimé' then raise; end if; end $$;
reset request.jwt.claim.sub;
select case when not exists (select 1 from auth.users where id = '00000000-0000-0000-0000-0000000000d1') and not exists (select 1 from profiles where id = '00000000-0000-0000-0000-0000000000d1')
  and exists (select 1 from auth.users where id = '00000000-0000-0000-0000-0000000000d2')
  then 'OK  le lecteur supprime son compte, un compte de l''équipe ne le peut pas' else 'ÉCHEC  suppression du compte' end;
insert into visits (device, day) values ('vieux-tel', current_date - 400), ('neuf-tel', current_date - 10);
select purge_reading_events();
select case when not exists (select 1 from visits where device = 'vieux-tel') and exists (select 1 from visits where device = 'neuf-tel')
  then 'OK  jours d''ouverture effacés après 12 mois' else 'ÉCHEC  conservation des visites' end;
