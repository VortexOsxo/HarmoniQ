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
  questionAspect: string;
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
  private answeredQuestions: [number] = [EMPTY]; //a list of all answered questions in previous quizzes
  private answerColorCode: string[] = []; // the number of right answer in a quiz
  private energyAnswers: number = 0;
  private environmentAnswers: number = 0;
  private economyAnswers: number = 0;
  private userAnswers: number[][] = []; // a list of all answers 
  private quiz: Quiz =
    {
      questions: [{
        question: {
          questionText: "",
          options: [""],
          questionType: "",
          questionAspect: ""
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

  //gets the quiz from the backend
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
      this.resetStats();
    });
  }

  private resetStats(): void {
    this.answerColorCode = [];
    this.userAnswers = [];
    this.isCurrentAnswered = false;
    this.userSelection = [-1];
    this.economyAnswers = 0;
    this.energyAnswers = 0;
    this.environmentAnswers = 0;
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

  // Checks if the user has answered all the questions available
  restartAvailable(): boolean {
    if (this.answeredQuestions[0] == NO_MORE_QUESTIONS_FLAG) return false;
    return true;
  }

  restartQuestions(): void {
    this.answeredQuestions = [EMPTY];
  }

  //checks the answer and attribute points, also gives partials on order type questions
  checkAnswer(selectedOption: number[]): number[] {
    const isFirstTime = !this.isCurrentAnswered;
    const currentQ = this.quiz.questions[this._currentQuestion.value];
    const correctAnswer = currentQ.answer;
    let stackedPts = 0;

    this.isCurrentAnswered = true;
    this.userSelection = selectedOption;

    if (isFirstTime) {
      this.userAnswers.push(selectedOption);
    }

    if (typeof correctAnswer === 'number') {
      if (isFirstTime) {
        if (selectedOption[0] === correctAnswer) {
          this.answerColorCode.push("green");
          if (this.quiz.questions[this.questionIndex].question.questionAspect == "economy")
            this.economyAnswers++;
          if (this.quiz.questions[this.questionIndex].question.questionAspect == "environment")
            this.environmentAnswers++;
          if (this.quiz.questions[this.questionIndex].question.questionAspect == "energy")
            this.energyAnswers++;
        } else {
          this.answerColorCode.push("red");
        }
      }
      return [correctAnswer];
    }

    if (Array.isArray(correctAnswer)) {
      let isCorrect = true;
      if (selectedOption.length !== correctAnswer.length) {
        isCorrect = false;
      } else {
        for (let i = 0; i < selectedOption.length; i++) {
          if (selectedOption[i] == correctAnswer[i]) {
            stackedPts += 1 / selectedOption.length;
          }
        }
      }

      if (isFirstTime) {
        if (isCorrect) {
          if (this.quiz.questions[this.questionIndex].question.questionAspect == "economy")
            this.economyAnswers += stackedPts;
          if (this.quiz.questions[this.questionIndex].question.questionAspect == "environment")
            this.environmentAnswers += stackedPts;
          if (this.quiz.questions[this.questionIndex].question.questionAspect == "energy")
            this.energyAnswers += stackedPts;
          if (stackedPts == 0) this.answerColorCode.push("red");
          else if (stackedPts > 0 && stackedPts < 1) this.answerColorCode.push("orange");
          else if (stackedPts == 1) this.answerColorCode.push("green");
        } else {
          this.answerColorCode.push("red");
        }
      }
      return correctAnswer;
    }
    return [];
  }

  getGoodAnswerNumber(): number {
    return this.economyAnswers + this.energyAnswers + this.environmentAnswers;
  }

  getEconomyNumber(): number { return this.economyAnswers; }

  getEnergyNumber(): number { return this.energyAnswers }

  getEnvironmentNumber(): number { return this.environmentAnswers }

  getMessage(): string {
    return this.quiz.questions[this._currentQuestion.value].message;
  }

  getQuestionAspect(): string[] {
    return this.quiz.questions.map((q) => {
      return q.question.questionAspect;
    })
  }

  isQuizStarted(): boolean {
    return this.quizStarted;
  }

  setQuizStarted(): void {
    this.quizStarted = true;
  }
  //returns every answered questions in strings
  getAnsweredQuestions() {
    const answeredCount = this.userAnswers.length;
    const questionsTexts = this.quiz.questions.slice(0, answeredCount).map(q => q.question.questionText);
    const userAnswersTexts = this.userAnswers.slice(0, answeredCount).map((answerIndices, qIndex) => {
      const options = this.quiz.questions[qIndex].question.options;

      return answerIndices
        .filter(idx => idx !== -1)
        .map(idx => options[idx])
        .join(', ');
    });

    const correctAnswersTexts = this.quiz.questions.slice(0, answeredCount).map((q) => {
      const options = q.question.options;
      const ans = q.answer;

      if (Array.isArray(ans)) {

        return ans.map(idx => options[idx]).join(', ');
      } else {
        return options[ans];
      }
    });

    return {
      questions: questionsTexts,
      answers: userAnswersTexts,
      correctAnswers: correctAnswersTexts,
      color: this.answerColorCode
    };
  }

  get questionIndex(): number {
    return this._currentQuestion.value;
  }

  get totalQuestions(): number {
    return this.quiz.questions.length;
  }
}


