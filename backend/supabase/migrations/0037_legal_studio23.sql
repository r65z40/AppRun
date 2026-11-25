-- Pages légales : les [crochets] des modèles remplis avec l'éditeur (Studio 23, d'après studio-23.fr/mentions-legales.html).
-- Ne remplace que les crochets encore présents : un texte déjà retouché dans le back office garde ses retouches.
-- Reste à compléter à la main : [région] (région des serveurs Supabase).
update public.app_settings set value =
  replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(value,
    '[date]', '25 novembre 2026'),
    '[Nom ou société], [adresse], joignable à [adresse e-mail de contact].', 'Studio 23, entreprise individuelle (EI), Auxerre (89000), France, joignable à titre@studio-23.fr.'),
    '[Nom ou raison sociale]', 'Studio 23'),
    '[Forme juridique, capital, RCS ou SIRET]', 'Entreprise individuelle (EI), immatriculée au Registre national des entreprises, SIRET 987 664 893 00029'),
    '[Adresse]', 'Auxerre (89000), France'),
    '[Prénom Nom]', 'Le représentant légal de Studio 23'),
    '[adresse e-mail de contact]', 'titre@studio-23.fr'),
    '[Adresse e-mail de contact]', 'titre@studio-23.fr'),
    '[12] mois', '12 mois'),
    '[90]', '90'),
  updated_at = now()
 where key in ('LEGAL_PRIVACY', 'LEGAL_TERMS', 'LEGAL_NOTICE');
