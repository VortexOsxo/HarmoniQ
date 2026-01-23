import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SimulationService } from '@app/services/simulation-service';
import { graphServiceConfig } from '@app/services/graph-service';

@Component({
  selector: 'app-scenario-temporal-demand-graph',
  imports: [CommonModule],
  templateUrl: './scenario-temporal-demand-graph.html',
  styleUrl: './scenario-temporal-demand-graph.css',
})
export class ScenarioTemporalDemandGraph {
  config = graphServiceConfig;
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

  hasExportableData(): boolean {
    return this.simulationService.hasExportableData();
  }

  downloadCSV(): void {
    this.simulationService.exportSimulationToCSV();
  }
}

