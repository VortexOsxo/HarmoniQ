import { Component } from '@angular/core';
import { SimulationService } from '@app/services/simulation-service';

@Component({
  selector: 'app-simulation-launcher',
  imports: [],
  templateUrl: './simulation-launcher.html',
  styleUrl: './simulation-launcher.css',
})
export class SimulationLauncher {

  get selectedInfrastructure() {
    return this.simulationService.selectedInfrastructure();
  }

  get selectedScenario() {
    return this.simulationService.selectedScenario();
  }

  get canLaunch() {
    return this.simulationService.canLaunch();
  }

  constructor(private simulationService: SimulationService) { }

  launchSimulation() {
    this.simulationService.launchSimulation();
  }
}
