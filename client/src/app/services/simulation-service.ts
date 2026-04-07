import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { ScenariosService } from './scenarios-service';
import { InfrastruturesService } from './infrastrutures-service';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import { Subject } from 'rxjs';
import { ProductionNode } from '@app/components/scenario/scenario-demand-prod-sankey/sankey-data.types';
import { DemandeSankeyGraphService } from './graph-services/demande-sankey-graph-service';
import { SimulationTemporalGraphService } from './graph-services/simulation-temporal-graph-service';
import { SimulationStepService } from './simulation-step-service';
import { SimulationCostGraphService } from './graph-services/simulation-cost-graph-service';
import { SimulationCo2GraphService } from './graph-services/simulation-co2-graph-service';
import { SimulationAnalysisGraphService } from './graph-services/simulation-analysis-graph-service';

@Injectable({
    providedIn: 'root',
})
export class SimulationService {
    canLaunch = computed(
        () =>
            this.infrastructuresService.selectedInfraGroup() !== null &&
            this.scenariosService.selectedScenario() !== null,
    );

    openSourcesPanel$ = new Subject<void>();
    productionNodes = signal<ProductionNode[] | null>(null);

    private simulationStepService = inject(SimulationStepService);
    step = computed(() => this.simulationStepService.currentStepName());

    constructor(
        private scenariosService: ScenariosService,
        private infrastructuresService: InfrastruturesService,
        private http: HttpClient,
        private demandeSankeyGraphService: DemandeSankeyGraphService,
        private simulationTemporalGraphService: SimulationTemporalGraphService,
        private simulationCostGraphService: SimulationCostGraphService,
        private simulationCo2GraphService: SimulationCo2GraphService,
        private simulationAnalysisGraphService: SimulationAnalysisGraphService,
    ) {
        effect(() => {
            this.scenariosService.selectedScenario(); // track scenario changes
            this.simulationTemporalGraphService.cachedScenarioId = undefined;
            this.simulationTemporalGraphService.cachedSimulationResult = undefined;
            this.simulationCostGraphService.cachedScenarioId = undefined;
            this.simulationCostGraphService.cachedData = undefined;
            this.simulationCostGraphService.costMode = 'annuel';
            this.simulationCostGraphService.rentabiliteFromSimulation = undefined;
            this.simulationCostGraphService.isLoading.set(true);
            this.simulationCostGraphService.rentabiliteLoading.set(true);
            this.simulationCo2GraphService.cachedScenarioId = undefined;
            this.simulationCo2GraphService.cachedData = undefined;
            this.simulationCo2GraphService.costMode = 'construction';
            this.simulationCo2GraphService.isLoading.set(true);
            this.simulationAnalysisGraphService.reset();
            this.productionNodes.set(null);
        });

        effect(() => {
            this.infrastructuresService.selectedInfraGroup(); // track infra group changes
            this.simulationTemporalGraphService.cachedScenarioId = undefined;
            this.simulationTemporalGraphService.cachedSimulationResult = undefined;
            this.simulationCostGraphService.cachedScenarioId = undefined;
            this.simulationCostGraphService.cachedData = undefined;
            this.simulationCostGraphService.costMode = 'annuel';
            this.simulationCostGraphService.rentabiliteFromSimulation = undefined;
            this.simulationCostGraphService.isLoading.set(true);
            this.simulationCostGraphService.rentabiliteLoading.set(true);
            this.simulationCo2GraphService.cachedScenarioId = undefined;
            this.simulationCo2GraphService.cachedData = undefined;
            this.simulationCo2GraphService.costMode = 'construction';
            this.simulationCo2GraphService.isLoading.set(true);
            this.simulationAnalysisGraphService.reset();
            this.productionNodes.set(null);
        });
    }

    private getInfraScenarioPayload(type: string, infraId: number) {
        const scenario = this.scenariosService.selectedScenario();
        if (!scenario) return undefined;

        const allInfras = this.infrastructuresService.getInfrasSignalByType(type)();
        const infra = allInfras.find((i: any) => String(i.id) === String(infraId));
        if (!infra) return undefined;

        const { isUserCreated, ...infraPayload } = infra as any;
        return { scenario: scenario, infra_payload: infraPayload };
    }

