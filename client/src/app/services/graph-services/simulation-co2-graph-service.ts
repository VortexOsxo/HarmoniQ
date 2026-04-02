import { Injectable, signal } from '@angular/core';
import { Scenario } from '@app/models/scenario';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import { firstValueFrom } from 'rxjs';
import { InfrastruturesService } from '../infrastrutures-service';
import { SimulationStep } from '@app/models/interfaces/simulation-step';
import * as Plotly from 'plotly.js-dist-min';
import { graphServiceConfig } from '../graph-service';
import { SimulationTemporalGraphService } from './simulation-temporal-graph-service';

const SEGMENTS = [
    { key: 'eolienneparc', label: 'Éolien',              color: '#6abbc4' },
    { key: 'solaire',      label: 'Solaire',              color: '#e8c53c' },
    { key: 'hydro_fil',    label: "Hydro (fil de l'eau)", color: '#7bbfe8' },
    { key: 'hydro_res',    label: 'Hydro (réservoir)',    color: '#2b6fa8' },
    { key: 'nucleaire',    label: 'Nucléaire',            color: '#e8754a' },
    { key: 'thermique',    label: 'Thermique',            color: '#e25c5c' },
    { key: 'import',       label: 'Importations',         color: '#a29bfe' },
];

// tCO2/MWh for each production key in simulation result
const CO2_INTENSITY: Record<string, number> = {
    total_eolien:           0,
    total_solaire:          0,
    total_hydro_fil:        8    / 1000,
    total_hydro_reservoir:  20   / 1000,
    total_nucleaire:        9    / 1000,
    total_thermique:        1.2  / 1000,
    total_import:           200  / 1000,
};

// Map simulation production key → segment key
const PROD_KEY_TO_SEGMENT: [string, string][] = [
    ['total_eolien',          'eolienneparc'],
    ['total_solaire',         'solaire'],
    ['total_hydro_fil',       'hydro_fil'],
    ['total_hydro_reservoir', 'hydro_res'],
    ['total_nucleaire',       'nucleaire'],
    ['total_thermique',       'thermique'],
    ['total_import',          'import'],
];

@Injectable({
    providedIn: 'root',
})
export class SimulationCo2GraphService implements SimulationStep {
    public cachedScenarioId?: number;
    public cachedData: any;            // per-infra construction CO2 from API
    public co2AnnuelFromSimulation?: Record<string, number>; // tCO2/year per segment
    public costMode: 'annuel' | 'construction' = 'construction';
    public isLoading = signal(true);

    constructor(
        private infrastructuresService: InfrastruturesService,
        private temporalGraphService: SimulationTemporalGraphService,
        private http: HttpClient,
    ) { }

    getStepName(): string {
        return 'Simulation des emissions du reseau';
    }

    async generate(scenario: Scenario) {
        if (scenario.id != this.cachedScenarioId) {
            this.cachedScenarioId = scenario.id;
            const url = `${environment.apiUrl}/reseau/emission`;
            const payload = {
                scenario: scenario,
                infra_group: this.infrastructuresService.buildSimulationPayload(),
            };
            this.cachedData = await firstValueFrom(this.http.post(url, payload));
        }

        // Always recompute annual CO2 from the current simulation result
        const simResult = this.temporalGraphService.getCachedSimulationResult();
        if (simResult) {
            this.co2AnnuelFromSimulation = this.computeAnnuelFromSimulation(simResult);
        }

        return this.handleData(this.cachedData);
    }

    private computeAnnuelFromSimulation(simResult: any): Record<string, number> {
        const production: any[] = simResult.production;
        if (!production?.length) return {};

        const t0 = new Date(production[0].snapshot).getTime();
        const t1 = new Date(production[1].snapshot).getTime();
        const hoursPerStep = (t1 - t0) / (1000 * 3600);
        const totalHours = production.length * hoursPerStep;
        const annualScale = 8760 / totalHours;

        const result: Record<string, number> = {};
        for (const [prodKey, segKey] of PROD_KEY_TO_SEGMENT) {
            const totalMWh = production.reduce((s: number, r: any) => s + (r[prodKey] ?? 0), 0) * hoursPerStep;
            result[segKey] = totalMWh * (CO2_INTENSITY[prodKey] ?? 0) * annualScale;
        }
        return result;
    }

