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
import { INFRA_COLORS } from '@app/data/infra-colors.data';

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
    { key: 'parc_eoliens',            label: 'Éolien',             img: '/icons/eolienne.png',  color: INFRA_COLORS['eolienneparc'], hydroFilter: null },
    { key: 'central_hydroelectriques', label: "Hydro (fil de l'eau)", img: '/icons/barrage.png', color: INFRA_COLORS['hydro_fil'], hydroFilter: "Fil de l'eau" },
    { key: 'central_hydroelectriques', label: 'Hydro (réservoir)', img: '/icons/barrage.png',   color: INFRA_COLORS['hydro_reservoir'], hydroFilter: 'Réservoir' },
    { key: 'parc_solaires',           label: 'Solaire',            img: '/icons/solaire.png',   color: INFRA_COLORS['solaire'], hydroFilter: null },
    { key: 'central_nucleaire',       label: 'Nucléaire',          img: '/icons/nucelaire.png', color: INFRA_COLORS['nucleaire'], hydroFilter: null },
    { key: 'central_thermique',       label: 'Thermique',          img: '/icons/thermique.png', color: INFRA_COLORS['thermique'], hydroFilter: null },
  ];

  get infraSummary() {
    const group: any = this.infrasService.selectedInfraGroup();
    const hydroIds: string[] = group?.central_hydroelectriques ?? [];
    const allHydro: any[] = this.infrasService.getInfrasSignalByType('hydro')();
    const selectedHydro = allHydro.filter((h: any) => hydroIds.includes(String(h.id)));

    const breakdown = SimulationPage.INFRA_DEFS.map(def => {
      if (def.hydroFilter) {
        const isFil = def.hydroFilter === "Fil de l'eau";
        const count = selectedHydro.filter((h: any) =>
          isFil ? h.type_barrage === "Fil de l'eau" : h.type_barrage !== "Fil de l'eau"
        ).length;
        return { ...def, count };
      }
      return { ...def, count: (group?.[def.key] ?? []).length };
    });
    return { breakdown, total: breakdown.reduce((s, d) => s + d.count, 0) };
  }

  readonly sections: Section[] = [
    { id: 'section-cost',      title: 'Coût du réseau',       desc: 'Estimation du coût total d\'exploitation',  icon: 'fa-coins',                waitForSimulation: false },
    { id: 'section-co2',       title: 'Émissions CO₂',        desc: 'Bilan carbone des sources de production',   icon: 'fa-cloud',                waitForSimulation: true  },
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
