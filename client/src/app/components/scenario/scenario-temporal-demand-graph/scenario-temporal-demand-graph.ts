import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SimulationService } from '@app/services/simulation-service';

@Component({
  selector: 'app-scenario-temporal-demand-graph',
  imports: [CommonModule],
  templateUrl: './scenario-temporal-demand-graph.html',
})
export class ScenarioTemporalDemandGraph {
  isGraphGenerated = false;

  constructor(
    private simulationService: SimulationService,
    private cdr: ChangeDetectorRef
  ) { }

  ngAfterViewInit(): void {
    this.isGraphGenerated =
      this.simulationService.generateSimulationDemandeGraph() ||
      this.simulationService.generateTemporalPlot();

    this.cdr.markForCheck(); // TODO: make it work :(
  }
}
