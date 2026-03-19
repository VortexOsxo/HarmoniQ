import { ChangeDetectorRef, Component, effect } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { SankeyDiagramComponent } from './sankey-diagram/sankey-diagram';
import { Co2DetailsPanelComponent } from './co2-details-panel/co2-details-panel';
import { Co2DetailsData, SankeyData } from './sankey-data.types';
import { buildCo2Details, PLACEHOLDER_SANKEY_DATA } from './sankey-placeholder.data';
import { DemandeSankeyGraphService } from '@app/services/graph-services/demande-sankey-graph-service';
import { ScenariosService } from '@app/services/scenarios-service';
import { GraphState } from '@app/services/graph-services/base-graph-service';
import { SimulationService } from '@app/services/simulation-service';

@Component({
  selector: 'app-scenario-demand-prod-sankey',
  standalone: true,
  imports: [SankeyDiagramComponent, Co2DetailsPanelComponent, DecimalPipe],
  templateUrl: './scenario-demand-prod-sankey.html',
  styleUrl: './scenario-demand-prod-sankey.css',
})
export class ScenarioDemandProdSankey {
  GraphState = GraphState;

  sankeyData: SankeyData = PLACEHOLDER_SANKEY_DATA;
  co2Data: Co2DetailsData = buildCo2Details(PLACEHOLDER_SANKEY_DATA);
  simulationRan = false;

  get graphState() {
    return this.graphService.state;
  }

  get selectedScenario() {
    return this.scenariosService.selectedScenario;
  }

  get totalDemandMW(): number {
    return this.sankeyData.demandNodes.reduce((s, n) => s + n.value, 0);
  }

  get totalProductionMW(): number {
    return this.sankeyData.productionNodes.reduce((s, n) => s + n.value, 0);
  }

  get coveragePercent(): number {
    return this.totalDemandMW > 0 ? Math.round((this.totalProductionMW / this.totalDemandMW) * 100) : 0;
  }

  get productionDeficit(): number {
    if (!this.simulationRan) return 0;
    return Math.max(0, this.totalDemandMW - this.totalProductionMW);
  }

  get productionSurplus(): number {
    if (!this.simulationRan) return 0;
    return Math.max(0, this.totalProductionMW - this.totalDemandMW);
  }

  constructor(
    private graphService: DemandeSankeyGraphService,
    private scenariosService: ScenariosService,
    private simulationService: SimulationService,
    private cdr: ChangeDetectorRef,
  ) {
    effect(() => {
      const nodes = this.graphService.demandNodes();
      if (nodes) {
        this.sankeyData = { ...this.sankeyData, demandNodes: nodes };
        this.cdr.markForCheck();
      }
    });

    effect(() => {
      const nodes = this.simulationService.productionNodes();
      if (nodes) {
        this.simulationRan = true;
        this.sankeyData = { ...this.sankeyData, productionNodes: nodes };
        this.co2Data = buildCo2Details(this.sankeyData);
        this.cdr.markForCheck();
      } else {
        this.simulationRan = false;
        this.sankeyData = { ...this.sankeyData, productionNodes: PLACEHOLDER_SANKEY_DATA.productionNodes };
        this.co2Data = buildCo2Details(this.sankeyData);
        this.cdr.markForCheck();
      }
    });
  }
}
