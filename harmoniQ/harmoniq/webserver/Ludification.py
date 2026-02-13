import random
from typing import List


questionList = [
        {"question": {
            "questionText": "Quelle est la consommation en électricité d'une ampoule",
            "options": ["2mW", "4mW", "14mW", "56mW"]
        },
        "answer": 3}, 
        {"question": {
    "questionText": "Quelle est la consommation électrique moyenne d'une machine à laver standard au Québec par cycle de lavage ?",
    "options": [
      "0,5 kWh",
      "1,0 kWh",
      "2,0 kWh",
      "5,0 kWh"
    ]
  },
  "answer": 1},
  {
  "question": {
    "questionText": "Quelle est la consommation électrique moyenne annuelle d'une maison unifamiliale au Québec ?",
    "options": [
      "5 000 kWh",
      "10 000 kWh",
      "15 000 kWh",
      "25 000 kWh"
    ]
  },
  "answer": 2
}, {
  "question": {
    "questionText": "Quelle est la consommation électrique approximative d'une ampoule LED standard (10 W) laissée allumée 24h par jour pendant un mois entier ?",
    "options": [
      "0,7 kWh",
      "7,2 kWh",
      "72 kWh",
      "720 kWh"
    ]
  },
  "answer": 1
}, {
  "question": {
    "questionText": "Quel appareil consomme généralement le plus d'électricité dans une maison au Québec ?",
    "options": [
      "Le réfrigérateur",
      "Le chauffage électrique",
      "La télévision",
      "Le micro-ondes"
    ]
  },
  "answer": 1
},
{
  "question": {
    "questionText": "Quelle est la puissance moyenne d’un chauffe-eau électrique résidentiel ?",
    "options": [
      "500 W",
      "1 200 W",
      "3 000 W",
      "6 000 W"
    ]
  },
  "answer": 3
},
{
  "question": {
    "questionText": "Combien de kWh consomme environ un sécheuse électrique par cycle ?",
    "options": [
      "0,5 kWh",
      "2 à 3 kWh",
      "10 kWh",
      "25 kWh"
    ]
  },
  "answer": 1
},
{
  "question": {
    "questionText": "Quelle est la tension standard du réseau résidentiel au Québec ?",
    "options": [
      "110 V",
      "120/240 V",
      "230 V",
      "347 V"
    ]
  },
  "answer": 1
},
{
  "question": {
    "questionText": "Combien coûte approximativement 1 kWh d’électricité résidentielle au Québec (tarif de base) ?",
    "options": [
      "0,02 $",
      "0,07 $",
      "0,25 $",
      "1,00 $"
    ]
  },
  "answer": 1
},
{
  "question": {
    "questionText": "Quelle est la principale source de production d’électricité au Québec ?",
    "options": [
      "Nucléaire",
      "Charbon",
      "Hydroélectricité",
      "Éolien"
    ]
  },
  "answer": 2
},
{
  "question": {
    "questionText": "Combien consomme en moyenne un four électrique utilisé pendant une heure ?",
    "options": [
      "0,2 kWh",
      "1 à 2 kWh",
      "5 à 7 kWh",
      "15 kWh"
    ]
  },
  "answer": 2
},
{
  "question": {
    "questionText": "Quel est l’impact principal de l’isolation sur la consommation énergétique d’une maison ?",
    "options": [
      "Augmente la consommation",
      "Réduit les pertes de chaleur",
      "Augmente la tension électrique",
      "Réduit la puissance du compteur"
    ]
  },
  "answer": 1
},
{
  "question": {
    "questionText": "Quelle unité est utilisée pour mesurer la consommation d’électricité ?",
    "options": [
      "Volt",
      "Ampère",
      "Watt",
      "Kilowattheure (kWh)"
    ]
  },
  "answer": 3
},
{
  "question": {
    "questionText": "Combien consomme environ un climatiseur portatif en fonctionnement continu pendant une heure ?",
    "options": [
      "0,1 kWh",
      "1 à 1,5 kWh",
      "5 kWh",
      "20 kWh"
    ]
  },
  "answer": 1
}
    ]


def selectQuestion(answeredQuestionList: List[int]):
    fullQuestionList = []
    allQuestionsAnswered = False
    quizMade = len(answeredQuestionList) // 10
    while (len(fullQuestionList)-1)//10 <= quizMade*10 and not allQuestionsAnswered:
        candidateQuestion = random.randint(0, len(questionList)-1)
        if candidateQuestion not in answeredQuestionList:
            if len(answeredQuestionList)-1 >= (len(questionList) - (len(questionList) % 10)):
                print("end")
                answeredQuestionList = [-2]
                allQuestionsAnswered = True
            else:
                answeredQuestionList.append(candidateQuestion)
                fullQuestionList.append(questionList[candidateQuestion])
                print(answeredQuestionList)
    print(answeredQuestionList)
    return fullQuestionList, answeredQuestionList