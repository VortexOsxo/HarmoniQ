import { ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { ScenariosService } from '@app/services/scenarios-service';
import { SimulationService } from '@app/services/simulation-service';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule } from '@angular/common';
import { GraphService, graphServiceConfig } from '@app/services/graph-service';

@Component({
  selector: 'app-simulation-single-infra-modal',
  imports: [CommonModule],
  templateUrl: './simulation-single-infra-modal.html',
  styleUrl: './simulation-single-infra-modal.css',
})
export class SimulationSingleInfraModal implements OnInit {
  @Input({ required: true }) name!: string;
  @Input({ required: true }) type!: string;
  @Input({ required: true }) id!: any;

  error?: string;
  isLoading = true;

  config = graphServiceConfig;

  get label() {
    return `Production d'énergie de ${this.name} (Scénario: ${this.scenarioService.selectedScenario()?.nom})`;
  }

  constructor(
    public activeModal: NgbActiveModal,
    private scenarioService: ScenariosService,
    private simulationService: SimulationService,
    private graphService: GraphService,
    private cdr: ChangeDetectorRef,
  ) { }

  ngOnInit(): void {
    const obs = this.simulationService.launchSimulationSingleInfra(this.type, this.id);
    if (!obs) return;

    obs.subscribe({
      next: (data) => {
        this.isLoading = false;
        this.graphService.generateProductionSingleInfraGraph(this.type, data);
        this.cdr.detectChanges();
      },
      error: (e) => {
        this.error = 'Une erreur est survenue. Cette infrastructure ne marche peut être pas.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }
}
