import { ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { ScenariosService } from '@app/services/scenarios-service';
import { SimulationService } from '@app/services/simulation-service';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule } from '@angular/common';
import { GraphService, graphServiceConfig } from '@app/services/graph-service';
import { forkJoin } from 'rxjs';

import { GranularitySelectorComponent } from '@app/components/commons/granularity-selector/granularity-selector';

@Component({
  selector: 'app-simulation-single-infra-modal',
  imports: [CommonModule, GranularitySelectorComponent],
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
  costs?: any;
  emissions?: any;

  selectedGranularity = 'original';
  productionData: any;

  get label() {
    return `Simulation de ${this.name} (Scénario: ${this.scenarioService.selectedScenario()?.nom})`;
  }

  constructor(
    public activeModal: NgbActiveModal,
    private scenarioService: ScenariosService,
    private simulationService: SimulationService,
    private graphService: GraphService,
    private cdr: ChangeDetectorRef,
  ) { }

  ngOnInit(): void {
    this.initProduction();
    this.initCosts();
    this.initEmissions();
  }

  onGranularityChange(granularity: string) {
    this.selectedGranularity = granularity;
    if (this.productionData) {
      this.graphService.generateProductionSingleInfraGraph(this.type, this.productionData, this.selectedGranularity);
    }
  }

  private initProduction() {
    if (this.type === 'hydro') {
      this.isLoading = false;
      return;
    }
    const obs = this.simulationService.launchSimulationSingleInfra(this.type, this.id);
    if (!obs) return;

    obs.subscribe({
      next: (data) => {
        this.isLoading = false;
        this.productionData = data;
        this.graphService.generateProductionSingleInfraGraph(this.type, data, this.selectedGranularity);
        this.cdr.detectChanges();
      },
      error: (e) => {
        this.error = 'Une erreur est survenue. Cette infrastructure ne marche peut être pas.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private initCosts() {
    this.simulationService.getInfraCost(this.type, this.id)?.
      subscribe((result) => {
        this.costs = result;
        this.cdr.detectChanges();
      });
  }

  private initEmissions() {
    this.simulationService.getInfraEmission(this.type, this.id)?.
      subscribe((result) => {
        this.emissions = result;
        this.cdr.detectChanges();
      });
  }
}
