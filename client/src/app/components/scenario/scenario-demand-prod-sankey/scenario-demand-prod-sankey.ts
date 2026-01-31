import { Component, AfterViewInit, effect, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { graphServiceConfig } from '@app/services/graph-service';
import { DemandeSankeyGraphService, GraphState } from '@app/services/graph-services/demande-sankey-graph-service';
import { ScenariosService } from '@app/services/scenarios-service';

@Component({
  selector: 'app-scenario-demand-prod-sankey',
  imports: [CommonModule],
  templateUrl: './scenario-demand-prod-sankey.html',
})
export class ScenarioDemandProdSankey implements AfterViewInit, OnDestroy {
  config = graphServiceConfig;
  GraphState = GraphState;

  get graphState() {
    return this.graphService.state;
  }

  get selectedScenario() {
    return this.scenariosService.selectedScenario
  }

  constructor(
    private graphService: DemandeSankeyGraphService,
    private scenariosService: ScenariosService,
  ) { }

  ngAfterViewInit(): void {
    this.graphService.display();
  }

  ngOnDestroy(): void {
    this.graphService.undisplay();
  }
}
