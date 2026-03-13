import { Component, OnInit, OnDestroy } from '@angular/core';
import { ScenarioDemandProdSankey } from '@app/components/scenario/scenario-demand-prod-sankey/scenario-demand-prod-sankey';
import { NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import { ScenarioTemporalDemandGraph } from '@app/components/scenario/scenario-temporal-demand-graph/scenario-temporal-demand-graph';
import { QuebecMap } from '@app/components/quebec-map/quebec-map';
import { MapService } from '@app/services/map-service';
import { ProtectedAreasService } from '@app/services/protected-areas-service';
import { TutorialService } from '@app/services/tutorial-service';
import { InfraDetailService } from '@app/services/infra-detail-service';
import { InfraDetailModal } from '@app/components/infra-detail-modal/infra-detail-modal';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-simulation-results',
  imports: [CommonModule, NgbNavModule, ScenarioDemandProdSankey, ScenarioTemporalDemandGraph, QuebecMap, InfraDetailModal],
  templateUrl: './simulation-results.html',
  styleUrl: './simulation-results.css',
})
export class SimulationResults implements OnInit, OnDestroy {
  activeTab = 'map';
  private tutorialSub?: Subscription;

  get isDetailOpen() {
    return this.infraDetailService.isOpen();
  }

  constructor(
    public protectedAreasService: ProtectedAreasService,
    private tutorialService: TutorialService,
    private infraDetailService: InfraDetailService,
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
    this.infraDetailService.closeDetail();
  }
}
