import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePicker } from '@app/components/commons/date-picker/date-picker';
import { Scenario, createEmptyScenario } from '@app/models/scenario';
import { Weather } from '@app/models/weather';
import { Consumption } from '@app/models/consumption';
import { Optimism } from '@app/models/optimism';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ScenariosService } from '@app/services/scenarios-service';

@Component({
  selector: 'app-scenario-creation-modal',
  imports: [DatePicker, FormsModule],
  templateUrl: './scenario-creation-modal.html',
  styleUrl: './scenario-creation-modal.css',
})
export class ScenarioCreationModal {
  scenario: Scenario = createEmptyScenario();

  public Weather = Weather;
  public Consumption = Consumption;
  public Optimism = Optimism;

  constructor(public activeModal: NgbActiveModal, private scenariosService: ScenariosService) { }

  onSubmit() {
    this.scenariosService.createScenario(this.scenario).subscribe((newScenario) => {
      this.activeModal.close(newScenario);
    });
  }

  dismiss() {
    this.activeModal.dismiss();
  }
}
