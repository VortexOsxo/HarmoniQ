import { Component } from '@angular/core';
import { NavigationBar } from "@app/components/navigation-bar/navigation-bar";
import { GameArea } from "@app/components/game-area/game-area";
import { MatDialog } from '@angular/material/dialog'; 
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { GameService } from '@app/services/game-service';

@Component({
  selector: 'app-game-page',
  imports: [NavigationBar],
  templateUrl: './game-page.html',
  styleUrl: './game-page.css',
})
export class GamePage {
  constructor(private bootstrap: NgbModal, private gameService: GameService){
  }


  openQuiz(){
   const gameDialog = this.bootstrap.open(GameArea, {
  centered: true,
  windowClass: 'game-modal'
});
  }
  
}
