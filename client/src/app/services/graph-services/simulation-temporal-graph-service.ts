import { Injectable, signal } from '@angular/core';
import { ScenariosService } from '../scenarios-service';
import * as Plotly from 'plotly.js-dist-min';
import { Scenario } from '@app/models/scenario';
import { GraphService, graphServiceConfig } from '@app/services/graph-service';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import { firstValueFrom } from 'rxjs';
import { InfrastruturesService } from '../infrastrutures-service';
import { SimulationStep } from '@app/models/interfaces/simulation-step';
import { ProductionNode } from '@app/components/scenario/scenario-demand-prod-sankey/sankey-data.types';
import { INFRA_COLORS, INFRA_LABELS } from '@app/data/infra-colors.data';

const CARRIER_NODE_DEFS: Record<string, Omit<ProductionNode, 'value'>> = {
    hydro_fil: {
        id: 'hydro_fil',
        label: "Hydro (fil de l'eau)",
        color: '#7bbfe8',
        icon: 'fa-droplet',
        co2FactorKgMWh: 8,
    },
    hydro_res: {
        id: 'hydro_res',
        label: 'Hydro (réservoir)',
        color: '#2b6fa8',
        icon: 'fa-droplet',
        co2FactorKgMWh: 20,
    },
    eolien: {
        id: 'eolien',
        label: INFRA_LABELS['eolien'],
        color: INFRA_COLORS['eolien'],
        icon: 'fa-wind',
        co2FactorKgMWh: 12,
    },
    solaire: {
        id: 'solaire',
        label: INFRA_LABELS['solaire'],
        color: INFRA_COLORS['solaire'],
        icon: 'fa-sun',
        co2FactorKgMWh: 48,
    },
    thermique: {
        id: 'thermique',
        label: INFRA_LABELS['thermique'],
        color: INFRA_COLORS['thermique'],
        icon: 'fa-bolt',
        co2FactorKgMWh: 820,
    },
    nucleaire: {
        id: 'nucleaire',
        label: INFRA_LABELS['nucleaire'],
        color: INFRA_COLORS['nucleaire'],
        icon: 'fa-radiation',
        co2FactorKgMWh: 12,
    },
    import: {
        id: 'import',
        label: INFRA_LABELS['import'],
        color: INFRA_COLORS['import'],
        icon: 'fa-right-to-bracket',
        co2FactorKgMWh: 200,
    },
};

@Injectable({
    providedIn: 'root',
})
export class SimulationTemporalGraphService implements SimulationStep {
    public cachedScenarioId?: number;
    public cachedSimulationResult: any;
    public cachedDemandeResult = signal<any>(undefined);

    constructor(
        private scenariosService: ScenariosService,
        private infrastructuresService: InfrastruturesService,
        private graphService: GraphService,
        private http: HttpClient,
    ) {}

    getStepName(): string {
        return 'Simulation du reseau complet';
    }

    async generate(scenario: Scenario) {
        if (scenario.id != this.cachedScenarioId) {
            this.cachedScenarioId = scenario.id;
            this.cachedSimulationResult = undefined;
            this.cachedDemandeResult.set(undefined);

            this.cachedDemandeResult.set(
                await firstValueFrom(
                    this.http.post(`${environment.apiUrl}/demande/temporal`, scenario),
                ),
            );

            const url = `${environment.apiUrl}/reseau/production?is_journalier=false`;
            const payload = {
                scenario: scenario,
                infra_group: this.infrastructuresService.buildSimulationPayload(),
            };
            this.cachedSimulationResult = await firstValueFrom(this.http.post(url, payload));
        }
    }

    public handleData(simulationResult: any, demandeResult: any, granularity: string = 'weekly') {
        if (!document.getElementById(graphServiceConfig.TEMPORAL_SIMULATION_ID)) return;

        const productionData = simulationResult.production;
        let x = productionData.map((instance: any) => instance['snapshot']);

        const components = [
            { key: 'total_eolien', name: INFRA_LABELS['eolien'], color: INFRA_COLORS['eolien'] },
            { key: 'total_solaire', name: INFRA_LABELS['solaire'], color: INFRA_COLORS['solaire'] },
            { key: 'total_hydro_fil', name: 'Hydro (fil de l\'eau)', color: '#7bbfe8' },
            { key: 'total_hydro_reservoir', name: 'Hydro (réservoir)', color: '#2b6fa8' },
            {
                key: 'total_nucleaire',
                name: INFRA_LABELS['nucleaire'],
                color: INFRA_COLORS['nucleaire'],
            },
            {
                key: 'total_thermique',
                name: INFRA_LABELS['thermique'],
                color: INFRA_COLORS['thermique'],
            },
            { key: 'total_import', name: INFRA_LABELS['import'], color: INFRA_COLORS['import'] },
        ];

        let traces: any[] = [];

        components.forEach((comp) => {
            let y = productionData.map((instance: any) => instance[comp.key] || 0);
            let xLocal = x;

            if (granularity !== 'original') {
                const aggregated = this.graphService.aggregateData(x, y, granularity);
                xLocal = aggregated.x;
                y = aggregated.y;
            }

            traces.push({
                x: xLocal,
                y: y,
                type: 'scatter',
                mode: 'none',
                name: comp.name,
                stackgroup: 'one',
                fillcolor: this.graphService.hexToRgba(comp.color, 0.7),
                hovertemplate: `<b>%{y:.2f} MW</b>`,
            });
        });

        // Total production line on top of the stack
        let totalY = productionData.map((instance: any) => instance['totale'] || 0);
        let totalX = x;
        if (granularity !== 'original') {
            const aggregated = this.graphService.aggregateData(x, totalY, granularity);
            totalX = aggregated.x;
            totalY = aggregated.y;
        }
        traces.push({
            x: totalX,
            y: totalY,
            type: 'scatter',
            mode: 'lines',
            name: 'Production Totale',
            line: { color: '#27ae60', width: 2, dash: 'solid' },
            fill: 'none',
            hovertemplate: `<b>%{y:.2f} MW</b>`,
        });

        let demandeX = Object.keys(demandeResult.total_electricity);
        let demandeY = Object.values(demandeResult.total_electricity).map(
            (value: any) => (value as number) / 1000,
        );

        if (granularity !== 'original') {
            const aggregated = this.graphService.aggregateData(demandeX, demandeY, granularity);
            demandeX = aggregated.x;
            demandeY = aggregated.y;
        }

        traces.push({
            x: demandeX,
            y: demandeY,
            type: 'scatter',
            mode: 'lines',
            name: 'Demande',
            line: { color: '#000000', width: 2, dash: 'dot' },
            fill: 'none',
            hovertemplate: `<b>%{y:.2f} MW</b>`,
        });

        const layout = this.graphService.getStandardLayout(
            `Production et Demande (${this.scenariosService.selectedScenario()?.nom})`,
            'Puissance (MW)',
            granularity,
            { height: Math.floor(window.innerHeight * 0.7) },
        );

        Plotly.newPlot(graphServiceConfig.TEMPORAL_SIMULATION_ID, traces, layout as any, {
            responsive: true,
        });
    }

