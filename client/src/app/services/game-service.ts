import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'environments/environment';
import { BehaviorSubject } from 'rxjs';

export type Question = {
  questionText: string;
  options: string[];
}

export type ImportedQuestion = {
  question: Question;
  answer: number;
}

export type Quiz = {
  answeredQuestionList: [number];
  questions: [ImportedQuestion];
}

@Injectable({
  providedIn: 'root',
})
export class GameService {
  private _currentQuestion = new BehaviorSubject<number>(-1);
  public currentQuestion$ = this._currentQuestion.asObservable();
  private answeredQuestions: [number] = [-1];
  private goodAnswers: number = 0;
  private quiz: Quiz = 
    {
      questions:[{
        question: {
          questionText: "",
          options: [""]
        },
        answer: 0
      }],
      answeredQuestionList: [-1]
    };

  constructor(private http: HttpClient) {
    this.getQuiz();
  }

  getQuiz(): void {
    this.http.get<Quiz>(`${environment.apiUrl}/jeux-informatifs/quiz`, {
      params: { answeredQuestionList: this.answeredQuestions }}).subscribe((quiz) => {
        this.quiz.questions = quiz.questions;
        this.answeredQuestions = quiz.answeredQuestionList;
        this._currentQuestion.next(0);
        this.goodAnswers = 0;
      })
  }

  getQuestion(): Question {
    return this.quiz.questions[this._currentQuestion.value].question;
  }

  nextQuestion(): void{
    this._currentQuestion.value < this.quiz.questions.length-1 ? 
      this._currentQuestion.next(this.questionIndex + 1) : this._currentQuestion.next(-2)
  }

  restartAvailable():boolean {
    if (this.answeredQuestions[0] == -2) return false;
    return true;
  }

  checkAnswer(selectedOption: number /* if we want to send info about the answers for statistics */): number {
    if (selectedOption == this.quiz.questions[this._currentQuestion.value].answer)
      this.goodAnswers ++;
    return this.quiz.questions[this._currentQuestion.value].answer;
  }

  getGoodAnswerNumber(): number {
    return this.goodAnswers;
  }

  get questionIndex(): number {
    return this._currentQuestion.value;
  }
}


