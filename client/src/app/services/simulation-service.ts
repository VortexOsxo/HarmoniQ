import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { ScenariosService } from './scenarios-service';
import { InfrastruturesService } from './infrastrutures-service';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import { Subject } from 'rxjs';
import { ProductionNode } from '@app/components/scenario/scenario-demand-prod-sankey/sankey-data.types';
import { DemandeTemporalGraphService } from './graph-services/demande-temporal-graph-service';
import { DemandeSankeyGraphService } from './graph-services/demande-sankey-graph-service';
import { SimulationTemporalGraphService } from './graph-services/simulation-temporal-graph-service';
import { SimulationStepService } from './simulation-step-service';

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
        private demandeTemporalGraphService: DemandeTemporalGraphService,
        private demandeSankeyGraphService: DemandeSankeyGraphService,
        private simulationTemporalGraphService: SimulationTemporalGraphService,
    ) {
        effect(() => {
            this.scenariosService.selectedScenario(); // track scenario changes
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
            this.demandeSankeyGraphService,
            this.demandeTemporalGraphService,
            this.simulationTemporalGraphService,
        ];

        await this.simulationStepService.runSteps(steps, scenario);
        this.productionNodes.set(this.simulationTemporalGraphService.getProductionNodes());
    }

    hasExportableData(): boolean {
        return false;
    }

    exportSimulationToCSV(): void {
        console.warn('No simulation data available to export');
    }
}
