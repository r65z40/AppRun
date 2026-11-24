-- Pages légales et RGPD : politique de confidentialité, conditions d'utilisation et mentions légales,
-- modifiables dans le back office (Personnalisation > Pages légales), lisibles dans l'app (Réglages) et sur
-- une adresse publique (site web ?legal=privacy). Suppression du compte par le lecteur (exigée par Apple).
-- Les textes de départ sont des MODÈLES à compléter et à faire relire : ce n'est pas un avis juridique.

insert into public.setting_keys (key) values ('LEGAL_PRIVACY'), ('LEGAL_TERMS'), ('LEGAL_NOTICE'), ('VISITS_KEEP_MONTHS')
on conflict do nothing;

-- (bloc commun) set_setting : les pages légales peuvent aller jusqu'à 20 000 caractères.
create or replace function public.set_setting(k text, v text)
returns void language plpgsql security definer set search_path = public as $$
declare lim int := case when k like 'LEGAL_%' then 20000 when k like 'MAIL_%_BODY' or k = 'APP_TEXTS' then 10000 else 2000 end;
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

-- Lecture publique d'une page légale (rien d'autre n'est lisible par ce chemin).
create or replace function public.legal_text(k text) returns text
language sql stable security definer set search_path = public as $$
  select value from public.app_settings where key = k and k in ('LEGAL_PRIVACY', 'LEGAL_TERMS', 'LEGAL_NOTICE');
$$;
grant execute on function public.legal_text(text) to anon, authenticated;

-- Le lecteur supprime son compte : profil, likes, commentaires, badges, lectures et abonnement enregistré
-- partent avec lui (clés « on delete cascade »). Les comptes de l'équipe se retirent depuis le back office.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Connectez-vous d''abord'; end if;
  if public.is_staff() then raise exception 'Un compte de l''équipe ne se supprime pas depuis l''app'; end if;
  insert into public.audit_log (actor, action, target, detail) values (null, 'Compte supprimé par le lecteur', u::text, null);
  delete from auth.users where id = u;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Jours d'ouverture de l'app (table visits) : effacés après VISITS_KEEP_MONTHS mois (12 par défaut, back office >
-- Personnalisation > Pages légales). Ajouté au ménage que le moteur lance à chaque édition.
create or replace function public.purge_reading_events() returns int
language sql security definer set search_path = public as $$
  with d as (delete from public.reading_events where at < now() - make_interval(days => (public.algo_conf()->>'keep_days')::int) returning 1),
  v as (delete from public.visits where day < current_date - make_interval(months => public.setting_int('VISITS_KEEP_MONTHS', 12, 1, 120)) returning 1)
  select ((select count(*) from d) + (select count(*) from v))::int;
$$;
revoke all on function public.purge_reading_events() from public, anon, authenticated;

