import { Component, computed, effect, signal, Signal } from '@angular/core';
import { SimulationService } from '@app/services/simulation-service';
import { ScenariosService } from '@app/services/scenarios-service';
import { InfrastruturesService } from '@app/services/infrastrutures-service';
import { CommonModule } from '@angular/common';
import { InfrastructureGroup } from '@app/models/infrastructure-group';
import { Scenario } from '@app/models/scenario';
import { Router } from '@angular/router';

@Component({
  selector: 'app-simulation-launcher',
  imports: [CommonModule],
  templateUrl: './simulation-launcher.html',
  styleUrl: './simulation-launcher.css',
})
export class SimulationLauncher {
  isLaunching = signal(false);
  showConfigHints = signal(false);

  canLaunch!: Signal<boolean>;
  selectedInfrastructure!: Signal<InfrastructureGroup | null>;
  selectedScenario!: Signal<Scenario | null>;

  missingScenario = computed(() => this.selectedScenario() === null);
  missingInfra = computed(() => this.selectedInfrastructure() === null);

  constructor(
    private simulationService: SimulationService,
    private scenariosService: ScenariosService,
    private infrastructuresService: InfrastruturesService,
    private router: Router,
  ) {
    this.canLaunch = this.simulationService.canLaunch;
    this.selectedInfrastructure = this.infrastructuresService.selectedInfraGroup;
    this.selectedScenario = this.scenariosService.selectedScenario;

    // Auto-dismiss hints when config becomes valid
    effect(() => {
      if (this.canLaunch()) {
        this.showConfigHints.set(false);
      }
    });
  }

  launchSimulation() {
    this.router.navigate(['/simulation']);
  }

  onLaunchClick() {
    if (this.canLaunch()) {
      this.launchSimulation();
    } else {
      this.showConfigHints.set(true);
    }
  }

  dismissHints() {
    this.showConfigHints.set(false);
  }
}
