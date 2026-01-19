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
  get scenarios(): Scenario[] {
    return this.scenariosService.scenarios();
  }

  get selectedScenario(): Scenario | null {
    return this.scenariosService.selectedScenario();
  }

  set selectedScenario(scenario: Scenario | null) {
    this.scenariosService.selectedScenario.set(scenario);
  }

  constructor(private scenariosService: ScenariosService, private modalService: NgbModal) { }

  openModal() {
    this.modalService.open(ScenarioCreationModal);
  }

  deleteScenario(scenario: Scenario) {
    this.scenariosService.deleteScenario(scenario).subscribe();
  }

  compareScenarios(s1: Scenario, s2: Scenario): boolean {
    return s1 && s2 ? s1.id === s2.id : s1 === s2;
  }
}
