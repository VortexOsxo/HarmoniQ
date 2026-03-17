import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { GameArea } from '@app/components/game/game-area/game-area';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-home-page',
  imports: [],
  templateUrl: './home-page.html',
  styleUrl: './home-page.css',
})
export class HomePage {
  constructor(private router: Router, private bootstrap: NgbModal) { }

  navigate(path: string) {
    this.router.navigate([path]);
  }

  openQuiz(){
    this.bootstrap.open(GameArea, {
    centered: true,
    windowClass: 'game-modal'
  });
    }
}
