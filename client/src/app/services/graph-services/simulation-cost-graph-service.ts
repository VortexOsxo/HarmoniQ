import { Injectable, signal } from '@angular/core';
import { Scenario } from '@app/models/scenario';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import { firstValueFrom } from 'rxjs';
import { InfrastruturesService } from '../infrastrutures-service';
import { SimulationStep } from '@app/models/interfaces/simulation-step';
import * as Plotly from 'plotly.js-dist-min';
import { graphServiceConfig } from '../graph-service';
import { INFRA_COLORS } from '@app/data/infra-colors.data';
import { attachCustomLegend } from './donut-legend.util';

const SEGMENTS = [
    { key: 'eolienneparc', label: 'Éolien', color: INFRA_COLORS['eolienneparc'] },
    { key: 'solaire', label: 'Solaire', color: INFRA_COLORS['solaire'] },
    { key: 'hydro_fil', label: "Hydro (fil de l'eau)", color: INFRA_COLORS['hydro_fil'] },
    { key: 'hydro_res', label: 'Hydro (réservoir)', color: INFRA_COLORS['hydro_reservoir'] },
    { key: 'nucleaire', label: 'Nucléaire', color: INFRA_COLORS['nucleaire'] },
    { key: 'thermique', label: 'Thermique', color: INFRA_COLORS['thermique'] },
];

const PROD_KEY_TO_SEGMENT: [string, string][] = [
    ['total_eolien', 'eolienneparc'],
    ['total_solaire', 'solaire'],
    ['total_hydro_fil', 'hydro_fil'],
    ['total_hydro_reservoir', 'hydro_res'],
    ['total_nucleaire', 'nucleaire'],
    ['total_thermique', 'thermique'],
];

const API_INFRA_DEFS = [
    { apiKey: 'eolienneparc', infraType: 'eolienneparc' },
    { apiKey: 'solaire', infraType: 'solaire' },
    { apiKey: 'nucleaire', infraType: 'nucleaire' },
    { apiKey: 'thermique', infraType: 'thermique' },
    { apiKey: 'hydro', infraType: 'hydro' },
];

@Injectable({
    providedIn: 'root',
})
export class SimulationCostGraphService implements SimulationStep {
    public cachedScenarioId?: number;
    public cachedData: any;
    public costMode: 'annuel' | 'construction' = 'annuel';
    public isLoading = signal(true);
    public rentabiliteLoading = signal(true);
    public rentabiliteFromSimulation?: Record<string, number>; // annual MWh per segment

    constructor(
        private infrastructuresService: InfrastruturesService,
        private http: HttpClient,
    ) { }

    getStepName(): string {
        return 'Simulation du cout du reseau';
    }

    async generate(scenario: Scenario) {
        const url = `${environment.apiUrl}/reseau/cout`;

        const payload = {
            scenario: scenario,
            infra_group: this.infrastructuresService.buildSimulationPayload(),
        };
        console.log("cout", payload);

        if (scenario.id != this.cachedScenarioId) {
            this.cachedScenarioId = scenario.id;
            this.cachedData = await firstValueFrom(this.http.post(url, payload));
        }

        console.log(this.cachedData);

        return this.handleData(this.cachedData);
    }

