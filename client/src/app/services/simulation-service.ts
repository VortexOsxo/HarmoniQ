import { Injectable } from '@angular/core';
import { computed, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SimulationService {
  selectedInfrastructure = signal<string | null>(null);
  selectedScenario = signal<string | null>(null);
  canLaunch = computed(() => this.selectedInfrastructure() !== null && this.selectedScenario() !== null);

  launchSimulation() {

  }
}
