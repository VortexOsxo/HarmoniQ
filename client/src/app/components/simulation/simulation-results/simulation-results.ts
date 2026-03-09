import { Component, OnInit, OnDestroy } from '@angular/core';
import { ScenarioDemandProdSankey } from '@app/components/scenario/scenario-demand-prod-sankey/scenario-demand-prod-sankey';
import { NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import { ScenarioTemporalDemandGraph } from '@app/components/scenario/scenario-temporal-demand-graph/scenario-temporal-demand-graph';
import { QuebecMap } from '@app/components/quebec-map/quebec-map';
import { MapService } from '@app/services/map-service';
import { ProtectedAreasService } from '@app/services/protected-areas-service';
import { TutorialService } from '@app/services/tutorial-service';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-simulation-results',
  imports: [CommonModule, NgbNavModule, ScenarioDemandProdSankey, ScenarioTemporalDemandGraph, QuebecMap],
  templateUrl: './simulation-results.html',
  styleUrl: './simulation-results.css',
})
export class SimulationResults implements OnInit, OnDestroy {
  activeTab = 'map';
  private tutorialSub?: Subscription;

  constructor(
    public protectedAreasService: ProtectedAreasService,
    private tutorialService: TutorialService,
  ) { }

  ngOnInit(): void {
    this.tutorialSub = this.tutorialService.tutorialState$.subscribe((s) => {
      if (s.active && s.showWelcome) {
        this.activeTab = 'map';
        this.protectedAreasService.hide();
      }
    });
  }

  ngOnDestroy(): void {
    this.tutorialSub?.unsubscribe();
  }

  switchTab(tabId: string) {
    this.activeTab = tabId;
  }
}
