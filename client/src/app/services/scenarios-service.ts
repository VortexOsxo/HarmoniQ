import { Injectable, signal } from '@angular/core';
import { Scenario } from '@app/models/scenario';
import { Weather } from '@app/models/weather';
import { Consumption } from '@app/models/consumption';
import { LocalStorageService } from './local-storage-service';

const SCENARIOS_KEY = 'harmoniq_local_scenarios';

@Injectable({
  providedIn: 'root',
})
export class ScenariosService {
  scenarios = signal<Scenario[]>([]);
  selectedScenario = signal<Scenario | null>(null);

  constructor(private storageService: LocalStorageService) {
    this.refreshScenarios();
  }

  refreshScenarios() {
    const loaded = this.storageService.loadElements<Scenario>(SCENARIOS_KEY);
    this.scenarios.set([...this.getDefaultScenarios(), ...loaded]);
  }

  createScenario(scenario: Scenario) {
    const createdScenario = this.storageService.createElement(SCENARIOS_KEY, scenario);

    this.scenarios.update(s => [...s, createdScenario]);
    this.selectedScenario.set(createdScenario);
  }

  deleteScenario(scenario: Scenario) {
    this.storageService.deleteElement<Scenario>(SCENARIOS_KEY, scenario.id);

    this.scenarios.update(s => s.filter(item => item.id !== scenario.id));
    if (this.selectedScenario()?.id === scenario.id)
      this.selectedScenario.set(null);
  }

  private getDefaultScenarios(): Scenario[] {
    return [
      {
        "id": 1,
        "nom": "année 2035",
        "description": "Scénario de base pour l'année 2035",
        "date_de_debut": "2035-01-01T00:00:00",
        "date_de_fin": "2035-12-31T00:00:00",
        "pas_de_temps": "PT1H",
        "weather": Weather.Typical,
        "consomation": Consumption.Normal,
      },
      {
        "id": 2,
        "nom": "année 2050",
        "description": "Scénario de base pour l'année 2050",
        "date_de_debut": "2050-01-01T00:00:00",
        "date_de_fin": "2050-12-31T00:00:00",
        "pas_de_temps": "PT1H",
        "weather": Weather.Typical,
        "consomation": Consumption.Conservative,
      },
    ]
  }
}
