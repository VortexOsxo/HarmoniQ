import random
from typing import List

questionList = [
  {
    "question": {
      "questionText": "La « puissance » électrique (kW) et l'« énergie » électrique (kWh) mesurent exactement la même chose, mais à des échelles différentes.",
      "options": [
        "Vrai",
        "Faux"
      ],
      "questionType": "choice",
      "questionAspect": "energy"
    },
    "answer": 1,
    "message": "Faux. La puissance (en kW) est l'intensité instantanée demandée par un appareil. L'énergie (en kWh) est la quantité totale d'électricité consommée sur une période."
  },
  {
    "question": {
      "questionText": "L'hydroélectricité, une source d'énergie propre et renouvelable, représente plus de 99 % de l'électricité produite au Québec.",
      "options": [
        "Vrai",
        "Faux"
      ],
      "questionType": "choice",
      "questionAspect": "environment"
    },
    "answer": 0,
    "message": "Vrai. Grâce à ses nombreux barrages, le réseau québécois possède l'une des empreintes carbone liées à la production d'électricité les plus faibles au monde."
  },
  {
    "question": {
      "questionText": "Faire fonctionner sa sécheuse à 21h plutôt qu'à 17h30 en plein hiver n'a aucun impact environnemental, puisque l'électricité québécoise est 100% verte.",
      "options": [
        "Vrai",
        "Faux"
      ],
      "questionType": "choice",
      "questionAspect": "environment"
    },
    "answer": 1,
    "message": "Faux. Les heures de pointe hivernales (matin et soir) mettent une pression immense sur le réseau. Décaler sa consommation évite d'importer de l'électricité produite avec du gaz ou du charbon."
  },
  {
    "question": {
      "questionText": "Pourquoi la gestion de la « pointe hivernale » est-elle le plus grand défi environnemental et économique du réseau québécois ?",
      "options": [
        "Parce que le froid extrême gèle l'eau des barrages, réduisant la production.",
        "Parce que la surconsommation simultanée oblige le réseau à importer de l'énergie souvent plus polluante et très chère.",
        "Parce que les lignes à haute tension risquent de briser sous le poids des électrons.",
        "Parce que les éoliennes doivent être arrêtées lorsqu'il neige."
      ],
      "questionType": "choice",
      "questionAspect": "environment"
    },
    "answer": 1,
    "message": "Lisser la demande évite de devoir construire de nouvelles infrastructures coûteuses ou d'acheter de l'énergie fossile juste pour répondre à un besoin qui ne dure que quelques heures par jour."
  },
  {
    "question": {
      "questionText": "Le poids de nos habitudes : Au Québec, quelle est la source de consommation électrique qui coûte le plus cher sur votre facture et qui demande le plus d'efforts au réseau en hiver ?",
      "options": [
        "L'éclairage de la maison et les décorations de Noël.",
        "L'eau chaude pour les douches et le lavage.",
        "Le chauffage des pièces de la maison.",
        "Les appareils électroniques (télévisions, ordinateurs, chargeurs)."
      ],
      "questionType": "choice",
      "questionAspect": "environment"
    },
    "answer": 2,
    "message": "Le chauffage représente plus de 50 % de la facture d'électricité d'un foyer québécois moyen. Baisser le thermostat d'un ou deux degrés lors des grands froids est le geste le plus puissant pour aider le réseau."
  },
  {
    "question": {
      "questionText": "L'analogie de l'autoroute : Si on compare le réseau électrique à une autoroute, quel est le principal problème lors des froids extrêmes de janvier à 17h00 ?",
      "options": [
        "Il n'y a pas assez d'eau dans les barrages pour avancer.",
        "L'électricité circule plus lentement dans les fils à cause du gel.",
        "Tout le monde veut emprunter l'autoroute en même temps, ce qui crée un immense bouchon (la pointe de puissance).",
        "Les voies de l'autoroute rétrécissent avec le froid."
      ],
      "questionType": "choice",
      "questionAspect": "environment"
    },
    "answer": 2,
    "message": "Le réseau produit suffisamment d'énergie au total, mais quand tout le monde allume ses gros appareils en rentrant du travail, l'autoroute électrique est congestionnée. Il faut décaler nos usages."
  },
  {
    "question": {
      "questionText": "L'échelle de la consommation : Ordonnez ces appareils ménagers de celui qui demande le PLUS de puissance au réseau à celui qui en demande le MOINS, lorsqu'ils sont allumés.",
      "options": [
        "Ampoule DEL",
        "Grille-pain",
        "Ordinateur portable",
        "Plinthe électrique (Chauffage)",
        "Sécheuse"
      ],
      "questionType": "order",
      "questionAspect": "environment"
    },
    "answer": [
      3,
      4,
      1,
      2,
      0
    ],
    "message": "L'ordre correct : Plinthe électrique, Sécheuse, Grille-pain, Ordinateur, Ampoule DEL. Les appareils qui génèrent de la chaleur sont les plus exigeants en puissance. C'est leur utilisation simultanée qui crée les pointes."
  },
  {
    "question": {
      "questionText": "Le parcours de l'énergie : Mettez dans l'ordre les étapes du parcours de l'électricité, de la goutte d'eau jusqu'à votre salon.",
      "options": [
        "Consommation (à la maison)",
        "Distribution (lignes de rue)",
        "Production (barrages)",
        "Transformation (postes de quartier)",
        "Transport (lignes à très haute tension)"
      ],
      "questionType": "order",
      "questionAspect": "environment"
    },
    "answer": [
      2,
      4,
      3,
      1,
      0
    ],
    "message": "L'ordre correct : Production, Transport, Transformation, Distribution, Consommation. La force de l'eau fait tourner les turbines, l'énergie voyage loin, est abaissée en tension, distribuée, puis utilisée."
  },
  {
    "question": {
      "questionText": "L'impact de nos gestes au quotidien : Ordonnez ces gestes écoresponsables du PLUS EFFICACE au MOINS EFFICACE pour réduire significativement la pression sur le réseau québécois.",
      "options": [
        "Baisser les thermostats de 2°C la nuit et lors des absences",
        "Débrancher son chargeur de cellulaire inutilisé",
        "Laver ses vêtements à l'eau froide plutôt qu'à l'eau chaude",
        "Éteindre la lumière en quittant une pièce"
      ],
      "questionType": "order",
      "questionAspect": "environment"
    },
    "answer": [
      0,
      2,
      3,
      1
    ],
    "message": "L'ordre correct : Baisser les thermostats, Laver à l'eau froide, Éteindre la lumière, Débrancher le chargeur. Le chauffage et l'eau chaude sont les vrais nerfs de la guerre en efficacité énergétique au Québec."
  },
  {
    "question": {
      "questionText": "Les échelles de production : Pour bien comprendre la force de notre réseau, ordonnez ces sources de production de la PLUS PETITE capacité à la PLUS GIGANTESQUE.",
      "options": [
        "Le complexe hydroélectrique Robert-Bourassa (Baie-James)",
        "Un panneau solaire résidentiel",
        "Une centrale \"au fil de l'eau\" près d'une ville",
        "Une éolienne moderne en Gaspésie"
      ],
      "questionType": "order",
      "questionAspect": "environment"
    },
    "answer": [
      1,
      3,
      2,
      0
    ],
    "message": "L'ordre correct : Panneau solaire, Éolienne, Centrale au fil de l'eau, Complexe Robert-Bourassa. Bien que nous ayons des infrastructures titanesques, l'ajout d'autres sources et la sobriété énergétique sont indispensables pour l'avenir."
  },

{
    "question": {
      "questionText": "Un appareil en mode veille (télévision, console de jeux) ne consomme pratiquement aucune électricité.",
      "options": ["Vrai", "Faux"],
      "questionType": "choice",
      "questionAspect": "energy"
    },
    "answer": 1,
    "message": "Faux. Les appareils en veille peuvent représenter jusqu'à 10 % de la facture d'électricité annuelle d'un foyer. On appelle ce phénomène la « consommation fantôme »."
  },
  {
    "question": {
      "questionText": "Un chauffe-eau électrique standard consomme de l'énergie même la nuit, lorsque personne n'utilise d'eau chaude.",
      "options": ["Vrai", "Faux"],
      "questionType": "choice",
      "questionAspect": "energy"
    },
    "answer": 0,
    "message": "Vrai. Le chauffe-eau maintient l'eau à température constante 24h/24. Programmer une plage de repos nocturne ou installer un minuteur peut réduire sa consommation de 15 à 20 %."
  },
  {
    "question": {
      "questionText": "Laquelle de ces affirmations sur les thermostats intelligents est vraie ?",
      "options": [
        "Ils consomment tellement d'électricité qu'ils annulent leurs propres économies.",
        "Ils apprennent vos habitudes et peuvent réduire votre facture de chauffage de 10 à 25 %.",
        "Ils sont uniquement utiles dans les maisons neuves.",
        "Ils ne fonctionnent qu'avec des systèmes de chauffage à air pulsé."
      ],
      "questionType": "choice",
      "questionAspect": "energy"
    },
    "answer": 1,
    "message": "Un thermostat intelligent ajuste automatiquement la température selon vos présences et absences. Combiné à des baisses nocturnes, il s'agit de l'un des investissements les plus rentables pour un ménage québécois."
  },
  {
    "question": {
      "questionText": "Ordonnez ces appareils du PLUS ÉNERGIVORE au MOINS ÉNERGIVORE sur une base annuelle dans un foyer québécois moyen.",
      "options": [
        "Chauffe-eau électrique",
        "Climatiseur central",
        "Lave-vaisselle",
        "Réfrigérateur",
        "Système de chauffage électrique"
      ],
      "questionType": "order",
      "questionAspect": "energy"
    },
    "answer": [4, 0, 1, 3, 2],
    "message": "L'ordre correct : Chauffage, Chauffe-eau, Climatiseur, Réfrigérateur, Lave-vaisselle. Le chauffage et l'eau chaude dominent largement la consommation annuelle dans notre climat."
  },
  {
    "question": {
      "questionText": "Ordonnez ces actions du PLUS GRAND au PLUS PETIT impact sur la réduction de votre consommation d'énergie hivernale.",
      "options": [
        "Ajouter de l'isolation dans les combles",
        "Calfeutrer les fenêtres et portes mal jointées",
        "Remplacer ses ampoules par des DEL",
        "Réduire la température du chauffe-eau de 60°C à 55°C",
        "Utiliser une barre multiprises avec interrupteur"
      ],
      "questionType": "order",
      "questionAspect": "energy"
    },
    "answer": [0, 1, 3, 4, 2],
    "message": "L'ordre correct : Isolation des combles, Calfeutrage, Réduction du chauffe-eau, Barre multiprises, Remplacement des ampoules. L'enveloppe du bâtiment est le premier levier : retenir la chaleur vaut mieux que d'en produire davantage."
  },

  {
    "question": {
      "questionText": "Au Québec, le tarif résidentiel d'Hydro-Québec est l'un des plus bas en Amérique du Nord.",
      "options": ["Vrai", "Faux"],
      "questionType": "choice",
      "questionAspect": "economy"
    },
    "answer": 0,
    "message": "Vrai. Grâce à l'hydroélectricité publique, les Québécois paient leur électricité jusqu'à 3 fois moins cher que leurs voisins ontariens ou américains. Cet avantage est un legs collectif à préserver."
  },
  {
    "question": {
      "questionText": "Les hausses tarifaires d'Hydro-Québec sont fixées librement par la société d'État, sans aucune supervision extérieure.",
      "options": ["Vrai", "Faux"],
      "questionType": "choice",
      "questionAspect": "economy"
    },
    "answer": 1,
    "message": "Faux. Les tarifs sont réglementés par la Régie de l'énergie du Québec, un organisme indépendant qui évalue les demandes de hausse d'Hydro-Québec et protège les intérêts des consommateurs."
  },
  {
    "question": {
      "questionText": "Quelle est la principale raison pour laquelle Hydro-Québec cherche à exporter son électricité vers les États-Unis ?",
      "options": [
        "Parce que les Québécois n'en ont plus besoin avec l'arrivée des panneaux solaires.",
        "Pour générer des revenus qui financent ses infrastructures et limitent les hausses tarifaires pour les résidents.",
        "Parce que l'électricité se périme si elle n'est pas utilisée rapidement.",
        "Pour respecter un accord de libre-échange obligatoire avec les États-Unis."
      ],
      "questionType": "choice",
      "questionAspect": "economy"
    },
    "answer": 1,
    "message": "Les exportations d'électricité sont une source de revenus majeure pour Hydro-Québec. Ces profits sont versés en dividendes au gouvernement du Québec, réduisant d'autant la pression fiscale sur les citoyens."
  },
  {
    "question": {
      "questionText": "Face à la croissance de la demande (électrification des transports, nouvelles usines), comment Hydro-Québec prévoit-elle principalement d'augmenter sa production d'ici 2035 ?",
      "options": [
        "En construisant uniquement de nouveaux grands barrages comme à la Baie-James.",
        "En achetant de l'énergie nucléaire à l'Ontario.",
        "En combinant éolien, solaire, petites centrales et efficacité énergétique.",
        "En installant des générateurs au gaz naturel pour les périodes de pointe."
      ],
      "questionType": "choice",
      "questionAspect": "economy"
    },
    "answer": 2,
    "message": "Le Plan d'action 2035 d'Hydro-Québec mise sur un portefeuille diversifié. Les grands barrages sont rares et longs à bâtir ; l'éolien et l'efficacité énergétique sont désormais les leviers les plus rapides et économiques."
  },
  {
    "question": {
      "questionText": "Ordonnez ces postes de dépenses du PLUS GRAND au PLUS PETIT dans la facture d'électricité annuelle moyenne d'un ménage québécois.",
      "options": [
        "Chauffage de l'eau",
        "Chauffage des pièces",
        "Cuisson et électroménagers",
        "Éclairage",
        "Électronique et divertissement"
      ],
      "questionType": "order",
      "questionAspect": "economy"
    },
    "answer": [1, 0, 2, 4, 3],
    "message": "L'ordre correct : Chauffage des pièces (~54 %), Chauffage de l'eau (~18 %), Électroménagers (~13 %), Électronique (~9 %), Éclairage (~6 %). Agir sur le chauffage est de loin le geste économique le plus puissant."
  },
  {
    "question": {
      "questionText": "Ordonnez ces rénovations écoénergétiques de celle offrant le MEILLEUR retour sur investissement (économies vs coût) à celle offrant le MOINS BON retour.",
      "options": [
        "Calfeutrage et coupe-froid (portes, fenêtres)",
        "Installation de panneaux solaires résidentiels",
        "Remplacement d'un vieux chauffe-eau par un chauffe-eau thermopompe",
        "Remplacement de toutes les fenêtres de la maison",
        "Thermostat intelligent"
      ],
      "questionType": "order",
      "questionAspect": "economy"
    },
    "answer": [0, 4, 2, 3, 1],
    "message": "L'ordre correct : Calfeutrage, Thermostat intelligent, Chauffe-eau thermopompe, Fenêtres, Panneaux solaires. Au Québec, les tarifs bas d'électricité allongent le temps de récupération des panneaux solaires comparativement à d'autres provinces."
  },
  {
    "question": {
      "questionText": "Ordonnez ces événements historiques liés à l'énergie au Québec du PLUS ANCIEN au PLUS RÉCENT.",
      "options": [
        "Création d'Hydro-Québec par le gouvernement Godbout",
        "Grande panne de verglas (crise du calcaire)",
        "Nationalisation de l'électricité sous René Lévesque et Jean Lesage",
        "Début de la construction du complexe hydroélectrique de la Baie-James",
        "Lancement du Plan d'action 2035 pour l'électrification et la croissance verte"
      ],
      "questionType": "order",
      "questionAspect": "economy"
    },
    "answer": [0, 2, 3, 1, 4],
    "message": "L'ordre correct : Création d'Hydro-Québec (1944), Nationalisation (1963), Baie-James (1971), Verglas (1998), Plan 2035 (2023). Chaque étape a forgé le rapport unique des Québécois à leur électricité collective."
  }
]

#This function selects a random question from the question bank
#and sends it back to the user.
def selectQuestion(answeredQuestionList: List[int]):
    fullQuestionList = []
    QUESTIONS_PER_QUIZ = 10
    NO_MORE_QUESTION_FLAG = -2
    
    while len(fullQuestionList) < QUESTIONS_PER_QUIZ:
        candidate = random.randint(0, len(questionList) - 1)
        
        if candidate not in answeredQuestionList:
            answeredQuestionList.append(candidate)
            fullQuestionList.append(questionList[candidate])
    #If the user can't do a new quiz with the questions remaining
    #the answer list is cleared and we send a message to the client
    if len(answeredQuestionList) + QUESTIONS_PER_QUIZ > len(questionList):
        return fullQuestionList, [NO_MORE_QUESTION_FLAG]
            
    return fullQuestionList, answeredQuestionList