import { Component } from '@angular/core';
import { ScenariosService } from '@app/services/scenarios-service';
import { Scenario } from '@app/models/scenario';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ScenarioCreationModal } from '@app/components/scenario/scenario-creation-modal/scenario-creation-modal';

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

  constructor(private scenariosService: ScenariosService, private modalService: NgbModal) {
    this.scenariosService.fetchScenarios().subscribe((scenarios) => {
      this.scenarios = scenarios;
    });
  }

  openModal() {
    this.modalService.open(ScenarioCreationModal).result.then((result) => {
      if (result) {
        this.scenariosService.fetchScenarios().subscribe((scenarios) => {
          this.scenarios = scenarios;
        });
      }
    }, () => { });
  }
}
