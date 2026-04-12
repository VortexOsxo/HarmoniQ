import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePicker } from '@app/components/commons/date-picker/date-picker';
import { Scenario, createEmptyScenario } from '@app/models/scenario';
import { Weather } from '@app/models/weather';
import { Consumption } from '@app/models/consumption';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ScenariosService } from '@app/services/scenarios-service';


@Component({
  selector: 'app-scenario-creation-modal',
  imports: [DatePicker, FormsModule],
  templateUrl: './scenario-creation-modal.html',
  styleUrl: './scenario-creation-modal.css',
})
export class ScenarioCreationModal {
  scenario: Scenario = {
    ...createEmptyScenario(),
    date_de_debut: '2035-01-01',
    date_de_fin: '2035-12-31',
  };


  readonly nomMaxLength = 50;
  readonly descriptionMaxLength = 1000;

  public Weather = Weather;
  public Consumption = Consumption;

  constructor(public activeModal: NgbActiveModal, private scenariosService: ScenariosService) { }

  get dateError(): string | null {
    const start = this.scenario.date_de_debut;
    const end   = this.scenario.date_de_fin;
    if (start && end && end < start)
      return 'La date de fin doit être après la date de début.';
    return null;
  }

  get nameExistsError(): string | null {
    const nom = this.scenario.nom.trim().toLowerCase();
    if (!nom) return null;
    const existing = this.scenariosService.scenarios().find(s => s.nom.trim().toLowerCase() === nom);
    if (existing) return "Un scénario avec ce nom existe déjà.";
    return null;
  }

  get canSubmit(): boolean {
    return this.scenario.nom.trim().length > 0
      && this.scenario.nom.length <= this.nomMaxLength
      && this.scenario.description.length <= this.descriptionMaxLength
      && this.dateError === null
      && this.nameExistsError === null;
  }

  onSubmit() {
    if (!this.canSubmit) return;
    this.scenariosService.createScenario(this.scenario);
    this.activeModal.close();
  }

  dismiss() {
    this.activeModal.dismiss();
  }

}
