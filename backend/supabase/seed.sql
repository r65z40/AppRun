-- Sources de départ : flux RSS publics (titre + chapô).
-- À vérifier une par une : les adresses changent et certaines peuvent exiger un accord.
insert into public.sources (name, url, rubric_hint) values
  ('franceinfo', 'https://www.francetvinfo.fr/titres.rss', null),
  ('Le Monde', 'https://www.lemonde.fr/rss/une.xml', null),
  ('Libération', 'https://www.liberation.fr/arc/outboundfeeds/rss-all/?outputType=xml', null),
  ('20 Minutes', 'https://www.20minutes.fr/feeds/rss-une.xml', null),
  ('France 24', 'https://www.france24.com/fr/rss', 'monde'),
  ('RFI', 'https://www.rfi.fr/fr/rss', 'monde'),
  ('Les Echos', 'https://syndication.lesechos.fr/rss/rss_une.xml', 'eco'),
  ('Numerama', 'https://www.numerama.com/feed/', 'tech'),
  ('L''Équipe', 'https://dwh.lequipe.fr/api/edito/rss?path=/', 'sport'),
  ('Ouest-France', 'https://www.ouest-france.fr/rss/une', 'france')
on conflict (url) do nothing;
