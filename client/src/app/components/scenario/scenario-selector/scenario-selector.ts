import { Component } from '@angular/core';
import { ScenariosService } from '@app/services/scenarios-service';
import { Scenario } from '@app/models/scenario';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ScenarioCreationModal } from '@app/components/scenario/scenario-creation-modal/scenario-creation-modal';
import { WeatherLabels } from '@app/models/weather';
import { ConsumptionLabels } from '@app/models/consumption';
import { TutorialService } from '@app/services/tutorial-service';

@Component({
  selector: 'app-scenario-selector',
  imports: [CommonModule, FormsModule],
  templateUrl: './scenario-selector.html',
  styleUrl: './scenario-selector.css',
})
export class ScenarioSelector {
  public WeatherLabels = WeatherLabels;
  public ConsumptionLabels = ConsumptionLabels;

  get scenarios(): Scenario[] {
    return this.scenariosService.scenarios();
  }

  get selectedScenario(): Scenario | null {
    return this.scenariosService.selectedScenario();
  }

  get canDeleteSelected(): boolean {
    const id = this.scenariosService.selectedScenario()?.id;
    return !!id && id !== 1 && id !== 2;
  }

  set selectedScenario(scenario: Scenario | null) {
    this.scenariosService.selectedScenario.set(scenario);
  }

  constructor(
    private scenariosService: ScenariosService,
    private modalService: NgbModal,
    private tutorialService: TutorialService,
  ) { }

  openModal() {
    const options = this.tutorialService.currentState.active
      ? { backdrop: 'static' as const, keyboard: false }
      : {};
    this.modalService.open(ScenarioCreationModal, options);
  }

  deleteScenario(scenario: Scenario) {
    this.scenariosService.deleteScenario(scenario);
  }

  compareScenarios(s1: Scenario, s2: Scenario): boolean {
    return s1 && s2 ? s1.id === s2.id : s1 === s2;
  }
}
