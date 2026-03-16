import random
from typing import List

questionList = [
{
  "question": {
    "questionText": "Quelle est la consommation en électricité d'une ampoule",
    "options": ["2mW", "4mW", "14mW", "56mW"],
    "questionType": "choice"
  },
  "answer": 3,
  "message": "Une ampoule consomme très peu d’électricité. 56 mW représente une petite quantité d’énergie, un peu comme laisser un petit appareil électronique allumé pendant longtemps."
},
{
  "question": {
    "questionText": "Quelle est la consommation électrique moyenne d'une machine à laver standard au Québec par cycle de lavage ?",
    "options": ["0,5 kWh", "1,0 kWh"],
    "questionType": "choice"
  },
  "answer": 1,
  "message": "Un cycle de lavage consomme environ 1 kWh. C’est à peu près la même quantité d’électricité qu’une ampoule LED de 10 W laissée allumée pendant environ 4 jours."
},
{
  "question": {
    "questionText": "Quelle est la consommation électrique moyenne annuelle d'une maison unifamiliale au Québec ?",
    "options": ["5 000 kWh", "10 000 kWh", "15 000 kWh"],
    "questionType": "choice"
  },
  "answer": 2,
  "message": "Une maison au Québec consomme environ 15 000 kWh par année, surtout à cause du chauffage électrique pendant l’hiver. Cela représente l’énergie nécessaire pour faire fonctionner tous les appareils et chauffer la maison pendant 12 mois."
},
{
  "question": {
    "questionText": "Quelle est la consommation électrique approximative d'une ampoule LED standard (10 W) laissée allumée 24h par jour pendant un mois entier ?",
    "options": ["0,7 kWh", "7,2 kWh", "72 kWh", "720 kWh"],
    "questionType": "choice"
  },
  "answer": 1,
  "message": "Une ampoule LED de 10 W consomme très peu d’énergie. Si elle reste allumée jour et nuit pendant un mois, elle utilisera environ 7,2 kWh, ce qui coûte moins d’un dollar d’électricité au Québec."
},
{
  "question": {
    "questionText": "Quel appareil consomme généralement le plus d'électricité dans une maison au Québec ?",
    "options": ["Le réfrigérateur", "Le chauffage électrique", "La télévision", "Le micro-ondes"],
    "questionType": "choice"
  },
  "answer": 1,
  "message": "Au Québec, le chauffage électrique consomme le plus d’électricité parce que les hivers sont très froids. Chauffer une maison pendant plusieurs mois demande beaucoup plus d’énergie que les autres appareils."
},
{
  "question": {
    "questionText": "Quelle est la puissance moyenne d’un chauffe-eau électrique résidentiel ?",
    "options": ["500 W", "1 200 W", "3 000 W", "6 000 W"],
    "questionType": "choice"
  },
  "answer": 3,
  "message": "Un chauffe-eau utilise environ 6000 W lorsqu’il chauffe l’eau. C’est beaucoup d’énergie, car il doit réchauffer plusieurs dizaines de litres d’eau pour la douche, la vaisselle et la lessive."
},
{
  "question": {
    "questionText": "Combien de kWh consomme environ un sécheuse électrique par cycle ?",
    "options": ["0,5 kWh", "2 à 3 kWh"],
    "questionType": "choice"
  },
  "answer": 1,
  "message": "Une sécheuse utilise environ 2 à 3 kWh par cycle. Cela correspond à peu près à l’énergie utilisée par plusieurs ampoules LED allumées pendant toute une journée."
},
{
  "question": {
    "questionText": "Quelle est la tension standard du réseau résidentiel au Québec ?",
    "options": ["110 V", "120/240 V", "230 V", "347 V"],
    "questionType": "choice"
  },
  "answer": 1,
  "message": "Au Québec, les maisons utilisent un système électrique de 120/240 volts. Les prises normales utilisent 120 V pour les petits appareils, tandis que les gros appareils comme la cuisinière ou la sécheuse utilisent 240 V."
},
{
  "question": {
    "questionText": "Combien coûte approximativement 1 kWh d’électricité résidentielle au Québec (tarif de base) ?",
    "options": ["0,02 $", "0,07 $", "0,25 $", "1,00 $"],
    "questionType": "choice"
  },
  "answer": 1,
  "message": "Au Québec, l’électricité est relativement peu chère. Un kWh coûte environ 0,07 $, ce qui signifie qu’utiliser un appareil de 1000 W pendant une heure coûte environ 7 cents."
},
{
  "question": {
    "questionText": "Quelle est la principale source de production d’électricité au Québec ?",
    "options": ["Nucléaire", "Charbon", "Hydroélectricité", "Éolien"],
    "questionType": "choice"
  },
  "answer": 2,
  "message": "La majorité de l’électricité au Québec est produite grâce à l’hydroélectricité. Cela signifie qu’on utilise la force de l’eau des barrages pour produire de l’énergie."
},
{
  "question": {
    "questionText": "Combien consomme en moyenne un four électrique utilisé pendant une heure ?",
    "options": ["0,2 kWh", "1 à 2 kWh", "5 à 7 kWh", "15 kWh"],
    "questionType": "choice"
  },
  "answer": 2,
  "message": "Un four électrique peut consommer entre 5 et 7 kWh s’il fonctionne pendant une heure. Cela représente beaucoup d’énergie, car il doit produire beaucoup de chaleur pour cuire les aliments."
},
{
  "question": {
    "questionText": "Quel est l’impact principal de l’isolation sur la consommation énergétique d’une maison ?",
    "options": ["Augmente la consommation", "Réduit les pertes de chaleur", "Augmente la tension électrique", "Réduit la puissance du compteur"],
    "questionType": "choice"
  },
  "answer": 1,
  "message": "Une bonne isolation empêche la chaleur de sortir de la maison en hiver. Cela signifie que le chauffage travaille moins et consomme donc moins d’électricité."
},
{
  "question": {
    "questionText": "Quelle unité est utilisée pour mesurer la consommation d’électricité ?",
    "options": ["Volt", "Ampère", "Watt", "Kilowattheure (kWh)"],
    "questionType": "choice"
  },
  "answer": 3,
  "message": "La consommation d’électricité se mesure en kilowattheures (kWh). C’est l’unité utilisée sur les factures d’électricité pour montrer combien d’énergie une maison a utilisée."
},
{
  "question": {
    "questionText": "Combien consomme environ un climatiseur portatif en fonctionnement continu pendant une heure ?",
    "options": ["0,1 kWh", "1 à 1,5 kWh", "5 kWh", "20 kWh"],
    "questionType": "choice"
  },
  "answer": 1,
  "message": "Un climatiseur portatif consomme environ 1 à 1,5 kWh par heure. C’est similaire à l’énergie utilisée par plusieurs gros appareils électroniques en même temps."
},
{
  "question": {
    "questionText": "Combien consomme environ un réfrigérateur moderne par année ?",
    "options": ["50 kWh", "150 kWh", "400 kWh"],
    "questionType": "choice"
  },
  "answer": 2,
  "message": "Un réfrigérateur fonctionne 24h sur 24 toute l’année. Même s’il consomme peu à chaque instant, cela représente environ 400 kWh sur une année complète."
},

{
  "question": {
    "questionText": "Quelle habitude permet de réduire la consommation d’électricité à la maison ?",
    "options": ["1", "2", "3", "4"],
    "questionType": "order"
  },
  "answer": [0, 1, 2, 3],
  "message": "Une meilleure isolation garde la chaleur à l’intérieur en hiver et la fraîcheur en été. Cela réduit l’utilisation du chauffage et du climatiseur, ce qui diminue la consommation d’électricité."
},
{
  "question": {
    "questionText": "Quelle habitude permet de réduire la consommation d’électricité à la maison ?",
    "options": ["1", "2", "3", "4"],
    "questionType": "order"
  },
  "answer": [0, 1, 2, 3],
  "message": "Une meilleure isolation garde la chaleur à l’intérieur en hiver et la fraîcheur en été. Cela réduit l’utilisation du chauffage et du climatiseur, ce qui diminue la consommation d’électricité."
},
{
  "question": {
    "questionText": "Quelle habitude permet de réduire la consommation d’électricité à la maison ?",
    "options": ["1", "2", "3", "4"],
    "questionType": "order"
  },
  "answer": [0, 1, 2, 3],
  "message": "Une meilleure isolation garde la chaleur à l’intérieur en hiver et la fraîcheur en été. Cela réduit l’utilisation du chauffage et du climatiseur, ce qui diminue la consommation d’électricité."
},
{
  "question": {
    "questionText": "Quelle habitude permet de réduire la consommation d’électricité à la maison ?",
    "options": ["1", "2", "3", "4"],
    "questionType": "order"
  },
  "answer": [0, 1, 2, 3],
  "message": "Une meilleure isolation garde la chaleur à l’intérieur en hiver et la fraîcheur en été. Cela réduit l’utilisation du chauffage et du climatiseur, ce qui diminue la consommation d’électricité."
},
{
  "question": {
    "questionText": "Quelle habitude permet de réduire la consommation d’électricité à la maison ?",
    "options": ["1", "2", "3", "4"],
    "questionType": "order"
  },
  "answer": [0, 1, 2, 3],
  "message": "Une meilleure isolation garde la chaleur à l’intérieur en hiver et la fraîcheur en été. Cela réduit l’utilisation du chauffage et du climatiseur, ce qui diminue la consommation d’électricité."
},
{
  "question": {
    "questionText": "Quelle habitude permet de réduire la consommation d’électricité à la maison ?",
    "options": ["1", "2", "3", "4"],
    "questionType": "order"
  },
  "answer": [0, 1, 2, 3],
  "message": "Une meilleure isolation garde la chaleur à l’intérieur en hiver et la fraîcheur en été. Cela réduit l’utilisation du chauffage et du climatiseur, ce qui diminue la consommation d’électricité."
},
{
  "question": {
    "questionText": "Quelle habitude permet de réduire la consommation d’électricité à la maison ?",
    "options": ["1", "2", "3", "4"],
    "questionType": "order"
  },
  "answer": [0, 1, 2, 3],
  "message": "Une meilleure isolation garde la chaleur à l’intérieur en hiver et la fraîcheur en été. Cela réduit l’utilisation du chauffage et du climatiseur, ce qui diminue la consommation d’électricité."
},
{
  "question": {
    "questionText": "Quelle habitude permet de réduire la consommation d’électricité à la maison ?",
    "options": ["1", "2", "3", "4"],
    "questionType": "order"
  },
  "answer": [0, 1, 2, 3],
  "message": "Une meilleure isolation garde la chaleur à l’intérieur en hiver et la fraîcheur en été. Cela réduit l’utilisation du chauffage et du climatiseur, ce qui diminue la consommation d’électricité."
},
{
  "question": {
    "questionText": "Quelle habitude permet de réduire la consommation d’électricité à la maison ?",
    "options": ["1", "2", "3", "4"],
    "questionType": "order"
  },
  "answer": [0, 1, 2, 3],
  "message": "Une meilleure isolation garde la chaleur à l’intérieur en hiver et la fraîcheur en été. Cela réduit l’utilisation du chauffage et du climatiseur, ce qui diminue la consommation d’électricité."
},
{
  "question": {
    "questionText": "Quelle habitude permet de réduire la consommation d’électricité à la maison ?",
    "options": ["1", "2", "3", "4"],
    "questionType": "order"
  },
  "answer": [0, 1, 2, 3],
  "message": "Une meilleure isolation garde la chaleur à l’intérieur en hiver et la fraîcheur en été. Cela réduit l’utilisation du chauffage et du climatiseur, ce qui diminue la consommation d’électricité."
},
{
  "question": {
    "questionText": "Quelle habitude permet de réduire la consommation d’électricité à la maison ?",
    "options": ["1", "2", "3", "4"],
    "questionType": "order"
  },
  "answer": [0, 1, 2, 3],
  "message": "Une meilleure isolation garde la chaleur à l’intérieur en hiver et la fraîcheur en été. Cela réduit l’utilisation du chauffage et du climatiseur, ce qui diminue la consommation d’électricité."
},
{
  "question": {
    "questionText": "Quelle habitude permet de réduire la consommation d’électricité à la maison ?",
    "options": ["1", "2", "3", "4"],
    "questionType": "order"
  },
  "answer": [0, 1, 2, 3],
  "message": "Une meilleure isolation garde la chaleur à l’intérieur en hiver et la fraîcheur en été. Cela réduit l’utilisation du chauffage et du climatiseur, ce qui diminue la consommation d’électricité."
},
{
  "question": {
    "questionText": "Quelle habitude permet de réduire la consommation d’électricité à la maison ?",
    "options": ["1", "2", "3", "4"],
    "questionType": "order"
  },
  "answer": [0, 1, 2, 3],
  "message": "Une meilleure isolation garde la chaleur à l’intérieur en hiver et la fraîcheur en été. Cela réduit l’utilisation du chauffage et du climatiseur, ce qui diminue la consommation d’électricité."
},
{
  "question": {
    "questionText": "Quelle habitude permet de réduire la consommation d’électricité à la maison ?",
    "options": ["1", "2", "3", "4"],
    "questionType": "order"
  },
  "answer": [0, 1, 2, 3],
  "message": "Une meilleure isolation garde la chaleur à l’intérieur en hiver et la fraîcheur en été. Cela réduit l’utilisation du chauffage et du climatiseur, ce qui diminue la consommation d’électricité."
},
{
  "question": {
    "questionText": "Quelle habitude permet de réduire la consommation d’électricité à la maison ?",
    "options": ["1", "2", "3", "4"],
    "questionType": "order"
  },
  "answer": [0, 1, 2, 3],
  "message": "Une meilleure isolation garde la chaleur à l’intérieur en hiver et la fraîcheur en été. Cela réduit l’utilisation du chauffage et du climatiseur, ce qui diminue la consommation d’électricité."
},
{
  "question": {
    "questionText": "Quelle habitude permet de réduire la consommation d’électricité à la maison ?",
    "options": ["1", "2", "3", "4"],
    "questionType": "order"
  },
  "answer": [0, 1, 2, 3],
  "message": "Une meilleure isolation garde la chaleur à l’intérieur en hiver et la fraîcheur en été. Cela réduit l’utilisation du chauffage et du climatiseur, ce qui diminue la consommation d’électricité."
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