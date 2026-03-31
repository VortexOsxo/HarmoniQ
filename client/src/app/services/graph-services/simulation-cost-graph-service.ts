import { Injectable } from '@angular/core';
import { Scenario } from '@app/models/scenario';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import { firstValueFrom } from 'rxjs';
import { InfrastruturesService } from '../infrastrutures-service';
import { SimulationStep } from '@app/models/interfaces/simulation-step';
import * as Plotly from 'plotly.js-dist-min';
import { graphServiceConfig } from '../graph-service';

const SEGMENTS = [
    { key: 'eolienneparc', label: 'Éolien',           color: '#6abbc4' },
    { key: 'solaire',      label: 'Solaire',           color: '#e8c53c' },
    { key: 'hydro_fil',    label: "Hydro (fil de l'eau)", color: '#7bbfe8' },
    { key: 'hydro_res',    label: 'Hydro (réservoir)', color: '#2b6fa8' },
    { key: 'nucleaire',    label: 'Nucléaire',         color: '#e8754a' },
    { key: 'thermique',    label: 'Thermique',         color: '#e25c5c' },
];

@Injectable({
    providedIn: 'root',
})
export class SimulationCostGraphService implements SimulationStep {
    public cachedScenarioId?: number;
    public cachedData: any;
    public costMode: 'annuel' | 'construction' = 'annuel';

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
            infra_group: this.infrastructuresService.buildSimulationPayload()
        };


        if (scenario.id != this.cachedScenarioId) {
            this.cachedScenarioId = scenario.id;
            this.cachedData = await firstValueFrom(this.http.post(url, payload));
        }

        return this.handleData(this.cachedData);
    }

    public handleData(simulationResult: any) {
        if (!document.getElementById(graphServiceConfig.COST_SIMULATION_ID)) return;

        const isAnnuel = this.costMode === 'annuel';
        const divisor = isAnnuel ? 1e6 : 1e9;
        const unit = isAnnuel ? 'M$' : 'Md$';
        const valueKey = isAnnuel ? 'cout_annuel' : 'cout_construction';

        const hydroItems: any[] = simulationResult['hydro'] ?? [];
        const expanded: Record<string, any[]> = {
            ...simulationResult,
            hydro_fil: hydroItems.filter((h: any) => h.type_barrage === "Fil de l'eau"),
            hydro_res: hydroItems.filter((h: any) => h.type_barrage !== "Fil de l'eau"),
        };

        const labels: string[] = [];
        const values: number[] = [];
        const colors: string[] = [];

        for (const seg of SEGMENTS) {
            const raw = (expanded[seg.key] ?? []).reduce(
                (acc: number, item: any) => acc + (item[valueKey] ?? 0), 0
            );
            labels.push(seg.label);
            values.push(raw / divisor);
            colors.push(seg.color);
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
                text: `<b>${total.toFixed(1)}</b><br>${unit}`,
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

        Plotly.newPlot(graphServiceConfig.COST_SIMULATION_ID, data, layout);
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
    }
}
