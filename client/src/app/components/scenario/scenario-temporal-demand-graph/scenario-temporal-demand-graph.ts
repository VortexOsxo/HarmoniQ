import { AfterViewInit, Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { graphServiceConfig } from '@app/services/graph-service';
import { DemandeTemporalGraphService } from '@app/services/graph-services/demande-temporal-graph-service';

@Component({
  selector: 'app-scenario-temporal-demand-graph',
  imports: [CommonModule],
  templateUrl: './scenario-temporal-demand-graph.html',
})
export class ScenarioTemporalDemandGraph {
  config = graphServiceConfig;

  constructor(private graphService: DemandeTemporalGraphService) { }
}

