// Contenu de démonstration entièrement fictif (repris de la maquette).
import type { Flash, Rubric } from './types';

export const PHOTOS = {
  train: require('../assets/photos/train.jpg'),
  neige: require('../assets/photos/neige.jpg'),
  eau: require('../assets/photos/eau.jpg'),
  fjord: require('../assets/photos/fjord.jpg'),
  facade: require('../assets/photos/facade.jpg'),
  velo: require('../assets/photos/velo.jpg'),
  batiment: require('../assets/photos/batiment.jpg'),
  sommet: require('../assets/photos/sommet.jpg'),
  route: require('../assets/photos/route.jpg'),
  livre: require('../assets/photos/livre.jpg'),
  lampe: require('../assets/photos/lampe.jpg'),
};

export const RUBRICS: Rubric[] = [
 {
  "id": "france",
  "name": "France",
  "items": [
   {
    "id": "france-0",
    "title": "Le train de nuit Paris–Rome reprend",
    "hour": "7 h 12",
    "key": "Une liaison ferroviaire de nuit entre Paris et Rome rouvre le 14 décembre 2026, après six ans d'interruption.",
    "facts": [
     {
      "text": "<b>3</b> départs par semaine dans chaque sens",
      "source": "Compagnie ferroviaire nationale",
      "doc": "Communiqué, 20 nov. 2026"
     },
     {
      "text": "Trajet de <b>14 h 30</b> de bout en bout",
      "source": "Compagnie ferroviaire nationale",
      "doc": "Fiche horaires, 20 nov. 2026"
     },
     {
      "text": "Billets dès <b>49 €</b> en place assise",
      "source": "Ministère des Transports",
      "doc": "Dossier de presse, 20 nov. 2026"
     }
    ],
    "photo": PHOTOS.train,
    "grad": [
     "#ffb36b",
     "#5b6bff",
     "#1b1f5e",
     "#0b0a24"
    ],
    "likes": 942,
    "comments": 128,
    "summary": [
     "Les trains de nuit entre Paris et l'Italie avaient été suspendus fin 2020, faute de voyageurs pendant la crise sanitaire et à cause du coût de rénovation des voitures-couchettes. Depuis, plusieurs liaisons de nuit ont rouvert en Europe, portées par la demande de voyages moins émetteurs que l'avion.",
     "La ligne reprend le 14 décembre avec trois allers-retours par semaine. Le train part de Paris en fin de soirée, s'arrête à Dijon, Turin et Florence, et arrive à Rome en milieu de matinée. Les réservations ouvrent lundi. Trois classes sont proposées : places assises, couchettes à six et cabines privatives.",
     "La compagnie prévoit de passer à un départ quotidien à l'été 2027 si le taux de remplissage dépasse 70 %. Une prolongation vers Naples est à l'étude. Les associations d'usagers demandent déjà des tarifs réduits pour les moins de 26 ans."
    ]
   },
   {
    "id": "france-1",
    "title": "Le prix du gaz baisse de 4 %",
    "hour": "6 h 40",
    "key": "Le prix repère du gaz recule de 4 % au 1er décembre, selon le régulateur de l'énergie.",
    "facts": [
     {
      "text": "<b>-4 %</b> sur le prix repère moyen",
      "source": "Régulateur de l'énergie",
      "doc": "Délibération, 20 nov. 2026"
     },
     {
      "text": "Environ <b>38 €</b> d'économie sur un an pour un foyer chauffé au gaz",
      "source": "Régulateur de l'énergie",
      "doc": "Simulation, 20 nov. 2026"
     },
     {
      "text": "<b>3e</b> baisse consécutive depuis septembre",
      "source": "Observatoire des prix",
      "doc": "Note mensuelle, nov. 2026"
     }
    ],
    "photo": null,
    "grad": [
     "#3d8bff",
     "#ff8a3d",
     "#101a46",
     "#0b0a24"
    ],
    "likes": 611,
    "comments": 86
   },
   {
    "id": "france-2",
    "title": "Première neige attendue dans le Massif central",
    "hour": "8 h 05",
    "key": "Quatre départements passent en vigilance jaune neige à partir de dimanche soir, annonce le service météo national.",
    "facts": [
     {
      "text": "<b>4</b> départements en vigilance jaune",
      "source": "Service météo national",
      "doc": "Bulletin, 21 nov. 2026"
     },
     {
      "text": "Jusqu'à <b>10 cm</b> au-dessus de 800 m",
      "source": "Service météo national",
      "doc": "Prévision, 21 nov. 2026"
     },
     {
      "text": "Minimales prévues à <b>-3 °C</b>",
      "source": "Service météo national",
      "doc": "Prévision, 21 nov. 2026"
     }
    ],
    "photo": PHOTOS.neige,
    "grad": [
     "#dfe8ff",
     "#9fb4ff",
     "#4a5a9a",
     "#141a3e"
    ],
    "likes": 388,
    "comments": 41
   }
  ]
 },
 {
  "id": "monde",
  "name": "Monde",
  "items": [
   {
    "id": "monde-0",
    "title": "Sommet sur l'eau : 40 pays s'engagent",
    "hour": "7 h 48",
    "key": "Réunis à Genève, 40 pays s'engagent à réduire de moitié les fuites de leurs réseaux d'eau potable d'ici 2035.",
    "facts": [
     {
      "text": "<b>40</b> pays signataires",
      "source": "Secrétariat du sommet",
      "doc": "Déclaration finale, 20 nov. 2026"
     },
     {
      "text": "Objectif de <b>-50 %</b> de fuites d'ici 2035",
      "source": "Secrétariat du sommet",
      "doc": "Déclaration finale, 20 nov. 2026"
     },
     {
      "text": "Fonds commun de <b>2 milliards</b> d'euros",
      "source": "Banque de développement",
      "doc": "Communiqué, 20 nov. 2026"
     }
    ],
    "photo": PHOTOS.eau,
    "grad": [
     "#3df0ff",
     "#3d7bff",
     "#0d3b66",
     "#08142e"
    ],
    "likes": 504,
    "comments": 57
   },
   {
    "id": "monde-1",
    "title": "La Norvège teste des ferries électriques",
    "hour": "9 h 10",
    "key": "Trois ferries électriques entrent en service sur la côte ouest norvégienne pour une phase de test de six mois.",
    "facts": [
     {
      "text": "<b>3</b> navires en service dès lundi",
      "source": "Autorité maritime norvégienne",
      "doc": "Communiqué, 20 nov. 2026"
     },
     {
      "text": "Autonomie de <b>60 km</b> par charge",
      "source": "Constructeur naval",
      "doc": "Fiche technique, 2026"
     },
     {
      "text": "Recharge en <b>20 minutes</b> à quai",
      "source": "Autorité maritime norvégienne",
      "doc": "Communiqué, 20 nov. 2026"
     }
    ],
    "photo": PHOTOS.fjord,
    "grad": [
     "#7fe0ff",
     "#c86bfa",
     "#123a5c",
     "#0a0d26"
    ],
    "likes": 355,
    "comments": 23
   }
  ]
 },
 {
  "id": "eco",
  "name": "Économie",
  "items": [
   {
    "id": "eco-0",
    "title": "Le chômage recule à 7,1 %",
    "hour": "7 h 30",
    "key": "Le taux de chômage baisse de 0,2 point au troisième trimestre, selon l'institut statistique national.",
    "facts": [
     {
      "text": "<b>7,1 %</b> de la population active",
      "source": "Institut statistique national",
      "doc": "Enquête emploi, 21 nov. 2026"
     },
     {
      "text": "<b>-0,2</b> point en trois mois",
      "source": "Institut statistique national",
      "doc": "Enquête emploi, 21 nov. 2026"
     },
     {
      "text": "<b>2,3 millions</b> de personnes au chômage",
      "source": "Institut statistique national",
      "doc": "Enquête emploi, 21 nov. 2026"
     }
    ],
    "photo": PHOTOS.facade,
    "grad": [
     "#7b5cff",
     "#3dffb0",
     "#1a1b4f",
     "#0b0a24"
    ],
    "likes": 520,
    "comments": 94
   },
   {
    "id": "eco-1",
    "title": "Les ventes de vélos repartent",
    "hour": "8 h 20",
    "key": "Les ventes de vélos neufs progressent de 6 % sur un an, portées par les modèles électriques.",
    "facts": [
     {
      "text": "<b>+6 %</b> de ventes sur un an",
      "source": "Fédération du cycle",
      "doc": "Bilan annuel, 20 nov. 2026"
     },
     {
      "text": "<b>1 vélo sur 3</b> vendu est électrique",
      "source": "Fédération du cycle",
      "doc": "Bilan annuel, 20 nov. 2026"
     },
     {
      "text": "Prix moyen de <b>1 850 €</b> pour un électrique",
      "source": "Fédération du cycle",
      "doc": "Bilan annuel, 20 nov. 2026"
     }
    ],
    "photo": PHOTOS.velo,
    "grad": [
     "#ffd36b",
     "#ff6bd0",
     "#3a1d5c",
     "#100a26"
    ],
    "likes": 468,
    "comments": 37
   },
   {
    "id": "eco-2",
    "title": "Le taux du Livret A maintenu à 2,4 %",
    "hour": "9 h 00",
    "key": "Le taux du Livret A reste inchangé jusqu'au 1er février 2027, annonce le ministère de l'Économie.",
    "facts": [
     {
      "text": "<b>2,4 %</b> de rémunération annuelle",
      "source": "Ministère de l'Économie",
      "doc": "Communiqué, 21 nov. 2026"
     },
     {
      "text": "<b>57 millions</b> de livrets ouverts",
      "source": "Banque centrale",
      "doc": "Statistiques, oct. 2026"
     },
     {
      "text": "Prochaine révision le <b>1er février 2027</b>",
      "source": "Ministère de l'Économie",
      "doc": "Communiqué, 21 nov. 2026"
     }
    ],
    "photo": PHOTOS.batiment,
    "grad": [
     "#6b8bff",
     "#ffcf6b",
     "#1b2350",
     "#0b0a24"
    ],
    "likes": 301,
    "comments": 52
   }
  ]
 },
 {
  "id": "tech",
  "name": "Tech & Science",
  "items": [
   {
    "id": "tech-0",
    "title": "Un satellite cartographie les glaciers alpins",
    "hour": "7 h 55",
    "key": "Un satellite d'observation lancé en octobre transmet ses premières images des glaciers alpins.",
    "facts": [
     {
      "text": "Résolution de <b>50 cm</b> par pixel",
      "source": "Agence spatiale nationale",
      "doc": "Communiqué, 20 nov. 2026"
     },
     {
      "text": "<b>4 000</b> glaciers suivis",
      "source": "Agence spatiale nationale",
      "doc": "Dossier mission, 2026"
     },
     {
      "text": "Données ouvertes dès <b>janvier 2027</b>",
      "source": "Agence spatiale nationale",
      "doc": "Communiqué, 20 nov. 2026"
     }
    ],
    "photo": PHOTOS.sommet,
    "grad": [
     "#b7c8ff",
     "#7b5cff",
     "#1a2a5e",
     "#06071a"
    ],
    "likes": 577,
    "comments": 44
   },
   {
    "id": "tech-1",
    "title": "Un smartphone vendu sur cinq est reconditionné",
    "hour": "8 h 45",
    "key": "Un téléphone vendu sur cinq en France est désormais reconditionné, selon un baromètre annuel.",
    "facts": [
     {
      "text": "<b>21 %</b> des ventes en 2026",
      "source": "Baromètre de l'économie circulaire",
      "doc": "Édition 2026"
     },
     {
      "text": "Prix moyen de <b>289 €</b>",
      "source": "Baromètre de l'économie circulaire",
      "doc": "Édition 2026"
     },
     {
      "text": "Garantie légale de <b>12 mois</b> minimum",
      "source": "Code de la consommation",
      "doc": "Article en vigueur"
     }
    ],
    "photo": null,
    "grad": [
     "#3df0c8",
     "#3d7bff",
     "#0f2d4a",
     "#0a0d26"
    ],
    "likes": 432,
    "comments": 66
   }
  ]
 },
 {
  "id": "sport",
  "name": "Sport",
  "items": [
   {
    "id": "sport-0",
    "title": "Marathon de Lyon : record de participants",
    "hour": "8 h 30",
    "key": "Le marathon de Lyon réunira 18 000 coureurs dimanche, un record depuis sa création.",
    "facts": [
     {
      "text": "<b>18 000</b> inscrits au départ",
      "source": "Organisation du marathon",
      "doc": "Communiqué, 20 nov. 2026"
     },
     {
      "text": "<b>42</b> nationalités représentées",
      "source": "Organisation du marathon",
      "doc": "Liste des inscrits, 2026"
     },
     {
      "text": "Record de l'épreuve : <b>2 h 08 min 12 s</b>",
      "source": "Fédération d'athlétisme",
      "doc": "Palmarès officiel"
     }
    ],
    "photo": PHOTOS.route,
    "grad": [
     "#ff7a5c",
     "#ffd36b",
     "#4a1d3a",
     "#120a1e"
    ],
    "likes": 298,
    "comments": 29
   },
   {
    "id": "sport-1",
    "title": "Nouveau record de France du 200 m",
    "hour": "9 h 20",
    "key": "Une nageuse de 19 ans a battu vendredi soir le record de France du 200 m nage libre en petit bassin.",
    "facts": [
     {
      "text": "Record en <b>1 min 52 s 31</b>",
      "source": "Fédération de natation",
      "doc": "Résultats, 20 nov. 2026"
     },
     {
      "text": "Ancien record datant de <b>2016</b>",
      "source": "Fédération de natation",
      "doc": "Tableau des records"
     },
     {
      "text": "<b>0,4</b> seconde gagnée",
      "source": "Fédération de natation",
      "doc": "Résultats, 20 nov. 2026"
     }
    ],
    "photo": null,
    "grad": [
     "#3dd8ff",
     "#3d7bff",
     "#0b3a6e",
     "#061430"
    ],
    "likes": 812,
    "comments": 48
   },
   {
    "id": "sport-2",
    "title": "Coupe de France : les pros entrent en jeu",
    "hour": "10 h 00",
    "key": "Les clubs de première division font leur entrée ce week-end avec 64 matchs au programme.",
    "facts": [
     {
      "text": "<b>64</b> matchs ce week-end",
      "source": "Fédération de football",
      "doc": "Calendrier officiel"
     },
     {
      "text": "<b>18</b> clubs pros engagés",
      "source": "Fédération de football",
      "doc": "Tirage au sort, 3 nov. 2026"
     },
     {
      "text": "<b>9</b> clubs amateurs encore en lice en région",
      "source": "Ligues régionales",
      "doc": "Résultats, 16 nov. 2026"
     }
    ],
    "photo": null,
    "grad": [
     "#6bff9c",
     "#ffffff",
     "#123d2a",
     "#08140e"
    ],
    "likes": 640,
    "comments": 112
   }
  ]
 },
 {
  "id": "culture",
  "name": "Culture",
  "items": [
   {
    "id": "culture-0",
    "title": "Un prix littéraire jugé par les 18-25 ans",
    "hour": "8 h 10",
    "key": "Un jury de 300 lecteurs de 18 à 25 ans remettra son premier prix littéraire le 15 janvier 2027.",
    "facts": [
     {
      "text": "<b>300</b> jurés de 18 à 25 ans",
      "source": "Centre national du livre",
      "doc": "Communiqué, 20 nov. 2026"
     },
     {
      "text": "<b>12</b> romans en sélection",
      "source": "Centre national du livre",
      "doc": "Première sélection, 20 nov. 2026"
     },
     {
      "text": "Lauréat annoncé le <b>15 janvier 2027</b>",
      "source": "Centre national du livre",
      "doc": "Calendrier du prix"
     }
    ],
    "photo": PHOTOS.livre,
    "grad": [
     "#ffb86b",
     "#c86bfa",
     "#3a2350",
     "#120a22"
    ],
    "likes": 401,
    "comments": 33
   },
   {
    "id": "culture-1",
    "title": "Cinéma : la fréquentation progresse de 8 %",
    "hour": "9 h 35",
    "key": "La fréquentation des salles de cinéma progresse de 8 % sur les dix premiers mois de 2026.",
    "facts": [
     {
      "text": "<b>152 millions</b> d'entrées depuis janvier",
      "source": "Centre national du cinéma",
      "doc": "Estimations, 20 nov. 2026"
     },
     {
      "text": "<b>+8 %</b> sur un an",
      "source": "Centre national du cinéma",
      "doc": "Estimations, 20 nov. 2026"
     },
     {
      "text": "<b>43 %</b> de part pour les films français",
      "source": "Centre national du cinéma",
      "doc": "Estimations, 20 nov. 2026"
     }
    ],
    "photo": null,
    "grad": [
     "#ff5c8a",
     "#7b5cff",
     "#2a0f3a",
     "#0b0618"
    ],
    "likes": 530,
    "comments": 61
   }
  ]
 }
];

