-- « Retenir les cartes encore douteuses » coupé : les cartes restées en brouillon seulement pour un doute
-- (reprise mot pour mot, ton, chiffre, relecture IA) ou une alerte simple sont publiées, comme le moteur le fait désormais.
-- Seulement les 3 derniers jours, seulement les cartes écrites par l'IA, jamais si GUARD_HOLD ou le pilote automatique est coupé.
update public.articles a
   set status = 'published', published_at = now()
 where a.status = 'draft'
   and a.model is not null
   and a.edition_date >= current_date - 2
   and cardinality(a.review_notes) > 0
   and not exists (select 1 from unnest(a.review_notes) n
                    where n !~ '^(reprise|ton :|chiffre absent|relecture IA)' and n !~ '(trop long|ponctuation|en gras)')
   and a.importance >= coalesce((select value::int from public.app_settings where key = 'PUBLISH_MIN_IMPORTANCE' and value ~ '^[0-9]+$'), 1)
   and coalesce((select value from public.app_settings where key = 'GUARD_HOLD'), '0') <> '1'
   and coalesce((select value from public.app_settings where key = 'AUTO_PUBLISH'), '1') <> '0';
