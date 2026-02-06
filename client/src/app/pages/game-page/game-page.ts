import { Component } from '@angular/core';
import { NavigationBar } from "@app/components/navigation-bar/navigation-bar";
import { GameArea } from "@app/components/game-area/game-area";

@Component({
  selector: 'app-game-page',
  imports: [NavigationBar, GameArea],
  templateUrl: './game-page.html',
  styleUrl: './game-page.css',
})
export class GamePage {

}
