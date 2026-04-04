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
import { SimulationAnalysisGraphService } from '@app/services/graph-services/simulation-analysis-graph-service';
import { GranularitySelectorComponent } from '@app/components/commons/granularity-selector/granularity-selector';
import { InfrastruturesService } from '@app/services/infrastrutures-service';
import { graphServiceConfig } from '@app/services/graph-service';

interface Section {
  id: string;
  title: string;
  desc: string;
  icon: string;
  isReady: () => boolean;
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
  @ViewChild(ScenarioDemandProdSankey) sankeySim?: ScenarioDemandProdSankey;

  simulationService = inject(SimulationService);
  stepService       = inject(SimulationStepService);
  costService       = inject(SimulationCostGraphService);
  co2Service        = inject(SimulationCo2GraphService);
  analysisService   = inject(SimulationAnalysisGraphService);
  infrasService     = inject(InfrastruturesService);

  readonly config = graphServiceConfig;

  private static readonly INFRA_DEFS = [
    { key: 'parc_eoliens',             label: 'Éolien',               img: '/icons/eolienne.png',  color: '#6abbc4', hydroFilter: null },
    { key: 'central_hydroelectriques', label: "Hydro (fil de l'eau)", img: '/icons/barrage.png',   color: '#7bbfe8', hydroFilter: "Fil de l'eau" },
    { key: 'central_hydroelectriques', label: 'Hydro (réservoir)',    img: '/icons/barrage.png',   color: '#2b6fa8', hydroFilter: 'Réservoir' },
    { key: 'parc_solaires',            label: 'Solaire',              img: '/icons/solaire.png',   color: '#e8c53c', hydroFilter: null },
    { key: 'central_nucleaire',        label: 'Nucléaire',            img: '/icons/nucelaire.png', color: '#e8754a', hydroFilter: null },
    { key: 'central_thermique',        label: 'Thermique',            img: '/icons/thermique.png', color: '#e25c5c', hydroFilter: null },
  ];

  get infraSummary() {
    const group: any = this.infrasService.selectedInfraGroup();
    const hydroIds: string[] = group?.central_hydroelectriques ?? [];
    const allHydro: any[] = this.infrasService.getInfrasSignalByType('hydro')();
    const selectedHydro = allHydro.filter((h: any) => hydroIds.includes(String(h.id)));

    const typeToKey: Record<string, string> = {
      eolienneparc: 'parc_eoliens',
      solaire:      'parc_solaires',
      hydro:        'central_hydroelectriques',
      thermique:    'central_thermique',
      nucleaire:    'central_nucleaire',
    };

    // Compter les infras user-created par clé de groupe
    const userCountByKey: Record<string, number> = {};
    for (const [type, key] of Object.entries(typeToKey)) {
      userCountByKey[key] = (this.infrasService.getInfrasSignalByType(type)() as any[])
        .filter(i => i.isUserCreated).length;
    }

    const breakdown = SimulationPage.INFRA_DEFS.map(def => {
      if (def.hydroFilter) {
        const isFil = def.hydroFilter === "Fil de l'eau";
        const dbCount = selectedHydro.filter((h: any) =>
          isFil ? h.type_barrage === "Fil de l'eau" : h.type_barrage !== "Fil de l'eau"
        ).length;
        // Les hydros user-created sont comptées une seule fois dans le premier hydroFilter
        const userCount = isFil ? (userCountByKey['central_hydroelectriques'] ?? 0) : 0;
        return { ...def, count: dbCount + userCount };
      }
      const dbCount = (group?.[def.key] ?? []).length;
      const userCount = userCountByKey[def.key] ?? 0;
      return { ...def, count: dbCount + userCount };
    });
    return { breakdown, total: breakdown.reduce((s, d) => s + d.count, 0) };
  }

  readonly sections: Section[] = [
    { id: 'section-cost',       title: 'Coût du réseau',       desc: 'OPEX & CAPEX par source',                  icon: 'fa-coins',           isReady: () => !this.costService.isLoading() },
    { id: 'section-co2',        title: 'Émissions CO₂',        desc: 'Construction & annuelles',                 icon: 'fa-cloud',           isReady: () => !this.co2Service.isLoading() },
    { id: 'section-finance',    title: 'Analyse financière',   desc: 'Rentabilité & coûts des infras',           icon: 'fa-chart-bar',       isReady: () => !this.costService.rentabiliteLoading() },
    { id: 'section-sankey',     title: 'Flux de production',   desc: 'Répartition production → demande',         icon: 'fa-diagram-project', isReady: () => !this.isSimulating },
    { id: 'section-temporal',   title: 'Production & Demande', desc: 'Évolution temporelle',                     icon: 'fa-chart-line',      isReady: () => !this.isSimulating },
    { id: 'section-repartition',title: 'Répartition',          desc: 'Production & demande par secteur',         icon: 'fa-chart-pie',       isReady: () => !this.analysisService.isLoading() },
    { id: 'section-top10-prod', title: 'Top 10 productives',   desc: 'Infrastructures les plus productrices',    icon: 'fa-medal',           isReady: () => !this.analysisService.isLoading() },
    { id: 'section-seasonal',   title: 'Saisonnalité',         desc: 'Approvisionnement par saison',             icon: 'fa-snowflake',       isReady: () => !this.analysisService.isLoading() },
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
    if (section.isReady()) {
      return { icon: 'fa-circle-check', color: '#20c997' };
    }
    return this.isSimulating
      ? { icon: 'fa-circle-notch fa-spin', color: '#4361ee' }
      : { icon: 'fa-circle',              color: '#ced4da' };
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
