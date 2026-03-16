import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'environments/environment';
import { BehaviorSubject } from 'rxjs';

const EMPTY: number = -1;
const NO_MORE_QUESTIONS_FLAG: number = -2;

export type Question = {
  questionText: string;
  options: string[];
  questionType: string;
}

export type ImportedQuestion = {
  question: Question;
  answer: number | number[];
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
          options: [""],
          questionType:""
        },
        answer: 0,
        message: ""
      }],
      answeredQuestionList: [EMPTY]
    };
  public isCurrentAnswered: boolean = false;
  public userSelection: number[] = [EMPTY];
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
      this.userSelection = [-1];
    });
  }

  getQuestion(): Question {
    return this.quiz.questions[this._currentQuestion.value].question;
  }

  nextQuestion(): void {
    this.isCurrentAnswered = false;
    this.userSelection = [-1];
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

checkAnswer(selectedOption: number[]): number[] {
    const isFirstTime = !this.isCurrentAnswered;
    const currentQ = this.quiz.questions[this._currentQuestion.value];
    const correctAnswer = currentQ.answer;
    
    this.isCurrentAnswered = true;
    this.userSelection = selectedOption;

    if (typeof correctAnswer === 'number') {
        if (isFirstTime && selectedOption[0] === correctAnswer) {
            this.goodAnswers++;
        }
        return [correctAnswer];
    }

    if (Array.isArray(correctAnswer)) {
        let isCorrect = true;
        if (selectedOption.length !== correctAnswer.length) {
            isCorrect = false;
        } else {
            for (let i = 0; i < selectedOption.length; i++) {
                if (selectedOption[i] !== correctAnswer[i]) {
                    isCorrect = false;
                    break;
                }
            }
        }

        if (isFirstTime && isCorrect) {
            this.goodAnswers++;
        }
        return correctAnswer;
    }
    return [];
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


