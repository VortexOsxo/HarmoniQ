import { Component } from '@angular/core';
import { graphServiceConfig } from '@app/services/graph-service';
import { DemandeTemporalGraphService } from '@app/services/graph-services/demande-temporal-graph-service';

@Component({
  selector: 'app-scenario-temporal-simulation',
  imports: [],
  templateUrl: './scenario-temporal-simulation.html',
})
export class ScenarioTemporalSimulation {
  config = graphServiceConfig;

  constructor(private graphService: DemandeTemporalGraphService) { }

}
