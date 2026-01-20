import { Component } from '@angular/core';
import { SimulationService } from '@app/services/simulation-service';
import { ScenariosService } from '@app/services/scenarios-service';
import { InfrastruturesService } from '@app/services/infrastrutures-service';

@Component({
  selector: 'app-simulation-launcher',
  imports: [],
  templateUrl: './simulation-launcher.html',
  styleUrl: './simulation-launcher.css',
})
export class SimulationLauncher {

  get selectedInfrastructure() {
    return this.infrastructuresService.selectedInfraGroup();
  }

  get selectedScenario() {
    return this.scenariosService.selectedScenario();
  }

  get canLaunch() {
    return this.simulationService.canLaunch();
  }

  constructor(
    private simulationService: SimulationService,
    private scenariosService: ScenariosService,
    private infrastructuresService: InfrastruturesService
  ) { }

  launchSimulation() {
    this.simulationService.launchSimulation();
  }
}
