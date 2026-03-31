import { Component } from '@angular/core';
import { DemandeTemporalGraphService } from '@app/services/graph-services/demande-temporal-graph-service';
import { SimulationStepService } from '@app/services/simulation-step-service';

@Component({
  selector: 'app-scenario-temporal-demand-graph',
  imports: [],
  templateUrl: './scenario-temporal-demand-graph.html',
})
export class ScenarioTemporalDemandGraph {
  constructor(
    private graphService: DemandeTemporalGraphService,
    private stepService: SimulationStepService
  ) { }

  get hasData() {
    const steps = this.stepService.steps();
    const myStep = steps.find(s => s.name === this.graphService.getStepName());
    return myStep?.status === 'completed';
  }
}
