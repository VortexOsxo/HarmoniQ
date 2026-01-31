import { AfterViewInit, ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SimulationService } from '@app/services/simulation-service';
import { graphServiceConfig } from '@app/services/graph-service';
import { DemandeTemporalGraphService } from '@app/services/graph-services/demande-temporal-graph-service';
import { ScenariosService } from '@app/services/scenarios-service';
import { Subscription } from 'rxjs';
import { GraphState } from '@app/services/graph-services/base-graph-service';

@Component({
  selector: 'app-scenario-temporal-demand-graph',
  imports: [CommonModule],
  templateUrl: './scenario-temporal-demand-graph.html',
  styleUrl: './scenario-temporal-demand-graph.css',
})
export class ScenarioTemporalDemandGraph implements AfterViewInit, OnDestroy {
  config = graphServiceConfig;
  GraphState = GraphState;

  get graphState() {
    return this.graphService.state;
  }

  get selectedScenario() {
    return this.scenariosService.selectedScenario
  }

  private subscription?: Subscription;

  constructor(
    private simulationService: SimulationService,
    private graphService: DemandeTemporalGraphService,
    private scenariosService: ScenariosService,
  ) {
    this.subscription = this.simulationService.simulationResultsReceived.subscribe(() => {
      this.graphService.undisplay();
      this.simulationService.generateSimulationDemandeGraph();
    })
  }

  ngAfterViewInit(): void {
    if (!this.simulationService.hasSimulationResults()) {
      this.graphService.display();
    } else {
      this.simulationService.generateSimulationDemandeGraph();
    }
  }

  ngOnDestroy(): void {
    if (!this.simulationService.hasSimulationResults()) {
      this.graphService.undisplay();
    }
    this.subscription?.unsubscribe();
  }

  hasExportableData(): boolean {
    return this.simulationService.hasExportableData();
  }

  downloadCSV(): void {
    this.simulationService.exportSimulationToCSV();
  }
}

