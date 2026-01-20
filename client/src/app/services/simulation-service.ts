import { Injectable } from '@angular/core';
import { computed, signal } from '@angular/core';
import { ScenariosService } from './scenarios-service';
import { InfrastruturesService } from './infrastrutures-service';

@Injectable({
  providedIn: 'root',
})
export class SimulationService {

  constructor(
    private scenariosService: ScenariosService,
    private infrastructuresService: InfrastruturesService
  ) { }

  canLaunch = computed(() => this.infrastructuresService.selectedInfraGroup() !== null && this.scenariosService.selectedScenario() !== null);

  launchSimulation() {

  }
}
