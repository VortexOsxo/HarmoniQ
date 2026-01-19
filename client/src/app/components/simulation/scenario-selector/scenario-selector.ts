import { Component } from '@angular/core';
import { ScenariosService } from '@app/services/scenarios-service';
import { Scenario } from '@app/models/scenario';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-scenario-selector',
  imports: [CommonModule, FormsModule],
  templateUrl: './scenario-selector.html',
  styleUrl: './scenario-selector.css',
})
export class ScenarioSelector {
  scenarios: Scenario[] = [];

  get selectedScenario(): Scenario | null {
    return this.scenariosService.selectedScenario();
  }

  set selectedScenario(scenario: Scenario) {
    this.scenariosService.selectedScenario.set(scenario);
  }

  constructor(private scenariosService: ScenariosService) {
    this.scenariosService.fetchScenarios().subscribe((scenarios) => {
      this.scenarios = scenarios;
    });
  }
}
