import { Component, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SimulationService } from '@app/services/simulation-service';

@Component({
  selector: 'app-scenario-demand-prod-sankey',
  imports: [CommonModule],
  templateUrl: './scenario-demand-prod-sankey.html',
})
export class ScenarioDemandProdSankey implements AfterViewInit {
  isGraphGenerated = false;

  constructor(
    private simulationService: SimulationService,
    private cdr: ChangeDetectorRef
  ) { }

  ngAfterViewInit(): void {
    this.isGraphGenerated = this.simulationService.generateDemandeSankey();
    this.cdr.markForCheck(); // TODO: make it work :(
  }
}
