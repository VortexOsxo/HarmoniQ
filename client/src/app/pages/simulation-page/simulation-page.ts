import { Component } from '@angular/core';
import { NavigationBar } from '@app/components/navigation-bar/navigation-bar';
import { SimulationLauncher } from '@app/components/simulation/simulation-launcher/simulation-launcher';
import { ScenarioSelector } from '@app/components/scenario/scenario-selector/scenario-selector';
import { InfrastructureSelector } from '@app/components/infrastructure/infrastructure-selector/infrastructure-selector';
import { SimulationResults } from '@app/components/simulation/simulation-results/simulation-results';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-simulation-page',
  imports: [CommonModule, NavigationBar, SimulationLauncher, ScenarioSelector, InfrastructureSelector, SimulationResults],
  templateUrl: './simulation-page.html',
  styleUrl: './simulation-page.css',
})
export class SimulationPage {
  showSourcesPanel = false;

  toggleSourcesPanel() {
    this.showSourcesPanel = !this.showSourcesPanel;
  }

  closeSourcesPanel() {
    this.showSourcesPanel = false;
  }
}