    public handleData(simulationResult: any) {
        if (!document.getElementById(graphServiceConfig.COST_SIMULATION_ID)) return;

        const isAnnuel = this.costMode === 'annuel';
        const valueKey = isAnnuel ? 'cout_annuel' : 'cout_construction';

        const hydroItems: any[] = simulationResult['hydro'] ?? [];
        const expanded: Record<string, any[]> = {
            ...simulationResult,
            hydro_fil: hydroItems.filter((h: any) => h.type_barrage === "Fil de l'eau"),
            hydro_res: hydroItems.filter((h: any) => h.type_barrage !== "Fil de l'eau"),
        };

        const rawValues = SEGMENTS.map((seg) =>
            (expanded[seg.key] ?? []).reduce(
                (acc: number, item: any) => acc + (item[valueKey] ?? 0),
                0,
            ),
        );
        const totalRaw = rawValues.reduce((a, b) => a + b, 0);

        // Dynamic unit based on total magnitude
        let unit: string;
        let divisor: number;
        if (totalRaw >= 1e9) {
            unit = 'Md$';
            divisor = 1e9;
        } else if (totalRaw >= 1e6) {
            unit = 'M$';
            divisor = 1e6;
        } else if (totalRaw >= 1e3) {
            unit = 'k$';
            divisor = 1e3;
        } else {
            unit = '$';
            divisor = 1;
        }

        const labels = SEGMENTS.map((s) => s.label);
        const values = rawValues.map((v) => v / divisor);
        const colors = SEGMENTS.map((s) => s.color);

        const total = totalRaw / divisor;

        const data: any[] = [
            {
                type: 'pie',
                hole: 0.45,
                labels,
                values,
                marker: { colors },
                domain: { x: [0, 0.6], y: [0, 1] },
                textinfo: 'none',
                title: {
                    text: `<b>${total.toFixed(1)}</b><br>${unit}`,
                    font: { size: 22, color: '#2c3e50' },
                    position: 'middle center',
                },
                hovertemplate: '<b>%{label}</b><br>%{value:.2f} ' + unit + '<extra></extra>',
            },
        ];

        const layout: any = {
            showlegend: false,
            height: Math.floor(window.innerHeight * 0.55),
            margin: { t: 20, b: 20, l: 20, r: 20 },
            paper_bgcolor: 'white',
        };
        const graphDiv = document.getElementById(graphServiceConfig.COST_SIMULATION_ID);
        if (graphDiv) {
            Plotly.newPlot(graphDiv, data, layout, { responsive: true });
            attachCustomLegend(graphDiv, labels, colors);

            (graphDiv as any).on('plotly_relayout', () => {
                const hiddenLabels = (graphDiv as any).layout?.hiddenlabels || [];
                let visibleRaw = 0;
                for (let i = 0; i < labels.length; i++) {
                    if (!hiddenLabels.includes(labels[i])) {
                        visibleRaw += rawValues[i];
                    }
                }
                let currentUnit: string;
                let currentDivisor: number;
                if (visibleRaw >= 1e9) {
                    currentUnit = 'Md$';
                    currentDivisor = 1e9;
                } else if (visibleRaw >= 1e6) {
                    currentUnit = 'M$';
                    currentDivisor = 1e6;
                } else if (visibleRaw >= 1e3) {
                    currentUnit = 'k$';
                    currentDivisor = 1e3;
                } else {
                    currentUnit = '$';
                    currentDivisor = 1;
                }
                const currentTotal = visibleRaw / currentDivisor;
                Plotly.restyle(
                    graphDiv,
                    {
                        'title.text': [`<b>${currentTotal.toFixed(1)}</b><br>${currentUnit}`],
                        values: [rawValues.map((v) => v / currentDivisor)],
                        hovertemplate: [
                            '<b>%{label}</b><br>%{value:.2f} ' + currentUnit + '<extra></extra>',
                        ],
                    } as any,
                    [0],
                );
            });
        }
        this.isLoading.set(false);

        this.handleTop10Graph(simulationResult);
        this.handleRentabiliteGraph(simulationResult);
    }

    public updateRentabiliteFromSimulation(simResult: any) {
        const production: any[] = simResult.production;
        if (!production?.length) return;

        const t0 = new Date(production[0].snapshot).getTime();
        const t1 = new Date(production[1].snapshot).getTime();
        const hoursPerStep = (t1 - t0) / (1000 * 3600);
        const totalHours = production.length * hoursPerStep;
        const annualScale = 8760 / totalHours;

        const result: Record<string, number> = {};
        for (const [prodKey, segKey] of PROD_KEY_TO_SEGMENT) {
            const totalMWh =
                production.reduce((s: number, r: any) => s + (r[prodKey] ?? 0), 0) * hoursPerStep;
            result[segKey] = totalMWh * annualScale;
        }
        this.rentabiliteFromSimulation = result;

        if (this.cachedData) {
            this.handleRentabiliteGraph(this.cachedData);
        }
    }

