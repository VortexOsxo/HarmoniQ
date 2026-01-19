import { Injectable } from '@angular/core';
import { computed, signal } from '@angular/core';
import { ScenariosService } from './scenarios-service';

@Injectable({
  providedIn: 'root',
})
export class SimulationService {

  constructor(private scenariosService: ScenariosService) { }

  selectedInfrastructure = signal<string | null>(null);

  canLaunch = computed(() => this.selectedInfrastructure() !== null && this.scenariosService.selectedScenario() !== null);

  launchSimulation() {

  }
}
