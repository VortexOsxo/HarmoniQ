import { Component } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { GameArea } from '../game/game-area/game-area';
import { Router, RouterModule } from '@angular/router';
import { TutorialService } from '../../services/tutorial-service';
import { CommonModule } from '@angular/common';
import { TopBarLogo } from "../top-bar-logo/top-bar-logo";

@Component({
  selector: 'app-navigation-bar',
  imports: [RouterModule, CommonModule, TopBarLogo],
  templateUrl: './navigation-bar.html',
  styleUrl: './navigation-bar.css',
  standalone: true,
})
export class NavigationBar {
  constructor(public tutorialService: TutorialService, public router: Router
    , private bootstrap: NgbModal
  ) { }

  openQuiz(){
      this.bootstrap.open(GameArea, {
      centered: true,
      windowClass: 'game-modal'
    });
      }
  isCollapsed = true;

  toggleNavbar() {
    this.isCollapsed = !this.isCollapsed;
  }

  collapseNavbar() {
    this.isCollapsed = true;
  }

  startHelp() {
    this.tutorialService.resetTutorial();
  }
}
