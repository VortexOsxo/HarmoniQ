import { Injectable, signal, computed } from '@angular/core';
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

    peakDemandMW = computed(() => {
        const demande = this.cachedDemandeResult();
        if (!demande || !demande.total_electricity) return null;
        let yval = Object.values(demande.total_electricity).map((value: any) => value / 1000);
        return Math.round(Math.max(...yval));
    });

    totalDemandEnergyTWh = computed(() => {
        const demande = this.cachedDemandeResult();
        if (!demande || !demande.total_electricity) return null;
        const rawKw = Object.values(demande.total_electricity) as number[];
        return Math.round(rawKw.reduce((s, v) => s + v, 0) / 1e9 * 10) / 10;
    });

    /**
     * Bilan énergétique sur toute la période de simulation (TWh par source + demande).
     * Peuplé après chaque appel à generate() / handleData().
     * null si la simulation n'a pas encore été lancée.
     */
    energySummaryTWh = signal<{
        demand: number;
        hydro: number;
        wind: number;
        solar: number;
        thermal: number;
        nuclear: number;
        imported: number;
    } | null>(null);

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

        // --- Bilan énergétique (TWh) sur la période complète ---
        // Chaque snapshot est horaire → MW × 1h = MWh → /1e6 = TWh
        const sumMWh = (key: string) =>
            productionData.reduce((s: number, r: any) => s + (r[key] ?? 0), 0);
        const demandKwh = Object.values(demandeResult.total_electricity as Record<string, number>)
            .reduce((s, v) => s + v, 0);
        this.energySummaryTWh.set({
            demand:   Math.round(demandKwh / 1e9 * 10) / 10,
            hydro:    Math.round((sumMWh('total_hydro_reservoir') + sumMWh('total_hydro_fil')) / 1e6 * 10) / 10,
            wind:     Math.round(sumMWh('total_eolien')    / 1e6 * 10) / 10,
            solar:    Math.round(sumMWh('total_solaire')   / 1e6 * 10) / 10,
            thermal:  Math.round(sumMWh('total_thermique') / 1e6 * 10) / 10,
            nuclear:  Math.round(sumMWh('total_nucleaire') / 1e6 * 10) / 10,
            imported: Math.round(sumMWh('total_import')    / 1e6 * 10) / 10,
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

    getProductionNodes(): ProductionNode[] {
        if (!this.cachedSimulationResult?.production?.length) return [];
        const data: any[] = this.cachedSimulationResult.production;
        const n = data.length;
        const avg = (key: string) =>
            data.reduce((sum: number, row: any) => sum + (row[key] ?? 0), 0) / n;

        // tCO2/MWh per simulation production key
        const CO2_INTENSITY: Record<string, number> = {
            total_hydro_fil:       8    / 1000,
            total_hydro_reservoir: 20   / 1000,
            total_eolien:          0,
            total_solaire:         0,
            total_thermique:       1.2  / 1000,
            total_nucleaire:       9    / 1000,
            total_import:          200  / 1000,
        };

        // co2Tph = avg MW × tCO2/MWh = tCO2/h
        const co2Tph: Record<string, number> = {
            hydro_fil:  avg('total_hydro_fil')       * CO2_INTENSITY['total_hydro_fil'],
            hydro_res:  avg('total_hydro_reservoir') * CO2_INTENSITY['total_hydro_reservoir'],
            eolien:     0,
            solaire:    0,
            thermique:  avg('total_thermique')       * CO2_INTENSITY['total_thermique'],
            nucleaire:  avg('total_nucleaire')       * CO2_INTENSITY['total_nucleaire'],
            import:     avg('total_import')          * CO2_INTENSITY['total_import'],
        };

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
            co2Tph: co2Tph[carrier],
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
