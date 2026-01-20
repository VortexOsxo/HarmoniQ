import { Component, AfterViewInit } from '@angular/core';
import { ScenarioDemandProdSankey } from '@app/components/scenario/scenario-demand-prod-sankey/scenario-demand-prod-sankey';
import { NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import * as L from 'leaflet';
import { ScenarioTemporalDemandGraph } from '@app/components/scenario/scenario-temporal-demand-graph/scenario-temporal-demand-graph';

@Component({
  selector: 'app-simulation-results',
  imports: [NgbNavModule, ScenarioDemandProdSankey, ScenarioTemporalDemandGraph],
  templateUrl: './simulation-results.html',
  styleUrl: './simulation-results.css',
})
export class SimulationResults implements AfterViewInit {
  activeTab = 'map';

  ngAfterViewInit(): void {
    // TODO: Initialize map
  }
}
