import { Component, effect } from '@angular/core';
import { graphServiceConfig } from '@app/services/graph-service';
import { SimulationTemporalGraphService } from '@app/services/graph-services/simulation-temporal-graph-service';
import { DemandeTemporalGraphService } from '@app/services/graph-services/demande-temporal-graph-service';
import { SimulationStepService } from '@app/services/simulation-step-service';

@Component({
  selector: 'app-scenario-temporal-simulation',
  imports: [],
  templateUrl: './scenario-temporal-simulation.html',
})
export class ScenarioTemporalSimulation {
  config = graphServiceConfig;
  selectedGranularity = 'original';

  constructor(
    private graphService: SimulationTemporalGraphService,
    private demandeGraphService: DemandeTemporalGraphService,
    private stepService: SimulationStepService
  ) {
    effect(() => {
      const steps = this.stepService.steps();
      const demandStep = steps.find(s => s.name === this.demandeGraphService.getStepName());
      const simStep = steps.find(s => s.name === this.graphService.getStepName());

      if (simStep?.status === 'completed' && this.graphService.cachedSimulationResult && this.graphService.cachedDemandeResult) {
        this.graphService.handleData(this.graphService.cachedSimulationResult, this.graphService.cachedDemandeResult, this.selectedGranularity);
      } else if (demandStep?.status === 'completed' && this.demandeGraphService.cachedData) {
        this.graphService.renderDemandPreview(this.demandeGraphService.cachedData, this.selectedGranularity);
      }
    });
  }

  onGranularityChange(granularity: string) {
    this.selectedGranularity = granularity;
    if (this.graphService.cachedSimulationResult && this.graphService.cachedDemandeResult) {
      this.graphService.handleData(this.graphService.cachedSimulationResult, this.graphService.cachedDemandeResult, granularity);
    } else if (this.demandeGraphService.cachedData) {
      this.graphService.renderDemandPreview(this.demandeGraphService.cachedData, granularity);
    }
  }

  get hasDemandData() {
    const steps = this.stepService.steps();
    const demandStep = steps.find(s => s.name === this.demandeGraphService.getStepName());
    return demandStep?.status === 'completed';
  }
}
