import { Injectable, signal } from '@angular/core';
import { Scenario } from '@app/models/scenario';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import { firstValueFrom } from 'rxjs';
import { InfrastruturesService } from '../infrastrutures-service';
import { SimulationStep } from '@app/models/interfaces/simulation-step';
import * as Plotly from 'plotly.js-dist-min';
import { graphServiceConfig } from '../graph-service';
import { attachCustomLegend } from './donut-legend.util';

const SEGMENTS = [
    { key: 'eolienneparc', label: 'Éolien', color: '#6abbc4' },
    { key: 'solaire', label: 'Solaire', color: '#e8c53c' },
    { key: 'hydro_fil', label: "Hydro (fil de l'eau)", color: '#7bbfe8' },
    { key: 'hydro_res', label: 'Hydro (réservoir)', color: '#2b6fa8' },
    { key: 'nucleaire', label: 'Nucléaire', color: '#e8754a' },
    { key: 'thermique', label: 'Thermique', color: '#e25c5c' },
];

@Injectable({
    providedIn: 'root',
})
export class SimulationCo2GraphService implements SimulationStep {
    public cachedScenarioId?: number;
    public cachedData: any;
    public costMode: 'annuel' | 'construction' = 'construction';
    public isLoading = signal(true);

    constructor(
        private infrastructuresService: InfrastruturesService,
        private http: HttpClient,
    ) {}

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
            console.log("emmission", payload);
            this.cachedData = await firstValueFrom(this.http.post(url, payload));
        }

        return this.handleData(this.cachedData);
    }

    public handleData(simulationResult: any) {
        if (!document.getElementById(graphServiceConfig.CO2_SIMULATION_ID)) return;

        const isAnnuel = this.costMode === 'annuel';
        const co2Key = isAnnuel ? 'co2_annuel' : 'co2_construction';

        const hydroItems: any[] = simulationResult['hydro'] ?? [];
        const expanded: Record<string, any[]> = {
            ...simulationResult,
            hydro_fil: hydroItems.filter((h: any) => h.type_barrage === "Fil de l'eau"),
            hydro_res: hydroItems.filter((h: any) => h.type_barrage !== "Fil de l'eau"),
        };

        const rawValues = SEGMENTS.map((seg) =>
            (expanded[seg.key] ?? []).reduce(
                (acc: number, item: any) => acc + (item[co2Key] ?? 0),
                0,
            ),
        );
        const totalTonnes = rawValues.reduce((a, b) => a + b, 0);

        // Dynamic unit based on total magnitude
        let unit: string;
        let divisor: number;
        if (totalTonnes >= 1e6) {
            unit = 'Mt CO₂';
            divisor = 1e6;
        } else if (totalTonnes >= 1e3) {
            unit = 'kt CO₂';
            divisor = 1e3;
        } else {
            unit = 't CO₂';
            divisor = 1;
        }

        const labels = SEGMENTS.map((s) => s.label);
        const values = rawValues.map((v) => v / divisor);
        const colors = SEGMENTS.map((s) => s.color);
        const total = totalTonnes / divisor;

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
                    text: `<b>${total.toFixed(2)}</b><br>${unit}`,
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

        const graphDiv = document.getElementById(graphServiceConfig.CO2_SIMULATION_ID);
        if (graphDiv) {
            Plotly.newPlot(graphDiv, data, layout);
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
                if (visibleRaw >= 1e6) { currentUnit = 'Mt CO₂'; currentDivisor = 1e6; }
                else if (visibleRaw >= 1e3) { currentUnit = 'kt CO₂'; currentDivisor = 1e3; }
                else { currentUnit = 't CO₂'; currentDivisor = 1; }
                const currentTotal = visibleRaw / currentDivisor;
                Plotly.restyle(graphDiv, {
                    'title.text': [`<b>${currentTotal.toFixed(2)}</b><br>${currentUnit}`],
                    values: [rawValues.map(v => v / currentDivisor)],
                    hovertemplate: ['<b>%{label}</b><br>%{value:.2f} ' + currentUnit + '<extra></extra>'],
                } as any, [0]);
            });
        }
        this.isLoading.set(false);
    }

    /** Returns annual CO₂ (tonnes/year) by Sankey carrier key from the emission API cache. */
    getAnnualCo2ByCarrier(): Record<string, number> {
        if (!this.cachedData) return {};
        const hydroItems: any[] = this.cachedData['hydro'] ?? [];
        const expanded: Record<string, any[]> = {
            ...this.cachedData,
            hydro_fil: hydroItems.filter((h: any) => h.type_barrage === "Fil de l'eau"),
            hydro_res: hydroItems.filter((h: any) => h.type_barrage !== "Fil de l'eau"),
        };
        const result: Record<string, number> = {};
        for (const seg of SEGMENTS) {
            result[seg.key] = (expanded[seg.key] ?? []).reduce(
                (acc: number, item: any) => acc + (item['co2_annuel'] ?? 0), 0,
            );
        }
        return result;
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
