import { AfterViewInit, Component, inject } from '@angular/core';
import { SimulationTopBar } from '@app/components/simulation/simulation-top-bar/simulation-top-bar';
import { CommonModule } from '@angular/common';
import { ScenarioTemporalDemandGraph } from "@app/components/scenario/scenario-temporal-demand-graph/scenario-temporal-demand-graph";
import { ScenarioDemandProdSankey } from "@app/components/scenario/scenario-demand-prod-sankey/scenario-demand-prod-sankey";
import { ScenarioTemporalSimulation } from "@app/components/scenario/scenario-temporal-simulation/scenario-temporal-simulation";
import { ScenarioNetworkResults } from "@app/components/scenario/scenario-network-results/scenario-network-results";
import { SimulationService } from '@app/services/simulation-service';
import { SimulationStepService } from '@app/services/simulation-step-service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { GameArea } from '@app/components/game/game-area/game-area';

@Component({
  selector: 'app-simulation-page',
  standalone: true,
  imports: [SimulationTopBar, CommonModule, ScenarioTemporalDemandGraph, ScenarioDemandProdSankey, ScenarioTemporalSimulation, ScenarioNetworkResults],
  templateUrl: './simulation-page.html',
  styleUrl: './simulation-page.css',
})
export class SimulationPage implements AfterViewInit {

  constructor(private bootstrap: NgbModal) { }

  simulationService = inject(SimulationService);
  stepService = inject(SimulationStepService);

  ngAfterViewInit(): void {
    this.simulationService.launchSimulation();
  }

  scrollToGraph(index: number) {
    const element = document.getElementById(`step-${index}`);
    if (element)
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  openQuiz() {
    this.bootstrap.open(GameArea, {
      centered: true,
      windowClass: 'game-modal'
    });
  }
}
