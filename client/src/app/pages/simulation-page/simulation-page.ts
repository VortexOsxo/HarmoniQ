import { Component } from '@angular/core';
import { NavigationBar } from '@app/components/navigation-bar/navigation-bar';
import { SimulationLauncher } from '@app/components/simulation/simulation-launcher/simulation-launcher';
import { ScenarioSelector } from '@app/components/simulation/scenario-selector/scenario-selector';

@Component({
  selector: 'app-simulation-page',
  imports: [NavigationBar, SimulationLauncher, ScenarioSelector],
  templateUrl: './simulation-page.html',
  styleUrl: './simulation-page.css',
})
export class SimulationPage {

}
