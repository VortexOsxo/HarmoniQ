import { booleanAttribute, Component, computed, Input, Signal } from '@angular/core';
import { SimulationService } from '@app/services/simulation-service';
import { ScenariosService } from '@app/services/scenarios-service';
import { InfrastruturesService } from '@app/services/infrastrutures-service';
import { CommonModule } from '@angular/common';
import { InfrastructureGroup } from '@app/models/infrastructure-group';
import { Scenario } from '@app/models/scenario';

@Component({
  selector: 'app-simulation-launcher',
  imports: [CommonModule],
  templateUrl: './simulation-launcher.html',
  styleUrl: './simulation-launcher.css',
  host: {
    '[class.launcher--panel-footer]': 'panelFooter',
  },
})
export class SimulationLauncher {
  @Input({ transform: booleanAttribute }) panelFooter = false;

  selectedInfrastructure!: Signal<InfrastructureGroup | null>;
  selectedScenario!: Signal<Scenario | null>;

  missingScenario = computed(() => this.selectedScenario() === null);
  missingInfra = computed(() => this.selectedInfrastructure() === null);

  constructor(
    public simulationService: SimulationService,
    private scenariosService: ScenariosService,
    private infrastructuresService: InfrastruturesService,
  ) {
    this.selectedInfrastructure = this.infrastructuresService.selectedInfraGroup;
    this.selectedScenario = this.scenariosService.selectedScenario;
  }

  dismissHints() {
    this.simulationService.dismissLaunchHints();
  }
}
