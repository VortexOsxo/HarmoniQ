import random
from typing import List


questionList = [
{
  "question": {
    "questionText": "Quelle est la consommation en électricité d'une ampoule",
    "options": ["2mW", "4mW", "14mW", "56mW"]
  },
  "answer": 3,
  "message": "Une ampoule consomme très peu d’électricité. 56 mW représente une petite quantité d’énergie, un peu comme laisser un petit appareil électronique allumé pendant longtemps."
},
{
  "question": {
    "questionText": "Quelle est la consommation électrique moyenne d'une machine à laver standard au Québec par cycle de lavage ?",
    "options": ["0,5 kWh", "1,0 kWh", "2,0 kWh", "5,0 kWh"]
  },
  "answer": 1,
  "message": "Un cycle de lavage consomme environ 1 kWh. C’est à peu près la même quantité d’électricité qu’une ampoule LED de 10 W laissée allumée pendant environ 4 jours."
},
{
  "question": {
    "questionText": "Quelle est la consommation électrique moyenne annuelle d'une maison unifamiliale au Québec ?",
    "options": ["5 000 kWh", "10 000 kWh", "15 000 kWh", "25 000 kWh"]
  },
  "answer": 2,
  "message": "Une maison au Québec consomme environ 15 000 kWh par année, surtout à cause du chauffage électrique pendant l’hiver. Cela représente l’énergie nécessaire pour faire fonctionner tous les appareils et chauffer la maison pendant 12 mois."
},
{
  "question": {
    "questionText": "Quelle est la consommation électrique approximative d'une ampoule LED standard (10 W) laissée allumée 24h par jour pendant un mois entier ?",
    "options": ["0,7 kWh", "7,2 kWh", "72 kWh", "720 kWh"]
  },
  "answer": 1,
  "message": "Une ampoule LED de 10 W consomme très peu d’énergie. Si elle reste allumée jour et nuit pendant un mois, elle utilisera environ 7,2 kWh, ce qui coûte moins d’un dollar d’électricité au Québec."
},
{
  "question": {
    "questionText": "Quel appareil consomme généralement le plus d'électricité dans une maison au Québec ?",
    "options": ["Le réfrigérateur", "Le chauffage électrique", "La télévision", "Le micro-ondes"]
  },
  "answer": 1,
  "message": "Au Québec, le chauffage électrique consomme le plus d’électricité parce que les hivers sont très froids. Chauffer une maison pendant plusieurs mois demande beaucoup plus d’énergie que les autres appareils."
},
{
  "question": {
    "questionText": "Quelle est la puissance moyenne d’un chauffe-eau électrique résidentiel ?",
    "options": ["500 W", "1 200 W", "3 000 W", "6 000 W"]
  },
  "answer": 3,
  "message": "Un chauffe-eau utilise environ 6000 W lorsqu’il chauffe l’eau. C’est beaucoup d’énergie, car il doit réchauffer plusieurs dizaines de litres d’eau pour la douche, la vaisselle et la lessive."
},
{
  "question": {
    "questionText": "Combien de kWh consomme environ un sécheuse électrique par cycle ?",
    "options": ["0,5 kWh", "2 à 3 kWh", "10 kWh", "25 kWh"]
  },
  "answer": 1,
  "message": "Une sécheuse utilise environ 2 à 3 kWh par cycle. Cela correspond à peu près à l’énergie utilisée par plusieurs ampoules LED allumées pendant toute une journée."
},
{
  "question": {
    "questionText": "Quelle est la tension standard du réseau résidentiel au Québec ?",
    "options": ["110 V", "120/240 V", "230 V", "347 V"]
  },
  "answer": 1,
  "message": "Au Québec, les maisons utilisent un système électrique de 120/240 volts. Les prises normales utilisent 120 V pour les petits appareils, tandis que les gros appareils comme la cuisinière ou la sécheuse utilisent 240 V."
},
{
  "question": {
    "questionText": "Combien coûte approximativement 1 kWh d’électricité résidentielle au Québec (tarif de base) ?",
    "options": ["0,02 $", "0,07 $", "0,25 $", "1,00 $"]
  },
  "answer": 1,
  "message": "Au Québec, l’électricité est relativement peu chère. Un kWh coûte environ 0,07 $, ce qui signifie qu’utiliser un appareil de 1000 W pendant une heure coûte environ 7 cents."
},
{
  "question": {
    "questionText": "Quelle est la principale source de production d’électricité au Québec ?",
    "options": ["Nucléaire", "Charbon", "Hydroélectricité", "Éolien"]
  },
  "answer": 2,
  "message": "La majorité de l’électricité au Québec est produite grâce à l’hydroélectricité. Cela signifie qu’on utilise la force de l’eau des barrages pour produire de l’énergie."
},
{
  "question": {
    "questionText": "Combien consomme en moyenne un four électrique utilisé pendant une heure ?",
    "options": ["0,2 kWh", "1 à 2 kWh", "5 à 7 kWh", "15 kWh"]
  },
  "answer": 2,
  "message": "Un four électrique peut consommer entre 5 et 7 kWh s’il fonctionne pendant une heure. Cela représente beaucoup d’énergie, car il doit produire beaucoup de chaleur pour cuire les aliments."
},
{
  "question": {
    "questionText": "Quel est l’impact principal de l’isolation sur la consommation énergétique d’une maison ?",
    "options": ["Augmente la consommation", "Réduit les pertes de chaleur", "Augmente la tension électrique", "Réduit la puissance du compteur"]
  },
  "answer": 1,
  "message": "Une bonne isolation empêche la chaleur de sortir de la maison en hiver. Cela signifie que le chauffage travaille moins et consomme donc moins d’électricité."
},
{
  "question": {
    "questionText": "Quelle unité est utilisée pour mesurer la consommation d’électricité ?",
    "options": ["Volt", "Ampère", "Watt", "Kilowattheure (kWh)"]
  },
  "answer": 3,
  "message": "La consommation d’électricité se mesure en kilowattheures (kWh). C’est l’unité utilisée sur les factures d’électricité pour montrer combien d’énergie une maison a utilisée."
},
{
  "question": {
    "questionText": "Combien consomme environ un climatiseur portatif en fonctionnement continu pendant une heure ?",
    "options": ["0,1 kWh", "1 à 1,5 kWh", "5 kWh", "20 kWh"]
  },
  "answer": 1,
  "message": "Un climatiseur portatif consomme environ 1 à 1,5 kWh par heure. C’est similaire à l’énergie utilisée par plusieurs gros appareils électroniques en même temps."
},
{
  "question": {
    "questionText": "Combien consomme environ un réfrigérateur moderne par année ?",
    "options": ["50 kWh", "150 kWh", "400 kWh", "2000 kWh"]
  },
  "answer": 2,
  "message": "Un réfrigérateur fonctionne 24h sur 24 toute l’année. Même s’il consomme peu à chaque instant, cela représente environ 400 kWh sur une année complète."
},
{
  "question": {
    "questionText": "Quelle est la puissance approximative d’un micro-ondes domestique ?",
    "options": ["100 W", "700 à 1200 W", "3000 W", "8000 W"]
  },
  "answer": 1,
  "message": "Un micro-ondes utilise environ 700 à 1200 watts lorsqu’il fonctionne. Mais comme on l’utilise seulement quelques minutes à la fois, sa consommation totale reste relativement faible."
},
{
  "question": {
    "questionText": "Combien consomme environ une télévision LED moderne pendant une heure ?",
    "options": ["0,05 à 0,15 kWh", "1 kWh", "3 kWh", "10 kWh"]
  },
  "answer": 0,
  "message": "Une télévision moderne consomme assez peu d’électricité. En une heure, elle utilise environ 0,05 à 0,15 kWh, soit beaucoup moins qu’un appareil de chauffage."
},
{
  "question": {
    "questionText": "Quelle est la puissance approximative d’une cuisinière électrique lorsqu’elle fonctionne à pleine puissance ?",
    "options": ["500 W", "1500 W", "6000 W", "15000 W"]
  },
  "answer": 2,
  "message": "Une cuisinière électrique peut utiliser environ 6000 watts lorsqu’elle fonctionne à pleine puissance, car elle doit produire beaucoup de chaleur pour cuire les aliments."
},
{
  "question": {
    "questionText": "Combien consomme environ un ordinateur portable pendant une heure d’utilisation ?",
    "options": ["0,02 à 0,06 kWh", "0,5 kWh", "2 kWh", "10 kWh"]
  },
  "answer": 0,
  "message": "Un ordinateur portable consomme relativement peu d’électricité, souvent entre 20 et 60 watts. Sur une heure, cela représente environ 0,02 à 0,06 kWh."
},
{
  "question": {
    "questionText": "Quel appareil consomme le plus d’électricité en été dans une maison ?",
    "options": ["Le climatiseur", "La télévision", "Le grille-pain", "Le routeur internet"]
  },
  "answer": 0,
  "message": "En été, le climatiseur est souvent l’appareil qui consomme le plus d’électricité, car il doit refroidir toute la maison pendant plusieurs heures."
},
{
  "question": {
    "questionText": "Combien de watts consomme environ une ampoule LED standard utilisée dans une maison ?",
    "options": ["5 à 12 W", "50 W", "200 W", "1000 W"]
  },
  "answer": 0,
  "message": "Les ampoules LED sont très efficaces. Elles utilisent généralement entre 5 et 12 watts tout en produisant autant de lumière qu’une ancienne ampoule de 60 watts."
},
{
  "question": {
    "questionText": "Que signifie l’abréviation kWh ?",
    "options": ["Kilowatt par heure", "Kilowattheure", "Kilowatt haute tension", "Kilowatt thermique"]
  },
  "answer": 1,
  "message": "kWh signifie kilowattheure. C’est l’unité utilisée pour mesurer l’énergie consommée, par exemple lorsqu’un appareil de 1000 watts fonctionne pendant une heure."
},
{
  "question": {
    "questionText": "Combien consomme environ un lave-vaisselle par cycle ?",
    "options": ["0,1 kWh", "1 à 1,5 kWh", "8 kWh", "20 kWh"]
  },
  "answer": 1,
  "message": "Un lave-vaisselle moderne consomme environ 1 à 1,5 kWh par cycle. La plus grande partie de cette énergie sert à chauffer l’eau."
},
{
  "question": {
    "questionText": "Pourquoi l’électricité est-elle relativement peu chère au Québec ?",
    "options": ["Parce qu’elle est produite au charbon", "Parce que la majorité vient de l’hydroélectricité", "Parce qu’il y a peu d’habitants", "Parce que les appareils consomment moins"]
  },
  "answer": 1,
  "message": "Au Québec, la majorité de l’électricité est produite par des barrages hydroélectriques. Cette production est stable et peu coûteuse, ce qui réduit le prix de l’électricité."
},
{
  "question": {
    "questionText": "Quel appareil chauffe généralement l’eau pour la douche dans une maison ?",
    "options": ["Le climatiseur", "Le chauffe-eau", "Le four", "Le micro-ondes"]
  },
  "answer": 1,
  "message": "Le chauffe-eau est l’appareil qui chauffe et stocke l’eau chaude utilisée pour les douches, la vaisselle et la lessive."
},
{
  "question": {
    "questionText": "Quelle habitude permet de réduire la consommation d’électricité à la maison ?",
    "options": ["Laisser les lumières allumées", "Améliorer l’isolation de la maison", "Ouvrir les fenêtres en hiver", "Utiliser plus d’appareils électriques"]
  },
  "answer": 1,
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