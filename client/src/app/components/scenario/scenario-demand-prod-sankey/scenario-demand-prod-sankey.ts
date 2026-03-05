import { Component } from '@angular/core';
import { SankeyDiagramComponent } from './sankey-diagram/sankey-diagram';
import { Co2DetailsPanelComponent } from './co2-details-panel/co2-details-panel';
import { Co2DetailsData, SankeyData } from './sankey-data.types';
import { buildCo2Details, PLACEHOLDER_SANKEY_DATA } from './sankey-placeholder.data';
import { DemandeSankeyGraphService } from '@app/services/graph-services/demande-sankey-graph-service';
import { ScenariosService } from '@app/services/scenarios-service';
import { GraphState } from '@app/services/graph-services/base-graph-service';

@Component({
  selector: 'app-scenario-demand-prod-sankey',
  standalone: true,
  imports: [SankeyDiagramComponent, Co2DetailsPanelComponent],
  templateUrl: './scenario-demand-prod-sankey.html',
  styleUrl: './scenario-demand-prod-sankey.css',
})
export class ScenarioDemandProdSankey {
  GraphState = GraphState;

  // ── Data ────────────────────────────────────────────────────────────────
  // Replace these with real API data when ready.
  // Both properties are derived from a single SankeyData object so that
  // swapping in a live API response only requires updating `sankeyData`.
  sankeyData: SankeyData = PLACEHOLDER_SANKEY_DATA;
  co2Data: Co2DetailsData = buildCo2Details(PLACEHOLDER_SANKEY_DATA);

  get graphState() {
    return this.graphService.state;
  }

  get selectedScenario() {
    return this.scenariosService.selectedScenario;
  }

  constructor(
    private graphService: DemandeSankeyGraphService,
    private scenariosService: ScenariosService,
  ) {}
}
