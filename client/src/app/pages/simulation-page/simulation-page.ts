import { Component } from '@angular/core';
import { NavigationBar } from '@app/components/navigation-bar/navigation-bar';
import { SimulationLauncher } from '@app/components/simulation/simulation-launcher/simulation-launcher';
import { ScenarioSelector } from '@app/components/scenario/scenario-selector/scenario-selector';
import { InfrastructureSelector } from '@app/components/infrastructure/infrastructure-selector/infrastructure-selector';

@Component({
  selector: 'app-simulation-page',
  imports: [NavigationBar, SimulationLauncher, ScenarioSelector, InfrastructureSelector],
  templateUrl: './simulation-page.html',
  styleUrl: './simulation-page.css',
})
export class SimulationPage {

}
