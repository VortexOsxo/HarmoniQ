import { Component } from '@angular/core';
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
  environmentGrade: number = 0;
  environmentMax: number = 0;
  energyGrade: number = 0;
  energyMax: number = 0;
  economyGrade: number = 0;
  economyMax: number = 0;

  goodGradeImage: boolean = false; //used to display the image at the end of the quiz
  grade: number = 0;
  questionsLeftAvailable: boolean = false;

  constructor(private cdr: ChangeDetectorRef,
    private gameService: GameService) {
  }

  ngOnInit() {
    this.grade = this.gameService.getGoodAnswerNumber();
    this.goodGradeImage = this.grade > 7;
    this.questionsLeftAvailable = this.gameService.restartAvailable();
    this.showFinalResults();
  }

  showFinalResults() {

    const questionPlaceHolder = document.getElementById("answerReviewBox");
    const questionData = this.gameService.getAnsweredQuestions();

    if (questionPlaceHolder) {
      questionPlaceHolder.innerHTML = '';

      for (let i = 0; i < questionData.questions.length; i++) {
        const questionText = questionData.questions[i];
        const userAnswerText = questionData.answers[i];
        const correctAnswerText = questionData.correctAnswers[i];
        const questionAspect = questionData.questionAspect[i];

        const isCorrect = (userAnswerText === correctAnswerText);
        if (questionAspect == 'economy') {
          this.economyMax += 1;
          if (isCorrect) this.economyGrade += 1;
        }
        if (questionAspect == 'energy') {
          this.energyMax += 1;
          if (isCorrect) this.energyGrade += 1;
        }
        if (questionAspect == 'environment') {
          this.environmentMax += 1;
          if (isCorrect) this.environmentGrade += 1;
        }


        const reviewItem = document.createElement('div');
        reviewItem.className = 'reviewItem';

        const statusIcon = document.createElement('span');
        statusIcon.className = `statusIcon ${isCorrect ? 'correct' : 'incorrect'}`;
        statusIcon.textContent = isCorrect ? '✅' : '❌';

        const reviewContent = document.createElement('div');
        reviewContent.className = 'reviewContent';

        const qText = document.createElement('p');
        qText.className = 'reviewQuestion';
        qText.textContent = `Q${i + 1}: ${questionText}`;

        const uAnswer = document.createElement('p');
        uAnswer.className = `reviewUserAnswer ${!isCorrect ? 'incorrectText' : ''}`;
        uAnswer.textContent = `Votre réponse: ${userAnswerText}`;

        reviewContent.appendChild(qText);
        reviewContent.appendChild(uAnswer);

        //if its not correct, we add the answer below
        if (!isCorrect) {
          const cAnswer = document.createElement('p');
          cAnswer.className = 'reviewCorrectAnswer';
          cAnswer.textContent = `Réponse correcte: ${correctAnswerText}`;
          reviewContent.appendChild(cAnswer);
        }

        reviewItem.appendChild(statusIcon);
        reviewItem.appendChild(reviewContent);
        questionPlaceHolder.appendChild(reviewItem);
      }
    }

    this.cdr.detectChanges();
  }

  get totalQuestions(): number {
    return this.gameService.totalQuestions;
  }
}
