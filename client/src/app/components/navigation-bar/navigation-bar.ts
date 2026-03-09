import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { TutorialService } from '../../services/tutorial-service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-navigation-bar',
  imports: [RouterModule, CommonModule],
  templateUrl: './navigation-bar.html',
  styleUrl: './navigation-bar.css',
  standalone: true,
})
export class NavigationBar {
  constructor(public tutorialService: TutorialService, public router: Router) { }

  startHelp() {
    this.tutorialService.resetTutorial();
  }
}
