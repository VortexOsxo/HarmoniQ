import { Injectable } from '@angular/core';
import { ScenariosService } from '../scenarios-service';
import * as Plotly from 'plotly.js-dist-min';
import { Scenario } from '@app/models/scenario';
import { GraphService, graphServiceConfig } from '@app/services/graph-service';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import { firstValueFrom } from 'rxjs';
import { InfrastruturesService } from '../infrastrutures-service';
import { SimulationStep } from '@app/models/interfaces/simulation-step';

@Injectable({
    providedIn: 'root',
})
export class SimulationTemporalGraphService implements SimulationStep {
    public cachedScenarioId?: number;
    public cachedSimulationResult: any;
    public cachedDemandeResult: any;

    constructor(
        private scenariosService: ScenariosService,
        private infrastructuresService: InfrastruturesService,
        private graphService: GraphService,
        private http: HttpClient,
    ) { }

    getStepName(): string {
        return 'Simulation du reseau complet';
    }

    async generate(scenario: Scenario) {
        const url = `${environment.apiUrl}/reseau/production?is_journalier=false`;

        const payload = {
            scenario: scenario,
            infra_group: this.infrastructuresService.buildSimulationPayload()
        };


        if (scenario.id != this.cachedScenarioId) {
            this.cachedScenarioId = scenario.id;
            this.cachedSimulationResult = await firstValueFrom(this.http.post(url, payload));
            this.cachedDemandeResult = await firstValueFrom(this.http.post(`${environment.apiUrl}/demande/temporal`, scenario));
        }

        return this.handleData(this.cachedSimulationResult, this.cachedDemandeResult);
    }

    public handleData(simulationResult: any, demandeResult: any, granularity: string = 'original') {
        const productionData = simulationResult.production;
        let x = productionData.map((instance: any) => (instance["snapshot"]));

        const components = [
            { key: 'total_eolien', name: 'Éolien', color: '#f39c12' },
            { key: 'total_solaire', name: 'Solaire', color: '#f1c40f' },
            { key: 'total_hydro_fil', name: 'Hydro (fil)', color: '#3498db' },
            { key: 'total_hydro_reservoir', name: 'Hydro (réservoir)', color: '#1abc9c' },
            { key: 'total_nucleaire', name: 'Nucléaire', color: '#e74c3c' },
            { key: 'total_thermique', name: 'Thermique', color: '#95a5a6' },
            { key: 'total_import', name: 'Importations', color: '#9b59b6' }
        ];

        let traces: any[] = [];

        components.forEach(comp => {
            let y = productionData.map((instance: any) => instance[comp.key] || 0);
            let xLocal = x;

            if (granularity !== 'original') {
                const aggregated = this.graphService.aggregateData(x, y, granularity);
                xLocal = aggregated.x;
                y = aggregated.y;
            }

            const trace = this.graphService.getStandardTrace(comp.name, xLocal, y, comp.color, `<b>%{y:.2f} MW</b>`);
            traces.push({
                ...trace,
                line: { ...trace.line, width: 2 },
                fill: 'none'
            });
        });

        let demandeX = Object.keys(demandeResult.total_electricity);
        let demandeY = Object.values(demandeResult.total_electricity).map((value: any) => (value as number) / 1000);

        if (granularity !== 'original') {
            const aggregated = this.graphService.aggregateData(demandeX, demandeY, granularity);
            demandeX = aggregated.x;
            demandeY = aggregated.y;
        }

        const demandTrace = this.graphService.getStandardTrace('Demande', demandeX, demandeY, '#2c3e50', `<b>%{y:.2f} MW</b>`);
        traces.push({
            ...demandTrace,
            line: { shape: 'spline', color: '#2c3e50', width: 2 },
            fill: 'none'
        });

        let totalY = productionData.map((instance: any) => instance["totale"] || 0);
        let totalX = x;
        if (granularity !== 'original') {
            const aggregated = this.graphService.aggregateData(x, totalY, granularity);
            totalX = aggregated.x;
            totalY = aggregated.y;
        }
        traces.push({
            ...this.graphService.getStandardTrace('Production Totale', totalX, totalY, '#27ae60', `<b>%{y:.2f} MW</b>`),
            line: { shape: 'spline', color: '#27ae60', width: 2 },
            fill: 'none'
        });

        const layout = this.graphService.getStandardLayout(
            `Production et Demande (${this.scenariosService.selectedScenario()?.nom})`,
            'Puissance (MW)',
            granularity,
            { height: 800 }
        );

        Plotly.newPlot(graphServiceConfig.TEMPORAL_SIMULATION_ID, traces, layout as any, { responsive: true });
    }

    clear() {
        Plotly.purge(graphServiceConfig.TEMPORAL_SIMULATION_ID);
    }
}
