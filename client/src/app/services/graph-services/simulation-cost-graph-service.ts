import { Injectable } from '@angular/core';
import { Scenario } from '@app/models/scenario';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import { firstValueFrom } from 'rxjs';
import { InfrastruturesService } from '../infrastrutures-service';
import { SimulationStep } from '@app/models/interfaces/simulation-step';
import * as Plotly from 'plotly.js-dist-min';
import { graphServiceConfig, GraphService } from '../graph-service';
import { INFRA_COLORS } from '@app/data/infra-colors.data';

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
export class SimulationCostGraphService implements SimulationStep {
    public cachedScenarioId?: number;
    public cachedData: any;

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
        const costs: any[] = [];
        const titles: any[] = [];
        const colors: string[] = [];

        for (const key in typeKeyMap) {
            const cost = simulationResult[key].reduce((acc: number, infraCost: any) => acc + infraCost.cout_annuel, 0);
            costs.push(cost);
            titles.push(key);
            colors.push(INFRA_COLORS[key]);
        }

        const data: Partial<Plotly.PlotData>[] = [
            {
                x: titles,
                y: costs,
                type: "bar",
                marker: {
                    color: colors
                }
            }
        ];

        const layout: any = {
            title: {
                text: "<b>Cout des differents types d'infrastructures</b>",
                font: { size: 20, color: '#2c3e50' }
            },
            xaxis: { 
                title: { text: "Type d'Infrastructure", font: { size: 14, color: '#7f8c8d' } }
            },
            yaxis: { 
                title: { text: "Cout annuel", font: { size: 14, color: '#7f8c8d' } }
            },
            height: 800,
            margin: { t: 80, b: 100, l: 100, r: 40 }
        };

        Plotly.newPlot(graphServiceConfig.COST_SIMULATION_ID, data, layout);
    }

    clear() {
        Plotly.purge(graphServiceConfig.COST_SIMULATION_ID);
    }
}
