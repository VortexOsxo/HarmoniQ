import { Component } from '@angular/core';
import { graphServiceConfig } from '@app/services/graph-service';
import { SimulationCo2GraphService } from '@app/services/graph-services/simulation-co2-graph-service';

@Component({
  selector: 'app-scenario-co2-simulation',
  imports: [],
  templateUrl: './scenario-co2-simulation.html',
})
export class ScenarioCo2Simulation {
  config = graphServiceConfig;

  constructor(public simulationCo2GraphService: SimulationCo2GraphService) {}
}
