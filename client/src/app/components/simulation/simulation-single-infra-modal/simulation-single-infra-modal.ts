import { ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { ScenariosService } from '@app/services/scenarios-service';
import { SimulationService } from '@app/services/simulation-service';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule } from '@angular/common';
import { GraphService, graphServiceConfig } from '@app/services/graph-service';
import { InfraIconComponent } from '@app/components/commons/infra-icon';
import { INFRA_COLORS } from '@app/data/infra-colors.data';
import { GranularitySelectorComponent } from '@app/components/commons/granularity-selector/granularity-selector';

@Component({
  selector: 'app-simulation-single-infra-modal',
  standalone: true,
  imports: [CommonModule, GranularitySelectorComponent, InfraIconComponent],
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

  get typeColor(): string {
    return INFRA_COLORS[this.type] ?? '#3498db';
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
      setTimeout(() => {
        this.graphService.generateProductionSingleInfraGraph(this.type, this.productionData, this.selectedGranularity);
      }, 0);
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
        // Flush Angular change detection first so the *ngIf renders the chart div,
        // then defer Plotly to the next macrotask so the DOM element is guaranteed to exist.
        this.cdr.detectChanges();
        setTimeout(() => {
          this.graphService.generateProductionSingleInfraGraph(this.type, data, this.selectedGranularity);
        }, 0);
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
