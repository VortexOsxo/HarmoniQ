import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePicker } from '@app/components/commons/date-picker/date-picker';
import { Scenario, createEmptyScenario } from '@app/models/scenario';
import { Weather } from '@app/models/weather';
import { Consumption } from '@app/models/consumption';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ScenariosService } from '@app/services/scenarios-service';

const VALID_YEARS = [2035, 2050];

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

  public Weather = Weather;
  public Consumption = Consumption;

  constructor(public activeModal: NgbActiveModal, private scenariosService: ScenariosService) { }

  get dateError(): string | null {
    const startYear = this.yearOf(this.scenario.date_de_debut);
    const endYear   = this.yearOf(this.scenario.date_de_fin);

    if ((startYear !== null && !VALID_YEARS.includes(startYear)) ||
        (endYear !== null && !VALID_YEARS.includes(endYear)) ||
        (startYear !== null && endYear !== null && startYear !== endYear))
      return "L'étendue de temps doit être en 2035 ou 2050.";
    return null;
  }

  get canSubmit(): boolean {
    return this.scenario.nom.trim().length > 0 && this.dateError === null;
  }

  onSubmit() {
    if (!this.canSubmit) return;
    this.scenariosService.createScenario(this.scenario);
    this.activeModal.close();
  }

  dismiss() {
    this.activeModal.dismiss();
  }

  private yearOf(dateStr: string): number | null {
    if (!dateStr) return null;
    const y = parseInt(dateStr.split('-')[0], 10);
    return isNaN(y) ? null : y;
  }
}