-- Modèles de départ ({nom} = nom de l'app ; les [crochets] sont à compléter). Une page vidée dans le back office
-- n'est plus affichée : il faut toujours un texte en ligne pour les stores.
insert into public.app_settings (key, value) values
('LEGAL_PRIVACY', $t$Politique de confidentialité

Dernière mise à jour : [date]

{nom} respecte votre vie privée. Cette page explique quelles données nous utilisons, pourquoi, et comment garder la main.

Qui est responsable de vos données ?
[Nom ou société], [adresse], joignable à [adresse e-mail de contact].

Ce que nous utilisons
• Sans compte : un identifiant tiré au hasard, propre à votre téléphone, vos réglages (rubriques, nombre d'infos, heure de la notification) et les jours où vous ouvrez l'app (série de jours).
• Ce que vous lisez dans l'app (infos vues, temps passé, résumés ouverts), pour composer « Mon édition ». Vous pouvez l'arrêter : Réglages > Édition selon mes goûts. Vous pouvez aussi tout effacer : Réglages > Remettre mes goûts à zéro.
• Avec un compte : votre adresse e-mail, votre pseudo, vos likes, commentaires, badges et invitations d'amis.
• Premium : l'achat passe par l'App Store ou Google Play. Nous ne voyons jamais vos données bancaires ; nous recevons seulement l'état de l'abonnement (via RevenueCat).
• Publicité : les pubs sont des cartes affichées par l'app elle-même. Nous comptons les affichages et les clics, sans vous suivre sur d'autres apps ou sites. Les pubs ne sont adaptées à vos rubriques que si vous l'acceptez (Réglages > Pubs selon mes centres d'intérêt, coupé par défaut).
• Notification du matin : un jeton technique fourni par Apple ou Google, seulement si vous l'activez.

Pourquoi (base légale)
• Faire fonctionner l'app et votre compte : exécution du service que vous demandez.
• Personnaliser votre édition et compter les lectures : notre intérêt légitime, que vous pouvez refuser à tout moment dans les Réglages.
• Pubs selon vos centres d'intérêt : votre consentement, retirable à tout moment.

Combien de temps
• Lectures : 90 jours au plus (réglable dans le back office, Lecteurs > Algorithme).
• Compte : tant qu'il existe. Supprimé, il disparaît aussitôt avec ses likes, commentaires et badges.
• Jours d'ouverture de l'app (série de jours, statistiques) : 12 mois, puis effacés automatiquement.
• Journaux techniques : [12] mois au plus.

Qui y a accès
Notre équipe et nos prestataires techniques, uniquement pour faire tourner l'app : Supabase (base de données, [région]), Apple et Google (stores et notifications), RevenueCat (abonnements), Anthropic (rédaction des résumés, sans aucune donnée de lecteur). Nous ne vendons jamais vos données.

Vos droits
Vous pouvez consulter, corriger, effacer ou récupérer vos données, et vous opposer à leur usage. Supprimer votre compte : Réglages > Mon compte > Supprimer mon compte. Pour toute autre demande : [adresse e-mail de contact]. Vous pouvez aussi saisir la CNIL (cnil.fr).

Mineurs
{nom} s'adresse aux personnes de 15 ans et plus.$t$),
('LEGAL_TERMS', $t$Conditions générales d'utilisation

Dernière mise à jour : [date]

1. Le service
{nom} présente chaque jour un résumé court des actualités, rédigé à partir de médias reconnus. Les liens vers les sources restent disponibles sous chaque info.

2. Les résumés
Les résumés sont rédigés avec l'aide d'une intelligence artificielle et relus par des règles automatiques. Malgré notre soin, une erreur reste possible : pour une décision importante, lisez la source.

3. Votre compte
Le compte est gratuit et personnel. Vous choisissez un pseudo correct et gardez votre mot de passe secret. Vous pouvez le supprimer à tout moment dans l'app.

4. Les commentaires
Restez courtois. Sont interdits : insultes, propos haineux ou discriminants, harcèlement, publicité, contenus illégaux. Un commentaire signalé peut être masqué ; un compte qui ne respecte pas ces règles peut être bloqué ou supprimé.

5. Premium
Premium retire les publicités. L'abonnement est payé et géré par l'App Store ou Google Play, se renouvelle automatiquement et se résilie dans les réglages de votre store, au plus tard 24 h avant la fin de la période. Supprimer votre compte n'arrête pas l'abonnement : pensez à le résilier dans votre store.

6. Publicité
La version gratuite affiche quelques cartes sponsorisées, toujours signalées comme telles.

7. Propriété
La marque {nom}, l'app et les résumés nous appartiennent. Les articles d'origine appartiennent à leurs médias. Les photos sont libres de droits ou utilisées avec l'accord de leur auteur.

8. Responsabilité
Nous faisons de notre mieux pour que l'app soit disponible, sans pouvoir le garantir à tout moment.

9. Changements
Nous pouvons modifier ces conditions ; la date ci-dessus change alors. Continuer à utiliser l'app vaut accord.

10. Droit applicable
Droit français. En cas de litige, contactez-nous d'abord : [adresse e-mail de contact].$t$),
('LEGAL_NOTICE', $t$Mentions légales

Éditeur
[Nom ou raison sociale]
[Forme juridique, capital, RCS ou SIRET]
[Adresse]
[Adresse e-mail de contact]

Directeur de la publication
[Prénom Nom]

Hébergement
Base de données : Supabase Inc., 970 Toa Payoh North #07-04, Singapour 318992 (serveurs en [région]).
Site web : GitHub Inc., 88 Colin P Kelly Jr Street, San Francisco, CA 94107, États-Unis.

Contact
[Adresse e-mail de contact]$t$)
on conflict (key) do nothing;
