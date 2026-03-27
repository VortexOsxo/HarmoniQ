import { Component } from '@angular/core';
import { ScenarioDemandProdSankey } from '@app/components/scenario/scenario-demand-prod-sankey/scenario-demand-prod-sankey';
import { NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import { ScenarioTemporalDemandGraph } from '@app/components/scenario/scenario-temporal-demand-graph/scenario-temporal-demand-graph';
import { QuebecMap } from '@app/components/quebec-map/quebec-map';
import { MapService } from '@app/services/map-service';
import { ScenarioNetworkResults } from '@app/components/scenario/scenario-network-results/scenario-network-results';

@Component({
  selector: 'app-simulation-results',
  imports: [NgbNavModule, ScenarioDemandProdSankey, ScenarioTemporalDemandGraph, QuebecMap, ScenarioNetworkResults],
  templateUrl: './simulation-results.html',
  styleUrl: './simulation-results.css',
})
export class SimulationResults {
  activeTab = 'map';

  constructor(private mapService: MapService) { }

  onTabChange(event: any) {
    if (event.nextId === 'map') {
      this.mapService.onMapLoaded();
    }
  }
}
