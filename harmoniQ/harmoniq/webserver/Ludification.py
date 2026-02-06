import random
from typing import List


questionList = [
        {"question": {
            "question": "Quelle est la consommation en électricité d'une ampoule",
            "options": ["2mW", "4mW", "14mW", "56mW"]
        },
        "answer": 3}, 
        {"question": {
    "question": "Quelle est la consommation électrique moyenne d'une machine à laver standard au Québec par cycle de lavage ?",
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
    "question": "Quelle est la consommation électrique moyenne annuelle d'une maison unifamiliale au Québec ?",
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
    "question": "Quelle est la consommation électrique approximative d'une ampoule LED standard (10 W) laissée allumée 24h par jour pendant un mois entier ?",
    "options": [
      "0,7 kWh",
      "7,2 kWh",
      "72 kWh",
      "720 kWh"
    ]
  },
  "answer": 1
}
    ]


def selectQuestion(answeredQuestionList: List[int]):
    found = False
    while not found:
        candidateQuestion = random.randint(0, len(questionList)-1)
        if candidateQuestion not in answeredQuestionList:
            if len(answeredQuestionList) == len(questionList):
                print("end")
                answeredQuestionList = [-2]
            else:
                answeredQuestionList.append(candidateQuestion)
            return questionList[candidateQuestion], answeredQuestionList