import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { GameArea } from '../game-area/game-area';

@Component({
  selector: 'app-navigation-bar',
  imports: [RouterModule],
  templateUrl: './navigation-bar.html',
  styleUrl: './navigation-bar.css',
  standalone: true,
})
export class NavigationBar {

  constructor(private bootstrap: NgbModal) { }

  openQuiz(){
      this.bootstrap.open(GameArea, {
      centered: true,
      windowClass: 'game-modal'
    });
      }
}
