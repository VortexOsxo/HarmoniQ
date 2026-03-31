import { Injectable } from '@angular/core';
import { Scenario } from '@app/models/scenario';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import { firstValueFrom } from 'rxjs';
import { InfrastruturesService } from '../infrastrutures-service';
import { SimulationStep } from '@app/models/interfaces/simulation-step';
import * as Plotly from 'plotly.js-dist-min';
import { graphServiceConfig } from '../graph-service';
import { INFRA_COLORS, INFRA_LABELS } from '@app/data/infra-colors.data';

const typeKeyMap: Record<string, string> = {
    'hydro': 'central_hydroelectriques',
    'eolienneparc': 'parc_eoliens',
    'solaire': 'parc_solaires',
    'thermique': 'central_thermique',
    'nucleaire': 'central_nucleaire'
};

@Injectable({
    providedIn: 'root',
})
export class SimulationCo2GraphService implements SimulationStep {
    public cachedScenarioId?: number;
    public cachedData: any;
    public costMode: 'annuel' | 'construction' = 'annuel';

    constructor(
        private infrastructuresService: InfrastruturesService,
        private http: HttpClient,
    ) { }

    getStepName(): string {
        return 'Simulation des emissions du reseau';
    }

    async generate(scenario: Scenario) {
        const url = `${environment.apiUrl}/reseau/emission`;

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
        if (!document.getElementById(graphServiceConfig.CO2_SIMULATION_ID)) return;

        const emissions: any[] = [];
        const titles: any[] = [];
        const colors: string[] = [];

        for (const key in typeKeyMap) {
            const emission = simulationResult[key].reduce((acc: number, infraCost: any) => 
                acc + (this.costMode === 'annuel' ? infraCost.co2_annuel : infraCost.co2_construction), 0);
            emissions.push(emission / 1000000); // En millions de tonnes
            titles.push(INFRA_LABELS[key]);
            colors.push(INFRA_COLORS[key]);
        }

        const data: Partial<Plotly.PlotData>[] = [
            {
                x: titles,
                y: emissions,
                type: "bar",
                marker: {
                    color: colors
                },
                hovertemplate: "<b>%{y:.2f} Mt</b><extra></extra>"
            }
        ];

        const layout: any = {
            title: {
                text: this.costMode === 'annuel' 
                      ? "<b>Emissions annuelles des infrastructures</b>" 
                      : "<b>Emissions de construction des infrastructures</b>",
                font: { size: 20, color: '#2c3e50' }
            },
            xaxis: { 
                title: { text: "Type d'Infrastructure", font: { size: 14, color: '#7f8c8d' } }
            },
            yaxis: { 
                title: { text: this.costMode === 'annuel' ? "CO2 annuel (Mt)" : "CO2 de construction (Mt)", font: { size: 14, color: '#7f8c8d' } }
            },
            height: Math.floor(window.innerHeight * 0.55),
            margin: { t: 80, b: 100, l: 100, r: 40 }
        };

        Plotly.newPlot(graphServiceConfig.CO2_SIMULATION_ID, data, layout);
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
