import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'environments/environment';
import { BehaviorSubject } from 'rxjs';

const EMPTY: number = -1;
const NO_MORE_QUESTIONS_FLAG: number = -2;

export type Question = {
  questionText: string;
  options: string[];
}

export type ImportedQuestion = {
  question: Question;
  answer: number;
  message: string;
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
  private answeredQuestions: [number] = [EMPTY];
  private goodAnswers: number = 0;
  private quiz: Quiz =
    {
      questions: [{
        question: {
          questionText: "",
          options: [""]
        },
        answer: 0,
        message: ""
      }],
      answeredQuestionList: [EMPTY]
    };
  public isCurrentAnswered: boolean = false;
  public userSelection: number = EMPTY;
  private quizStarted: boolean = false;

  constructor(private http: HttpClient) {
    this.getQuiz();
  }

  getQuiz(): void {
    const listToSend = (this.answeredQuestions.length === 1 && 
      (this.answeredQuestions[0] === EMPTY || this.answeredQuestions[0] === NO_MORE_QUESTIONS_FLAG))
      ? [] : this.answeredQuestions;

    this.http.get<Quiz>(`${environment.apiUrl}/jeux-informatifs/quiz`, {
      params: { answeredQuestionList: listToSend }
    }).subscribe((quiz) => {
      this.quiz.questions = quiz.questions;
      this.answeredQuestions = quiz.answeredQuestionList;
      this._currentQuestion.next(0);
      this.goodAnswers = 0;
      this.isCurrentAnswered = false;
      this.userSelection = -1;
    });
  }

  getQuestion(): Question {
    return this.quiz.questions[this._currentQuestion.value].question;
  }

  nextQuestion(): void {
    this.isCurrentAnswered = false;
    this.userSelection = -1;
    this._currentQuestion.value < this.quiz.questions.length - 1 ?
      this._currentQuestion.next(this.questionIndex + 1) : this._currentQuestion.next(NO_MORE_QUESTIONS_FLAG)
  }

  restartAvailable(): boolean {
    if (this.answeredQuestions[0] == NO_MORE_QUESTIONS_FLAG) return false;
    return true;
  }

  restartQuestions(): void {
    this.answeredQuestions = [EMPTY];
  }

  checkAnswer(selectedOption: number): number {
    const isFirstTime = !this.isCurrentAnswered;
    this.isCurrentAnswered = true;
    this.userSelection = selectedOption;
    if (isFirstTime && selectedOption == this.quiz.questions[this._currentQuestion.value].answer)
      this.goodAnswers++;
    return this.quiz.questions[this._currentQuestion.value].answer;
  }

  getGoodAnswerNumber(): number {
    return this.goodAnswers;
  }

  getMessage(): string {
    return this.quiz.questions[this._currentQuestion.value].message;
  }

  isQuizStarted(): boolean {
    return this.quizStarted;
  }

  setQuizStarted(): void {
    this.quizStarted = true;
  }

  get questionIndex(): number {
    return this._currentQuestion.value;
  }

  get totalQuestions(): number {
    return this.quiz.questions.length;
  }
}