// Dernière minute (démo) : horodatée par rapport à l'ouverture de l'app.
const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString();
export const FLASHES: Flash[] = [
  { flash: true, id: 'f1', at: ago(12), title: 'Séisme de magnitude 6,1 au large de la Grèce', sentence: 'La secousse a été ressentie jusqu’à Athènes. Aucune victime signalée pour l’instant selon les autorités grecques.', sources: [{ source: 'franceinfo', url: 'https://exemple.test/f1' }, { source: 'RFI', url: 'https://exemple.test/f1b' }] },
  { flash: true, id: 'f2', at: ago(74), title: 'La BCE baisse ses taux de 0,25 point', sentence: 'Le principal taux directeur passe à 1,75 %. C’est la troisième baisse depuis l’été.', sources: [{ source: 'Les Echos', url: 'https://exemple.test/f2' }, { source: 'Le Monde', url: 'https://exemple.test/f2b' }] },
  { flash: true, id: 'f3', at: ago(185), title: 'Accord trouvé sur le budget au Sénat', sentence: 'Sénateurs et députés se sont entendus sur une version commune du texte, votée définitivement mardi.', sources: [{ source: 'Le Monde', url: 'https://exemple.test/f3' }, { source: '20 Minutes', url: 'https://exemple.test/f3b' }] },
  { flash: true, id: 'f4', at: ago(320), title: 'Tempête : 80 000 foyers privés d’électricité', sentence: 'Les rafales ont dépassé 130 km/h en Bretagne. Enedis prévoit un retour à la normale d’ici demain soir.', sources: [{ source: 'Ouest-France', url: 'https://exemple.test/f4' }, { source: 'franceinfo', url: 'https://exemple.test/f4b' }] },
];
