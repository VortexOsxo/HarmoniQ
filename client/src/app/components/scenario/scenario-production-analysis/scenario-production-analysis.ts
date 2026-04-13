import { Component } from '@angular/core';
import { graphServiceConfig } from '@app/services/graph-service';
import { SimulationAnalysisGraphService } from '@app/services/graph-services/simulation-analysis-graph-service';

@Component({
  selector: 'app-scenario-production-analysis',
  imports: [],
  templateUrl: './scenario-production-analysis.html',
  styleUrl: './scenario-production-analysis.css',
})
export class ScenarioProductionAnalysis {
  config = graphServiceConfig;
  constructor(public analysisService: SimulationAnalysisGraphService) {}
}
