import { Component } from '@angular/core';
import { SankeyDiagramComponent } from './sankey-diagram/sankey-diagram';
import { Co2DetailsPanelComponent } from './co2-details-panel/co2-details-panel';
import { Co2DetailsData, SankeyData } from './sankey-data.types';
import { buildCo2Details, PLACEHOLDER_SANKEY_DATA } from './sankey-placeholder.data';
import { DemandeSankeyGraphService } from '@app/services/graph-services/demande-sankey-graph-service';
import { ScenariosService } from '@app/services/scenarios-service';

@Component({
  selector: 'app-scenario-demand-prod-sankey',
  standalone: true,
  imports: [SankeyDiagramComponent, Co2DetailsPanelComponent],
  templateUrl: './scenario-demand-prod-sankey.html',
  styleUrl: './scenario-demand-prod-sankey.css',
})
export class ScenarioDemandProdSankey {
  // ── Placeholder Data ────────────────────────────────────────────────────────────────
  sankeyData: SankeyData = PLACEHOLDER_SANKEY_DATA;
  co2Data: Co2DetailsData = buildCo2Details(PLACEHOLDER_SANKEY_DATA);

  get shouldShow() {
    return this.graphService.tempShouldShowSignal();
  }

  get selectedScenario() {
    return this.scenariosService.selectedScenario;
  }

  constructor(
    private graphService: DemandeSankeyGraphService,
    private scenariosService: ScenariosService,
  ) { }
}