    public handleData(simulationResult: any) {
        if (!document.getElementById(graphServiceConfig.CO2_SIMULATION_ID)) return;

        const isAnnuel = this.costMode === 'annuel';

        // Annual data not yet available — clear any existing chart and show spinner
        if (isAnnuel && !this.co2AnnuelFromSimulation) {
            Plotly.purge(graphServiceConfig.CO2_SIMULATION_ID);
            this.isLoading.set(true);
            return;
        }

        const unit = 'Mt CO₂';

        const labels: string[] = [];
        const values: number[] = [];
        const colors: string[] = [];

        if (isAnnuel && this.co2AnnuelFromSimulation) {
            for (const seg of SEGMENTS) {
                labels.push(seg.label);
                values.push((this.co2AnnuelFromSimulation[seg.key] ?? 0) / 1e6);
                colors.push(seg.color);
            }
        } else {
            // Construction mode: imports have no construction CO2 — exclude from legend
            const constructionSegments = SEGMENTS.filter(s => s.key !== 'import');
            const hydroItems: any[] = simulationResult['hydro'] ?? [];
            const expanded: Record<string, any[]> = {
                ...simulationResult,
                hydro_fil: hydroItems.filter((h: any) => h.type_barrage === "Fil de l'eau"),
                hydro_res: hydroItems.filter((h: any) => h.type_barrage !== "Fil de l'eau"),
            };

            for (const seg of constructionSegments) {
                const raw = (expanded[seg.key] ?? []).reduce(
                    (acc: number, item: any) => acc + (item['co2_construction'] ?? 0), 0
                );
                labels.push(seg.label);
                values.push(raw / 1e6);
                colors.push(seg.color);
            }
        }

        const total = values.reduce((a, b) => a + b, 0);

        const data: any[] = [{
            type: 'pie',
            hole: 0.45,
            labels,
            values,
            marker: { colors },
            domain: { x: [0, 0.6], y: [0, 1] },
            textinfo: 'none',
            title: {
                text: `<b>${total.toFixed(2)}</b><br>${unit}`,
                font: { size: 22, color: '#2c3e50' },
                position: 'middle center',
            },
            hovertemplate: '<b>%{label}</b><br>%{value:.2f} ' + unit + '<extra></extra>',
        }];

        const layout: any = {
            legend: {
                orientation: 'v',
                x: 0.65, y: 0.5,
                xanchor: 'left', yanchor: 'middle',
                font: { size: 15 },
                itemwidth: 30,
                tracegroupgap: 6,
                itemclick: false,
                itemdoubleclick: false,
            },
            showlegend: true,
            height: Math.floor(window.innerHeight * 0.55),
            margin: { t: 20, b: 20, l: 20, r: 20 },
            paper_bgcolor: 'white',
        };

        Plotly.newPlot(graphServiceConfig.CO2_SIMULATION_ID, data, layout);
        this.isLoading.set(false);
    }

    public updateAnnuelFromSimulation(simResult: any) {
        this.co2AnnuelFromSimulation = this.computeAnnuelFromSimulation(simResult);
        // If user is already on annual tab, render now that data is available
        if (this.costMode === 'annuel' && this.cachedData) {
            this.handleData(this.cachedData);
        }
    }

    public setCostMode(mode: 'annuel' | 'construction') {
        if (this.costMode !== mode) {
            this.costMode = mode;
            if (this.cachedData) {
                this.handleData(this.cachedData);
            }
        }
    }

    clear() {
        Plotly.purge(graphServiceConfig.CO2_SIMULATION_ID);
    }
}
