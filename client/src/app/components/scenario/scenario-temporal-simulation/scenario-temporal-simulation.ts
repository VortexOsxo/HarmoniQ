import { Component, effect } from '@angular/core';
import { graphServiceConfig } from '@app/services/graph-service';
import { SimulationTemporalGraphService } from '@app/services/graph-services/simulation-temporal-graph-service';
import { SimulationStepService } from '@app/services/simulation-step-service';

@Component({
  selector: 'app-scenario-temporal-simulation',
  imports: [],
  templateUrl: './scenario-temporal-simulation.html',
})
export class ScenarioTemporalSimulation {
  config = graphServiceConfig;
  selectedGranularity = 'daily';

  constructor(
    private graphService: SimulationTemporalGraphService,
    private stepService: SimulationStepService,
  ) {
    effect(() => {
      const steps = this.stepService.steps();
      const demandeResult = this.graphService.cachedDemandeResult();
      const simStep = steps.find(s => s.name === this.graphService.getStepName());

      if (simStep?.status === 'completed' && this.graphService.cachedSimulationResult && demandeResult) {
        this.graphService.handleData(this.graphService.cachedSimulationResult, demandeResult, this.selectedGranularity);
      } else if (demandeResult && !this.graphService.cachedSimulationResult) {
        this.graphService.renderDemandPreview(demandeResult, this.selectedGranularity);
      }
    });
  }

  onGranularityChange(granularity: string) {
    this.selectedGranularity = granularity;
    const demandeResult = this.graphService.cachedDemandeResult();
    if (this.graphService.cachedSimulationResult && demandeResult) {
      this.graphService.handleData(this.graphService.cachedSimulationResult, demandeResult, granularity);
    } else if (demandeResult) {
      this.graphService.renderDemandPreview(demandeResult, granularity);
    }
  }

  get hasDemandData() {
    return !!this.graphService.cachedDemandeResult();
  }
}
