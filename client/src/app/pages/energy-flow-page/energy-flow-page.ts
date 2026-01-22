import { Component, AfterViewInit } from '@angular/core';
import { NavigationBar } from '@app/components/navigation-bar/navigation-bar';
import { EnergyFlowService } from '@app/services/energy-flow-service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GraphService, graphServiceConfig } from '@app/services/graph-service';

@Component({
  selector: 'app-energy-flow-page',
  imports: [NavigationBar, CommonModule, FormsModule],
  templateUrl: './energy-flow-page.html',
  styleUrl: './energy-flow-page.css',
})
export class EnergyFlowPage implements AfterViewInit {
  config = graphServiceConfig;

  climateScenario: string = "neutre";
  growthScenario: string = "moyen";
  efficiencyScenario: string = "moyen";

  constructor(
    private energyFlowService: EnergyFlowService,
    private graphService: GraphService,
  ) { }

  ngAfterViewInit(): void {
    this.energyFlowService.generateEnergyProdConsSankeyGraph(this.climateScenario, this.growthScenario, this.efficiencyScenario);
  }

  async updateSankey() {
    this.energyFlowService.generateEnergyProdConsSankeyGraph(this.climateScenario, this.growthScenario, this.efficiencyScenario);
  }

  async downloadPNG() {
    this.graphService.downloadGraph(this.config.ENERGY_PROD_CONS_SANKEY_ID);
  }
}
