import { Component, OnDestroy, signal, Signal } from '@angular/core';
import { SimulationService } from '@app/services/simulation-service';
import { ScenariosService } from '@app/services/scenarios-service';
import { InfrastruturesService } from '@app/services/infrastrutures-service';
import { CommonModule } from '@angular/common';
import { InfrastructureGroup } from '@app/models/infrastructure-group';
import { Scenario } from '@app/models/scenario';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-simulation-launcher',
  imports: [CommonModule],
  templateUrl: './simulation-launcher.html',
  styleUrl: './simulation-launcher.css',
})
export class SimulationLauncher implements OnDestroy {
  isLaunching = signal(false);

  canLaunch!: Signal<boolean>;
  selectedInfrastructure!: Signal<InfrastructureGroup | null>;
  selectedScenario!: Signal<Scenario | null>;

  sub?: Subscription;

  constructor(
    private simulationService: SimulationService,
    private scenariosService: ScenariosService,
    private infrastructuresService: InfrastruturesService,
  ) {
    this.canLaunch = this.simulationService.canLaunch;
    this.selectedInfrastructure = this.infrastructuresService.selectedInfraGroup;
    this.selectedScenario = this.scenariosService.selectedScenario;
  }

  launchSimulation() {
    this.simulationService.launchSimulation();
    this.isLaunching.set(true);
    this.sub = this.simulationService.simulationResultsReceived.subscribe(() => {
      this.isLaunching.set(false);
      this.sub?.unsubscribe();
      this.sub = undefined;
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.sub = undefined;
  }
}
