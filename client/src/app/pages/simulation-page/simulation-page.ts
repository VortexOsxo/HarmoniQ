import { AfterViewInit, Component, inject, ViewChild } from '@angular/core';
import { SimulationTopBar } from '@app/components/simulation/simulation-top-bar/simulation-top-bar';
import { CommonModule } from '@angular/common';
import { ScenarioDemandProdSankey } from "@app/components/scenario/scenario-demand-prod-sankey/scenario-demand-prod-sankey";
import { ScenarioTemporalSimulation } from "@app/components/scenario/scenario-temporal-simulation/scenario-temporal-simulation";
import { ScenarioCo2Simulation } from '@app/components/scenario/scenario-co2-simulation/scenario-co2-simulation';
import { SimulationService } from '@app/services/simulation-service';
import { SimulationStepService } from '@app/services/simulation-step-service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { GameArea } from '@app/components/game/game-area/game-area';
import { ScenarioCostSimulation } from '@app/components/scenario/scenario-cost-simulation/scenario-cost-simulation';
import { SimulationCostGraphService } from '@app/services/graph-services/simulation-cost-graph-service';
import { SimulationCo2GraphService } from '@app/services/graph-services/simulation-co2-graph-service';
import { GranularitySelectorComponent } from '@app/components/commons/granularity-selector/granularity-selector';
import { InfrastruturesService } from '@app/services/infrastrutures-service';

interface Section {
  id: string;
  title: string;
  desc: string;
  icon: string;
  waitForSimulation: boolean;
}

@Component({
  selector: 'app-simulation-page',
  standalone: true,
  imports: [SimulationTopBar, CommonModule, ScenarioCostSimulation, ScenarioCo2Simulation, ScenarioDemandProdSankey, ScenarioTemporalSimulation, GranularitySelectorComponent],
  templateUrl: './simulation-page.html',
  styleUrl: './simulation-page.css',
})
export class SimulationPage implements AfterViewInit {

  constructor(private bootstrap: NgbModal) { }

  @ViewChild(ScenarioTemporalSimulation) temporalSim?: ScenarioTemporalSimulation;

  simulationService    = inject(SimulationService);
  stepService          = inject(SimulationStepService);
  costService          = inject(SimulationCostGraphService);
  co2Service           = inject(SimulationCo2GraphService);
  infrasService        = inject(InfrastruturesService);

  private static readonly INFRA_DEFS = [
    { key: 'parc_eoliens',            label: 'Éolien',     icon: 'fa-wind',  color: '#6abbc4' },
    { key: 'central_hydroelectriques', label: 'Hydro',      icon: 'fa-water', color: '#4a9dd4' },
    { key: 'parc_solaires',           label: 'Solaire',    icon: 'fa-sun',   color: '#e8c53c' },
    { key: 'central_nucleaire',       label: 'Nucléaire',  icon: 'fa-atom',  color: '#e8754a' },
    { key: 'central_thermique',       label: 'Thermique',  icon: 'fa-fire',  color: '#e25c5c' },
  ];

  get infraSummary() {
    const group: any = this.infrasService.selectedInfraGroup();
    const breakdown = SimulationPage.INFRA_DEFS.map(def => ({
      ...def,
      count: (group?.[def.key] ?? []).length,
    }));
    return { breakdown, total: breakdown.reduce((s, d) => s + d.count, 0) };
  }

  readonly sections: Section[] = [
    { id: 'section-cost',      title: 'Coût du réseau',       desc: 'Estimation du coût total d\'exploitation',  icon: 'fa-coins',                waitForSimulation: false },
    { id: 'section-co2',       title: 'Émissions CO₂',        desc: 'Bilan carbone des sources de production',   icon: 'fa-cloud',                waitForSimulation: false },
    { id: 'section-sankey',    title: 'Flux de production',   desc: 'Répartition entre production et demande',   icon: 'fa-diagram-project',      waitForSimulation: true  },
    { id: 'section-temporal',  title: 'Production & Demande', desc: 'Évolution temporelle de la production',     icon: 'fa-chart-line',           waitForSimulation: true  },
    { id: 'section-overprod',  title: 'Surproduction',        desc: 'Surplus et déficit des infrastructures',    icon: 'fa-bolt-lightning',       waitForSimulation: true  },
  ];

  get isSimulating(): boolean {
    const idx = this.stepService.currentStepIndex();
    const total = this.stepService.steps().length;
    return idx >= 0 && idx < total;
  }

  get currentStepName(): string {
    return this.stepService.currentStepName();
  }

  getSectionIndicator(section: Section): { icon: string; color: string } {
    if (!section.waitForSimulation) {
      return { icon: 'fa-circle-check', color: '#20c997' };
    }
    return this.isSimulating
      ? { icon: 'fa-circle-notch fa-spin', color: '#4361ee' }
      : { icon: 'fa-circle-check',         color: '#20c997' };
  }

  ngAfterViewInit(): void {
    this.simulationService.launchSimulation();
  }

  get temporalGranularity(): string {
    return this.temporalSim?.selectedGranularity ?? 'daily';
  }

  onTemporalGranularityChange(granularity: string): void {
    this.temporalSim?.onGranularityChange(granularity);
  }

  scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  openQuiz() {
    this.bootstrap.open(GameArea, { centered: true, windowClass: 'game-modal' });
  }
}
