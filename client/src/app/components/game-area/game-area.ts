import { Component } from '@angular/core';
import { GameService } from '@app/services/game-service';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-game-area',
  imports: [CommonModule],
  templateUrl: './game-area.html',
  styleUrl: './game-area.css',
})
export class GameArea {

  questionText: string = "Le quiz est en cours de chargement";
  questionAnswered: boolean = false;
  questionInformation: string = "";
  quizTerminated: boolean = false;
  restartAvailable: boolean = false;


  constructor(private cdr: ChangeDetectorRef, private router: Router, 
    private gameService: GameService) {  
  }

  ngOnInit() {
  this.gameService.currentQuestion$.subscribe(question => {
    if (question < 0) return;

    const optionBox = document.getElementById("optionBox");
    if (!optionBox) return;
    optionBox.innerHTML = '';

    this.gameService.getQuestion().options.forEach((option, index) => {
      const button = document.createElement('button');
      button.textContent = option;
      button.addEventListener('click', () => this.answerSelected(index));
      button.classList.add("optionButton");
      optionBox.appendChild(button);
    });

    this.questionText = this.gameService.getQuestion().questionText;

    this.cdr.detectChanges();
  });
}


  answerSelected(selectedAnswer: number){
    console.log(selectedAnswer)

    let answer: number = this.gameService.checkAnswer(selectedAnswer);

    if(!answer)
      {console.error("an error has happened while fetching the correct answer.");
      return;}

    const optionButtons = document.getElementById("optionBox")?.children;
    if(!optionButtons)
      {console.error("an error has happend with the choices");
      return;
    }

    if(selectedAnswer == answer)
    {
      if(optionButtons)
        optionButtons[selectedAnswer].classList.add("rightAnswerButtonColor");
    } else {
      
      if(optionButtons)
      {
        optionButtons[selectedAnswer].classList.add("wrongAnswerButtonColor");
        optionButtons[answer].classList.add("rightAnswerButtonColor");
      }
    }

    this.questionAnswered = true;

    for (const button of optionButtons as HTMLCollectionOf<HTMLButtonElement>){
      button.disabled = true;
      button.classList.add('answered');
    }

    this.cdr.detectChanges();
  }

changeQuestion() {
  this.gameService.nextQuestion();
  this.questionAnswered = false;

  if (this.gameService.questionIndex == -2) {
    this.quizTerminated = true;
    this.questionText = `Le quiz est terminé!!\n Vous avez obtenu ${this.gameService.getGoodAnswerNumber()}
    réponses sur 10`;
    this.restartAvailable = this.gameService.restartAvailable();
  }
}

startNewQuiz() {
  this.quizTerminated = false;
  this.restartAvailable = false;
  this.questionAnswered = false;
  this.gameService.getQuiz();
}

  navigate(path: string) {
    this.router.navigate([path]);
  }
}
