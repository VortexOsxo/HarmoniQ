import { Component, OnDestroy, AfterViewInit } from '@angular/core';
import { NavigationBar } from '@app/components/navigation-bar/navigation-bar';
import { SimulationLauncher } from '@app/components/simulation/simulation-launcher/simulation-launcher';
import { SimulationPanelLaunchButton } from '@app/components/simulation/simulation-panel-launch-button/simulation-panel-launch-button';
import { ScenarioSelector } from '@app/components/scenario/scenario-selector/scenario-selector';
import { InfrastructureSelector } from '@app/components/infrastructure/infrastructure-selector/infrastructure-selector';
import { SimulationResults } from '@app/components/simulation/simulation-results/simulation-results';
import { TutorialOverlay } from '@app/components/tutorial-overlay/tutorial-overlay';
import { CommonModule } from '@angular/common';
import { TutorialService } from '@app/services/tutorial-service';
import { InfraDetailService } from '@app/services/infra-detail-service';
import { InfrastruturesService } from '@app/services/infrastrutures-service';
import { DEFAULT_INFRA_GROUP_ID } from '@app/models/infrastructure-group';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-map-page',
  imports: [
    CommonModule,
    NavigationBar,
    SimulationLauncher,
    SimulationPanelLaunchButton,
    ScenarioSelector,
    InfrastructureSelector,
    SimulationResults,
    TutorialOverlay,
  ],
  templateUrl: './map-page.html',
  styleUrl: './map-page.css',
})
export class MapPage implements OnDestroy, AfterViewInit {
  readonly defaultInfraGroupId = DEFAULT_INFRA_GROUP_ID;
  showSourcesPanel = false;
  private tutorialSub: Subscription;

  constructor(
    public tutorialService: TutorialService,
    public infrasService: InfrastruturesService,
    private infraDetailService: InfraDetailService,
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
    this.infraDetailService.closeDetail();
  }

  toggleSourcesPanel() {
    this.showSourcesPanel = !this.showSourcesPanel;
  }

  closeSourcesPanel() {
    this.showSourcesPanel = false;
  }
}


