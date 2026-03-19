import { AfterViewInit, Component } from '@angular/core';
import { SimulationTopBar } from '@app/components/simulation/simulation-top-bar/simulation-top-bar';
import { CommonModule } from '@angular/common';
import { ScenarioTemporalDemandGraph } from "@app/components/scenario/scenario-temporal-demand-graph/scenario-temporal-demand-graph";
import { ScenarioDemandProdSankey } from "@app/components/scenario/scenario-demand-prod-sankey/scenario-demand-prod-sankey";
import { ScenarioTemporalSimulation } from "@app/components/scenario/scenario-temporal-simulation/scenario-temporal-simulation";
import { SimulationService } from '@app/services/simulation-service';

@Component({
  selector: 'app-simulation-page',
  standalone: true,
  imports: [SimulationTopBar, CommonModule, ScenarioTemporalDemandGraph, ScenarioDemandProdSankey, ScenarioTemporalSimulation],
  templateUrl: './simulation-page.html',
  styleUrl: './simulation-page.css',
})
export class SimulationPage implements AfterViewInit {
  constructor(private simulationService: SimulationService) { }

  ngAfterViewInit(): void {
    this.simulationService.launchSimulation();
  }
}
