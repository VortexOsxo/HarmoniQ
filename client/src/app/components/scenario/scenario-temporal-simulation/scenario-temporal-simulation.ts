import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { graphServiceConfig } from '@app/services/graph-service';
import { SimulationTemporalGraphService } from '@app/services/graph-services/simulation-temporal-graph-service';
import { GranularitySelectorComponent } from '@app/components/commons/granularity-selector/granularity-selector';
import { SimulationStepService } from '@app/services/simulation-step-service';

@Component({
  selector: 'app-scenario-temporal-simulation',
  imports: [CommonModule, GranularitySelectorComponent],
  templateUrl: './scenario-temporal-simulation.html',
})
export class ScenarioTemporalSimulation {
  config = graphServiceConfig;

  constructor(
    private graphService: SimulationTemporalGraphService,
    private stepService: SimulationStepService
  ) { }

  onGranularityChange(granularity: string) {
    if (this.graphService.cachedSimulationResult && this.graphService.cachedDemandeResult) {
      this.graphService.handleData(this.cachedSimulationResult, this.cachedDemandeResult, granularity);
    }
  }

  get cachedSimulationResult() {
    return this.graphService.cachedSimulationResult;
  }

  get cachedDemandeResult() {
    return this.graphService.cachedDemandeResult;
  }

  get hasData() {
    const steps = this.stepService.steps();
    const myStep = steps.find(s => s.name === this.graphService.getStepName());
    return myStep?.status === 'completed';
  }
}
