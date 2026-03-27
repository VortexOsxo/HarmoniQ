import { Component, Output, EventEmitter } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameService } from '@app/services/game-service';

@Component({
  selector: 'app-result-area',
  imports: [CommonModule],
  templateUrl: './result-area.html',
  styleUrl: './result-area.css',
})
export class ResultArea {
  @Output() restartQuiz = new EventEmitter<void>();
  @Output() closeModal = new EventEmitter<void>();

  environmentGrade: number = 0;
  environmentMax: number = 0;
  energyGrade: number = 0;
  energyMax: number = 0;
  economyGrade: number = 0;
  economyMax: number = 0;

  goodGradeImage: boolean = false; //used to display the image at the end of the quiz
  grade: number = 0;
  questionsLeftAvailable: boolean = false;

  sortType: string = "";

  constructor(private cdr: ChangeDetectorRef,
    private gameService: GameService) {
  }

  onRestartQuiz() {
    this.restartQuiz.emit();
  }

  onCloseModal() {
    this.closeModal.emit();
  }

  ngOnInit() {
    this.grade = parseFloat(this.gameService.getGoodAnswerNumber().toFixed(2));
    this.goodGradeImage = this.grade > 7;
    this.questionsLeftAvailable = this.gameService.restartAvailable();
    this.showfinalGrade();
    this.showFinalResults();
  }

  showfinalGrade() {
    this.environmentMax = 0; this.energyMax = 0; this.economyMax = 0; //resetting the numbers
    this.economyGrade = parseFloat(this.gameService.getEconomyNumber().toFixed(2));
    this.environmentGrade = parseFloat(this.gameService.getEnvironmentNumber().toFixed(2));
    this.energyGrade = parseFloat(this.gameService.getEnergyNumber().toFixed(2));
    const questionAspect: string[] = this.gameService.getQuestionAspect();
    questionAspect.forEach((question: string) => {
      if (question == 'economy') {
        this.economyMax += 1;
      }
      if (question == 'energy') {
        this.energyMax += 1;
      }
      if (question == 'environment') {
        this.environmentMax += 1;
      }
    })
  }

  showFinalResults(sorter: string = "") {

    const questionPlaceHolder = document.getElementById("answerReviewBox");
    const questionData = this.gameService.getAnsweredQuestions();
    const questionAspect = this.gameService.getQuestionAspect();

    if (questionPlaceHolder) {
      questionPlaceHolder.innerHTML = '';

      for (let i = 0; i < questionData.questions.length; i++) {
        const questionText = questionData.questions[i];
        const userAnswerText = questionData.answers[i];
        const correctAnswerText = questionData.correctAnswers[i];
        const isCorrect = userAnswerText === correctAnswerText;

        if (sorter == questionAspect[i] || sorter == "") {

          const reviewItem = document.createElement('div');
          reviewItem.className = 'reviewItem';

          const reviewContent = document.createElement('div');
          reviewContent.className = 'reviewContent';

          const qText = document.createElement('p');
          qText.className = 'reviewQuestion';
          qText.textContent = `Q${i + 1}: ${questionText}`;

          const uAnswer = document.createElement('p');
          uAnswer.className = `reviewUserAnswer ${isCorrect ? 'green' : 'red'}`;
          uAnswer.textContent = `Votre réponse: ${userAnswerText}`;

          reviewContent.appendChild(qText);
          reviewContent.appendChild(uAnswer);

          //if its not correct, we add the answer below
          if (!(userAnswerText === correctAnswerText)) {
            const cAnswer = document.createElement('p');
            cAnswer.className = 'reviewCorrectAnswer';
            cAnswer.textContent = `Réponse correcte: ${correctAnswerText}`;
            reviewContent.appendChild(cAnswer);
          }

          reviewItem.appendChild(reviewContent);
          questionPlaceHolder.appendChild(reviewItem);
        }
      }
    }

    this.cdr.detectChanges();
  }

  sortFinalResults(sorter: string): void {
    if (sorter == this.sortType) {
      this.sortType = "";
      this.showFinalResults("");
    }
    else if (sorter == "economy") {
      this.sortType = sorter;
      this.showFinalResults(sorter)
    } else if (sorter == "energy") {
      this.sortType = sorter;
      this.showFinalResults(sorter);
    } else if (sorter == "environment") {
      this.sortType = sorter;
      this.showFinalResults(sorter);
    }
  }

  get totalQuestions(): number {
    return this.gameService.totalQuestions;
  }
}
