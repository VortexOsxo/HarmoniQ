import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';

export type Question = {
  questionText: string;
  options: string[];
}

export type ImportedQuestion = {
  question: Question;
  answer: number;
  answeredQuestionList: [number];
}

@Injectable({
  providedIn: 'root',
})
export class GameService {
//private currentQuestion: ImportedQuestion | null;
  private _currentQuestion = new BehaviorSubject<ImportedQuestion>({
  question: {
    questionText: "",
    options: []
  },
  answer: 0,
  answeredQuestionList: [-1]
});
  public currentQuestion$ = this._currentQuestion.asObservable();

  constructor(private http: HttpClient) {>
    this.getQuestion();
  }

  getQuestion(): any /*Question*/ {
    console.log("ffff")
    console.log(this.currentQuestionValue.answeredQuestionList);
    if(this.currentQuestionValue.answeredQuestionList[0] != -2)
    this.http.get<ImportedQuestion>(`${environment.apiUrl}/jeux-informatifs/question`, {
      params: { answeredQuestionList: this.currentQuestionValue.answeredQuestionList }}).subscribe((question) => {
        this._currentQuestion.next(question); console.log(this.currentQuestionValue)});

    else{
      const quizEnded: ImportedQuestion = {
      question: {
      questionText: "Vous avez répondu à toutes les questions disponibles. Bravo à vous!!",
      options: []
      },
      answer: -1,
      answeredQuestionList: this.currentQuestionValue.answeredQuestionList
    }

    this._currentQuestion.next(quizEnded);
    }

  }

  checkAnswer(selectedOption: number /* if we want to send info about the answers for statistics */): number {
      return this.currentQuestionValue.answer;
  }

  get currentQuestionValue(): ImportedQuestion {
    return this._currentQuestion.value;
  }

  get currentQuestionInfo(): Question {
    return this._currentQuestion.value.question;
  }
}


