import { Component } from '@angular/core';
import { graphServiceConfig } from '@app/services/graph-service';
import { SimulationCostGraphService } from '@app/services/graph-services/simulation-cost-graph-service';

@Component({
  selector: 'app-scenario-cost-simulation',
  imports: [],
  templateUrl: './scenario-cost-simulation.html',
})
export class ScenarioCostSimulation {
  config = graphServiceConfig;

  constructor(public simulationCostGraphService: SimulationCostGraphService) {}
}
