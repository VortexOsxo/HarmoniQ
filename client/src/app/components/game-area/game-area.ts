import { Component } from '@angular/core';
import { GameService, ImportedQuestion, Question } from '@app/services/game-service';
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

      const optionBox: HTMLElement | null = document.getElementById("optionBox");
      if (!optionBox) return;
      optionBox.innerHTML = '';

      const currentQuestion = this.gameService.getQuestion();
      console.log(currentQuestion.questionType);
      if(currentQuestion.questionType == "choice")
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
  
  displayOrder(optionBox: HTMLElement, currentQuestion: Question): void {
    const buttonHolder: HTMLElement | null = document.getElementById("quizButtons");
      if (!buttonHolder) return;
      const button = document.createElement('button');
      button.textContent = "Valider"
      button.classList.add('quizButton');
      button.addEventListener('click', () => {
        const answerList:number[] = [];
        const children = optionBox.querySelectorAll('.draggable');
        children.forEach((child) => {
        const element = child as HTMLElement; 
    
      if (element.dataset['index']) {
        console.log(element.dataset['index']);
        answerList.push(parseInt(element.dataset['index']));
      }
      });
      this.answerSelected(answerList);
        buttonHolder.removeChild(button);
      })
      buttonHolder.appendChild(button);
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

  displayChoice(optionBox: HTMLElement, currentQuestion: Question): void{
    currentQuestion.options.forEach((option, index) => {
        const button = document.createElement('button');
        button.textContent = option;
        button.addEventListener('click', () => this.answerSelected([index]));
        button.classList.add("optionButton");
        optionBox.appendChild(button);
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
