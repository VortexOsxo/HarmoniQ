import { Component } from '@angular/core';
import { GameService } from '@app/services/game-service';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

const NO_MORE_QUESTIONS_FLAG: number = -2;

@Component({
  selector: 'app-game-area',
  imports: [CommonModule],
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
  images: string[] = [ //for the images
    '/icons/hydraulic_barrage.jpg',
    '/icons/solar_powerPlant.jpg',
    '/icons/thermal_powerPlant.jpg',
    '/icons/windTurbine.jpg'
  ];
  currentImage: string = this.images[0];
  index = 0;
  private interval!: ReturnType<typeof setInterval>;
  fade: boolean = false;


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

      const optionBox = document.getElementById("optionBox");
      if (!optionBox) return;
      optionBox.innerHTML = '';

      const currentQuestion = this.gameService.getQuestion();
      currentQuestion.options.forEach((option, index) => {
        const button = document.createElement('button');
        button.textContent = option;
        button.addEventListener('click', () => this.answerSelected(index));
        button.classList.add("optionButton");
        optionBox.appendChild(button);
      });

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

  ngAfterViewInit() {
  this.interval = setInterval(() => {
    this.fadeOutNextImage();
  }, 5000);
}

fadeOutNextImage() {
  this.fade = true;
  this.cdr.detectChanges();

  setTimeout(() => {
    this.index = (this.index + 1) % this.images.length;
    this.currentImage = this.images[this.index];
    this.fade = false;
    this.cdr.detectChanges();
  }, 800);
}


  answerSelected(selectedAnswer: number) {
    let answer: number = this.gameService.checkAnswer(selectedAnswer);
    this.applyVisualFeedback(selectedAnswer, answer);
  }

  applyVisualFeedback(selectedAnswer: number, correctAnswer: number) {
    const optionButtons = document.getElementById("optionBox")?.children;
    if (!optionButtons) return;

    if (selectedAnswer == correctAnswer) {
      optionButtons[selectedAnswer].classList.add("rightAnswerButtonColor");
    } else {
      optionButtons[selectedAnswer].classList.add("wrongAnswerButtonColor");
      optionButtons[correctAnswer].classList.add("rightAnswerButtonColor");
    }

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
    this.questionText = `Le quiz est terminé!! \n Vous avez obtenu une note de ${this.gameService.getGoodAnswerNumber() * 10}%`;
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

  ngOnDestroy() {
  clearInterval(this.interval);
}
}
