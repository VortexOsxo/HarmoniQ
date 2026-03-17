import { Component } from '@angular/core';
import { GameService, ImportedQuestion, Question } from '@app/services/game-service';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ResultArea } from "../result-area/result-area";
import { StartArea } from "../start-area/start-area";

const NO_MORE_QUESTIONS_FLAG: number = -2;

@Component({
  selector: 'app-game-area',
  imports: [CommonModule, ResultArea, StartArea],
  templateUrl: './game-area.html',
  styleUrl: './game-area.css',
})
export class GameArea {
  quizStarted: boolean = false;
  questionText: string = "Le quiz est en cours de chargement";
  questionAnswered: boolean = false;
  questionInformation: string = ""; //to display information regarding the answer
  quizTerminated: boolean = false; //if quiz if finished
  questionsLeftAvailable: boolean = false; //to display the no more new question message
  goodGradeImage: boolean = false; //used to display the image at the end of the quiz
  nextQuestionButtonText: string = "Prochaine question"

  constructor(private cdr: ChangeDetectorRef,
    private gameService: GameService, private activeModal: NgbActiveModal) {
  }

  ngOnInit() {
    this.quizStarted = this.gameService.isQuizStarted();
    this.gameService.currentQuestion$.subscribe(question => {
      if (question == NO_MORE_QUESTIONS_FLAG) {
        this.showFinalResults();
        return;
      }
      if (question < 0) return;

      const optionBox: HTMLElement | null = document.getElementById("optionBox");
      if (!optionBox) return;
      optionBox.innerHTML = '';

      const currentQuestion = this.gameService.getQuestion();
      console.log(currentQuestion.questionType);
      if (currentQuestion.questionType == "choice")
        this.displayChoice(optionBox, currentQuestion);
      else
        this.displayOrder(optionBox, currentQuestion);

      this.questionText = currentQuestion.questionText;

      // Restore state answered if the question has already been answered
      if (this.gameService.isCurrentAnswered) {
        this.questionAnswered = true;
        setTimeout(() => {
          const answer = this.gameService.checkAnswer(this.gameService.userSelection);
          this.applyVisualFeedback(this.gameService.userSelection, answer);
        }, 0);
      }

      this.cdr.detectChanges();
    });
  }

  isOrderQuestion: boolean = false;

  displayOrder(optionBox: HTMLElement, currentQuestion: Question): void {
    this.isOrderQuestion = true;
    optionBox.innerHTML = '';

    currentQuestion.options.forEach((option, index) => {
      const box = document.createElement('button');
      box.disabled = true;
      box.textContent = option;
      box.classList.add("optionButton", "draggable");
      box.setAttribute('draggable', 'true');
      box.dataset['index'] = index.toString();

      box.addEventListener('dragstart', (e) => {
        box.classList.add('dragging');
      });

      box.addEventListener('dragend', () => {
        box.classList.remove('dragging');
      });

      optionBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggingElement = document.querySelector('.dragging') as HTMLElement;
        const afterElement = this.getDragAfterElement(optionBox, e.clientY);

        if (afterElement == null) {
          optionBox.appendChild(draggingElement);
        } else {
          optionBox.insertBefore(draggingElement, afterElement);
        }
      });

      optionBox.appendChild(box);
    });
  }

  validateOrder(): void {
    const optionBox: HTMLElement | null = document.getElementById("optionBox");
    if (!optionBox) return;
    
    const answerList: number[] = [];
    const children = optionBox.querySelectorAll('.draggable');
    children.forEach((child) => {
      const element = child as HTMLElement;
      if (element.dataset['index']) {
        answerList.push(parseInt(element.dataset['index']));
      }
    });
    this.answerSelected(answerList);
  }

  private getDragAfterElement(container: HTMLElement, y: number): HTMLElement | null {
    const draggableElements = [...container.querySelectorAll('.draggable:not(.dragging)')] as HTMLElement[];

    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;

      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY, element: null as HTMLElement | null }).element;
  }

  displayChoice(optionBox: HTMLElement, currentQuestion: Question): void {
    this.isOrderQuestion = false;
    currentQuestion.options.forEach((option, index) => {
      const button = document.createElement('button');
      button.textContent = option;
      button.addEventListener('click', () => this.answerSelected([index]));
      button.classList.add("optionButton");
      optionBox.appendChild(button);
    });
  }

  answerSelected(selectedAnswer: number[]) {
    let answer: number[] = this.gameService.checkAnswer(selectedAnswer);
    this.applyVisualFeedback(selectedAnswer, answer);
  }

  applyVisualFeedback(selectedAnswer: number[], correctAnswer: number[]) {
    const optionButtons = document.getElementById("optionBox")?.children;
    if (!optionButtons) return;

    selectedAnswer.forEach((answer, index) => {
      if (answer == correctAnswer[index]) {
        optionButtons[answer].classList.add("rightAnswerButtonColor");
      } else {
        optionButtons[answer].classList.add("wrongAnswerButtonColor");
        if (correctAnswer.length == 1)
          optionButtons[correctAnswer[0]].classList.add("rightAnswerButtonColor");
      }
    })


    this.questionAnswered = true;

    for (const button of optionButtons as HTMLCollectionOf<HTMLButtonElement>) {
      button.disabled = true;
      button.classList.add('answered');
    }

    this.questionInformation = this.gameService.getMessage();

    if ((this.currentQuestionIndex + 1) == this.totalQuestions)
      this.nextQuestionButtonText = "Voir les résultats"

    this.cdr.detectChanges();
  }

  changeQuestion() {
    this.gameService.nextQuestion();
    this.questionAnswered = false;
    this.questionInformation = "";

    if (this.gameService.questionIndex == NO_MORE_QUESTIONS_FLAG) {
      this.showFinalResults();
    }
  }

  showFinalResults() {
    this.quizTerminated = true;
    this.goodGradeImage = this.gameService.getGoodAnswerNumber() > 7 ? true : false;
    this.questionText = ``;
    this.questionsLeftAvailable = this.gameService.restartAvailable();
    this.cdr.detectChanges();
  }

  startNewQuiz() {
    if (!this.questionsLeftAvailable)
      this.gameService.restartQuestions();

    this.quizTerminated = false;
    this.questionsLeftAvailable = false;
    this.questionAnswered = false;
    this.nextQuestionButtonText = "Prochaine question"
    this.gameService.getQuiz();
  }

  start(): void {
    this.quizStarted = true;
    this.gameService.setQuizStarted();
  }

  close() {
    this.activeModal.close();
  }

  get currentQuestionIndex(): number {
    return this.gameService.questionIndex;
  }

  get totalQuestions(): number {
    return this.gameService.totalQuestions;
  }
}
