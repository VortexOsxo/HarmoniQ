import { Component, OnDestroy, AfterViewInit } from '@angular/core';
import { NavigationBar } from '@app/components/navigation-bar/navigation-bar';
import { SimulationLauncher } from '@app/components/simulation/simulation-launcher/simulation-launcher';
import { ScenarioSelector } from '@app/components/scenario/scenario-selector/scenario-selector';
import { InfrastructureSelector } from '@app/components/infrastructure/infrastructure-selector/infrastructure-selector';
import { SimulationResults } from '@app/components/simulation/simulation-results/simulation-results';
import { TutorialOverlay } from '@app/components/tutorial-overlay/tutorial-overlay';
import { CommonModule } from '@angular/common';
import { TutorialService } from '@app/services/tutorial-service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-simulation-page',
  imports: [CommonModule, NavigationBar, SimulationLauncher, ScenarioSelector, InfrastructureSelector, SimulationResults, TutorialOverlay],
  templateUrl: './simulation-page.html',
  styleUrl: './simulation-page.css',
})
export class SimulationPage implements OnDestroy, AfterViewInit {
  showSourcesPanel = false;
  private tutorialSub: Subscription;

  constructor(
    public tutorialService: TutorialService,
  ) {
    this.tutorialSub = this.tutorialService.tutorialState$.subscribe((s) => {
      if (s.active && s.showWelcome) {
        this.closeSourcesPanel();
      }
    });
  }

  ngAfterViewInit() {
    // Slight delay to let the map and UI elements fully render
    setTimeout(() => this.tutorialService.autoStart(), 500);
  }

  ngOnDestroy() {
    this.tutorialSub.unsubscribe();
  }

  toggleSourcesPanel() {
    this.showSourcesPanel = !this.showSourcesPanel;
  }

  closeSourcesPanel() {
    this.showSourcesPanel = false;
  }
}

