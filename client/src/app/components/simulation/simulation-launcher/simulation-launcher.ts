import { Component } from '@angular/core';
import { SimulationService } from '@app/services/simulation-service';
import { ScenariosService } from '@app/services/scenarios-service';

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
    return this.scenariosService.selectedScenario();
  }

  get canLaunch() {
    return this.simulationService.canLaunch();
  }

  constructor(private simulationService: SimulationService, private scenariosService: ScenariosService) { }

  launchSimulation() {
    this.simulationService.launchSimulation();
  }
}
