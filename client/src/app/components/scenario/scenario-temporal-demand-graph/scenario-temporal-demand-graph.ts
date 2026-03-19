import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { graphServiceConfig } from '@app/services/graph-service';
import { DemandeTemporalGraphService } from '@app/services/graph-services/demande-temporal-graph-service';
import { GranularitySelectorComponent } from '@app/components/commons/granularity-selector/granularity-selector';
import { SimulationStepService } from '@app/services/simulation-step-service';

@Component({
  selector: 'app-scenario-temporal-demand-graph',
  imports: [CommonModule, GranularitySelectorComponent],
  templateUrl: './scenario-temporal-demand-graph.html',
})
export class ScenarioTemporalDemandGraph {
  config = graphServiceConfig;

  constructor(
    private graphService: DemandeTemporalGraphService,
    private stepService: SimulationStepService
  ) { }

  onGranularityChange(granularity: string) {
    if (this.graphService.cachedData) {
      this.graphService.handleData(this.graphService.cachedData, granularity);
    }
  }

  get hasData() {
    const steps = this.stepService.steps();
    const myStep = steps.find(s => s.name === this.graphService.getStepName());
    return myStep?.status === 'completed';
  }
}
