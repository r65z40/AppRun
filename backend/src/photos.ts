// Photos libres de droits embarquées dans l'app (assets/photos). Le moteur choisit une étiquette ;
// le back office pourra ensuite mettre une photo précise (photo_url).
export const PHOTO_TAGS = {
  train: 'quai de gare, train, transports, grève, mobilité',
  neige: 'route enneigée, hiver, météo, froid',
  eau: 'vagues, mer, océan, climat, inondation',
  fjord: 'fjord, montagne et lac, nature, Europe du Nord, diplomatie',
  facade: 'façade d’immeuble, ville, logement, institutions',
  velo: 'chaîne de vélo, cyclisme, mécanique, industrie',
  batiment: 'bâtiment blanc moderne, entreprise, économie, architecture',
  sommet: 'sommet enneigé, exploit, record, sport de montagne',
  route: 'route de montagne, voyage, énergie, territoire',
  livre: 'reliure de livre, culture, littérature, éducation, histoire, science, idée',
} as const;
export type PhotoTag = keyof typeof PHOTO_TAGS;
export const PHOTO_TAG_LIST = Object.keys(PHOTO_TAGS) as [PhotoTag, ...PhotoTag[]];