    launchSimulationSingleInfra(type: string, infraId: number) {
        const url = `${environment.apiUrl}/production/${type}`;
        const payload = this.getInfraScenarioPayload(type, infraId);
        if (!payload) return;
        return this.http.post(url, payload);
    }

    getInfraCost(type: string, infraId: number) {
        const url = `${environment.apiUrl}/cout/${type}`;
        const payload = this.getInfraScenarioPayload(type, infraId);
        if (!payload) return;
        return this.http.post(url, payload);
    }

    getInfraEmission(type: string, infraId: number) {
        const url = `${environment.apiUrl}/emission/${type}`;
        const payload = this.getInfraScenarioPayload(type, infraId);
        if (!payload) return;
        return this.http.post(url, payload);
    }

    async launchSimulation() {
        const scenario = this.scenariosService.selectedScenario();
        const infraGroup = this.infrastructuresService.selectedInfraGroup();

        if (!scenario || !infraGroup) return;

        const steps = [
            this.simulationCostGraphService,
            this.simulationCo2GraphService,
            this.demandeSankeyGraphService,
            this.simulationTemporalGraphService,
        ];

        await this.simulationStepService.runSteps(steps, scenario);

        // Compute post-temporal graphs now that simulation data is available
        const simResult = this.simulationTemporalGraphService.getCachedSimulationResult();
        if (simResult) {
            this.simulationCostGraphService.updateRentabiliteFromSimulation(simResult);
            this.simulationAnalysisGraphService.update(simResult);
        }

        this.productionNodes.set(this.simulationTemporalGraphService.getProductionNodes());
    }

    hasExportableData(): boolean {
        return (
            !!this.simulationTemporalGraphService.getCachedSimulationResult() ||
            !!this.simulationTemporalGraphService.getCachedDemandeResult()
        );
    }

    exportSimulationToCSV(): void {
        const simulationResult = this.simulationTemporalGraphService.getCachedSimulationResult();
        const demandeResult = this.simulationTemporalGraphService.getCachedDemandeResult();

        if (!simulationResult && !demandeResult) {
            console.warn('No simulation data available to export');
            return;
        }

        const headers = [
            'Date',
            'Demande (MW)',
            'Production Totale (MW)',
            'Éolien (MW)',
            'Solaire (MW)',
            'Hydro Fil (MW)',
            'Hydro Réservoir (MW)',
            'Importations (MW)',
            'Nucléaire (MW)',
            'Thermique (MW)',
        ];
        const rows: string[] = [headers.join(',')];

        if (simulationResult?.production) {
            const demandeData = demandeResult?.total_electricity || {};
            simulationResult.production.forEach((instance: any) => {
                const date = instance['snapshot'];
                const demande = demandeData[date] ? (demandeData[date] / 1000).toFixed(2) : '';
                rows.push(
                    [
                        date,
                        demande,
                        instance['totale']?.toFixed(2) || '',
                        instance['total_eolien']?.toFixed(2) || '',
                        instance['total_solaire']?.toFixed(2) || '',
                        instance['total_hydro_fil']?.toFixed(2) || '',
                        instance['total_hydro_reservoir']?.toFixed(2) || '',
                        instance['total_import']?.toFixed(2) || '',
                        instance['total_nucleaire']?.toFixed(2) || '',
                        instance['total_thermique']?.toFixed(2) || '',
                    ].join(','),
                );
            });
        } else if (demandeResult) {
            const demandeData = demandeResult.total_electricity;
            Object.keys(demandeData).forEach((date: string) => {
                rows.push(
                    [
                        date,
                        (demandeData[date] / 1000).toFixed(2),
                        '',
                        '',
                        '',
                        '',
                        '',
                        '',
                        '',
                        '',
                    ].join(','),
                );
            });
        }

        const csvContent = rows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        const scenarioName = this.scenariosService.selectedScenario()?.nom || 'simulation';
        const filename = `simulation_${scenarioName}_${new Date().toISOString().split('T')[0]}.csv`;
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}