    private handleRentabiliteGraph(simulationResult: any) {
        if (!document.getElementById(graphServiceConfig.COST_RENTABILITE_ID)) return;

        if (!this.rentabiliteFromSimulation) {
            this.rentabiliteLoading.set(true);
            return;
        }

        const hydroItems: any[] = simulationResult['hydro'] ?? [];
        const expanded: Record<string, any[]> = {
            ...simulationResult,
            hydro_fil: hydroItems.filter((h: any) => h.type_barrage === "Fil de l'eau"),
            hydro_res: hydroItems.filter((h: any) => h.type_barrage !== "Fil de l'eau"),
        };

        const names: string[] = [];
        const values: number[] = [];
        const colors: string[] = [];
        const textLabels: string[] = [];

        for (const seg of SEGMENTS) {
            const totalCost = (expanded[seg.key] ?? []).reduce(
                (acc: number, item: any) => acc + (item['cout_annuel'] ?? 0),
                0,
            );
            const annualMWh = this.rentabiliteFromSimulation![seg.key] ?? 0;

            names.push(seg.label);
            colors.push(seg.color);

            if (totalCost === 0 || annualMWh === 0) {
                values.push(0);
                textLabels.push('n/d');
            } else {
                const kwhPerDollar = (annualMWh * 1000) / totalCost;
                values.push(kwhPerDollar);
                textLabels.push(`${kwhPerDollar.toFixed(2)} kWh/$`);
            }
        }

        const data: any[] = [
            {
                type: 'bar',
                x: names,
                y: values,
                text: textLabels,
                textposition: 'outside',
                marker: { color: colors },
                hovertemplate: '<b>%{x}</b><br>%{text}<extra></extra>',
                cliponaxis: false,
            },
        ];

        const maxVal = Math.max(...values, 0);

        const layout: any = {
            yaxis: {
                title: { text: 'kWh / $', font: { size: 13, color: '#7f8c8d' } },
                gridcolor: '#eee',
                zeroline: false,
                range: [0, maxVal * 1.3],
            },
            xaxis: { tickfont: { size: 13 } },
            height: Math.floor(window.innerHeight * 0.4),
            margin: { t: 40, b: 50, l: 70, r: 20 },
            paper_bgcolor: 'white',
            plot_bgcolor: 'white',
            showlegend: false,
        };

        Plotly.newPlot(graphServiceConfig.COST_RENTABILITE_ID, data, layout, { responsive: true });
        this.rentabiliteLoading.set(false);
    }

    private handleTop10Graph(simulationResult: any) {
        if (!document.getElementById(graphServiceConfig.COST_TOP10_ID)) return;

        const entries: { name: string; cost: number; color: string }[] = [];

        for (const def of API_INFRA_DEFS) {
            const items: any[] = simulationResult[def.apiKey] ?? [];
            const infras: any[] = this.infrastructuresService.getInfrasSignalByType(
                def.infraType,
            )();

            for (const item of items) {
                const infra = infras.find((i: any) => String(i.id) === String(item.id));
                const name = infra?.nom ?? `#${item.id}`;

                let segKey = def.apiKey;
                if (def.infraType === 'hydro' && item.type_barrage) {
                    segKey = item.type_barrage === "Fil de l'eau" ? 'hydro_fil' : 'hydro_res';
                }
                const seg = SEGMENTS.find((s) => s.key === segKey);

                entries.push({ name, cost: item.cout_annuel ?? 0, color: seg?.color ?? '#999' });
            }
        }

        entries.sort((a, b) => b.cost - a.cost);
        const top10 = entries.slice(0, 10).reverse(); // reverse so most expensive renders at top

        const data: any[] = [
            {
                type: 'bar',
                orientation: 'h',
                y: top10.map((e) => e.name),
                x: top10.map((e) => e.cost / 1e6),
                text: top10.map((e) => `${(e.cost / 1e6).toFixed(1)} M$`),
                textposition: 'outside',
                marker: { color: top10.map((e) => e.color) },
                hovertemplate: '<b>%{y}</b><br>%{x:.1f} M$<extra></extra>',
                cliponaxis: false,
            },
        ];

        const maxCost = Math.max(...top10.map((e) => e.cost / 1e6), 0);

        const layout: any = {
            xaxis: {
                title: { text: 'Coût annuel (M$)', font: { size: 13, color: '#7f8c8d' } },
                gridcolor: '#eee',
                range: [0, maxCost * 1.3],
            },
            yaxis: { type: 'category', tickfont: { size: 12 }, automargin: true },
            height: Math.max(250, top10.length * 40 + 80),
            margin: { t: 20, b: 60, l: 20, r: 90 },
            paper_bgcolor: 'white',
            plot_bgcolor: 'white',
            showlegend: false,
        };

        Plotly.newPlot(graphServiceConfig.COST_TOP10_ID, data, layout, { responsive: true });
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
        Plotly.purge(graphServiceConfig.COST_SIMULATION_ID);
        Plotly.purge(graphServiceConfig.COST_RENTABILITE_ID);
        Plotly.purge(graphServiceConfig.COST_TOP10_ID);
    }
}