    getCachedSimulationResult(): any {
        return this.cachedSimulationResult;
    }
    getCachedDemandeResult(): any {
        return this.cachedDemandeResult();
    }

    getProductionNodes(co2Data?: any): ProductionNode[] {
        if (!this.cachedSimulationResult?.production?.length) return [];
        const data: any[] = this.cachedSimulationResult.production;
        const n = data.length;
        const avg = (key: string) =>
            data.reduce((sum: number, row: any) => sum + (row[key] ?? 0), 0) / n;

        // Compute real t CO₂/h from backend annual values (co2_annuel is tonnes/year)
        const HOURS_PER_YEAR = 8760;
        const sumCo2Annual = (items: any[]): number =>
            (items ?? []).reduce((s: number, i: any) => s + (i.co2_annuel ?? 0), 0);

        let co2Tph: Record<string, number> = {};
        if (co2Data) {
            const hydroItems: any[] = co2Data['hydro'] ?? [];
            co2Tph = {
                hydro_fil: sumCo2Annual(hydroItems.filter((h: any) => h.type_barrage === "Fil de l'eau")) / HOURS_PER_YEAR,
                hydro_res: sumCo2Annual(hydroItems.filter((h: any) => h.type_barrage !== "Fil de l'eau")) / HOURS_PER_YEAR,
                eolien:    sumCo2Annual(co2Data['eolienneparc']) / HOURS_PER_YEAR,
                solaire:   sumCo2Annual(co2Data['solaire'])      / HOURS_PER_YEAR,
                thermique: sumCo2Annual(co2Data['thermique'])    / HOURS_PER_YEAR,
                nucleaire: sumCo2Annual(co2Data['nucleaire'])    / HOURS_PER_YEAR,
                // import has no backend CO2 data — fallback to factor
            };
        }

        const carriers: [string, number][] = [
            ['hydro_fil', avg('total_hydro_fil')],
            ['hydro_res', avg('total_hydro_reservoir')],
            ['eolien', avg('total_eolien')],
            ['solaire', avg('total_solaire')],
            ['thermique', avg('total_thermique')],
            ['nucleaire', avg('total_nucleaire')],
            ['import', avg('total_import')],
        ];
        return carriers.map(([carrier, value]) => ({
            ...CARRIER_NODE_DEFS[carrier],
            value: Math.round(value),
            ...(co2Data ? { co2Tph: co2Tph[carrier] } : {}),
        }));
    }

    renderDemandPreview(demandeResult: any, granularity: string = 'weekly') {
        if (!document.getElementById(graphServiceConfig.TEMPORAL_SIMULATION_ID)) return;

        let demandeX = Object.keys(demandeResult.total_electricity);
        let demandeY = Object.values(demandeResult.total_electricity).map(
            (value: any) => (value as number) / 1000,
        );

        if (granularity !== 'original') {
            const aggregated = this.graphService.aggregateData(demandeX, demandeY, granularity);
            demandeX = aggregated.x;
            demandeY = aggregated.y;
        }

        const demandTrace = {
            ...this.graphService.getStandardTrace(
                'Demande',
                demandeX,
                demandeY,
                '#2c3e50',
                `<b>%{y:.2f} MW</b>`,
            ),
            line: { shape: 'spline', color: '#2c3e50', width: 2 },
            fill: 'none',
        };

        const layout = this.graphService.getStandardLayout(
            `Demande (${this.scenariosService.selectedScenario()?.nom})`,
            'Puissance (MW)',
            granularity,
            { height: Math.floor(window.innerHeight * 0.7) },
        );

        Plotly.newPlot(graphServiceConfig.TEMPORAL_SIMULATION_ID, [demandTrace], layout as any, {
            responsive: true,
        });
    }

    clear() {
        Plotly.purge(graphServiceConfig.TEMPORAL_SIMULATION_ID);
    }
}
