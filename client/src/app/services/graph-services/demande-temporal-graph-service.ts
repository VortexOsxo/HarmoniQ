import { Injectable } from '@angular/core';
import { ScenariosService } from '../scenarios-service';
import * as Plotly from 'plotly.js-dist-min';
import { Scenario } from '@app/models/scenario';
import { graphServiceConfig, GraphService } from '@app/services/graph-service';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import { firstValueFrom } from 'rxjs';
import { SimulationStep } from '@app/models/interfaces/simulation-step';

@Injectable({
    providedIn: 'root',
})
export class DemandeTemporalGraphService implements SimulationStep {
    public cachedData: any;
    private cachedScenarioId?: number;

    constructor(
        private scenariosService: ScenariosService,
        private graphService: GraphService,
        private http: HttpClient,
    ) { }

    getStepName(): string {
        return 'Generation de la demande temporelle';
    }

    async generate(scenario: Scenario): Promise<any> {
        if (scenario.id != this.cachedScenarioId) {
            this.cachedScenarioId = scenario.id;
            this.cachedData = await firstValueFrom(this.http.post(`${environment.apiUrl}/demande/temporal`, scenario));
        }
        return this.handleData(this.cachedData);
    }

    public handleData(apidata: any, granularity: string = 'original') {
        if (!document.getElementById(graphServiceConfig.TEMPORAL_DEMANDE_PRODUCTION_ID)) return;

        let xval = Object.keys(apidata.total_electricity);
        let yval = Object.values(apidata.total_electricity).map((value: any) => value / 1000);

        if (granularity !== 'original') {
            const aggregated = this.graphService.aggregateData(xval, yval, granularity);
            xval = aggregated.x;
            yval = aggregated.y;
        }

        const trace = this.graphService.getStandardTrace(
            'Demande Totale',
            xval,
            yval,
            '#2c3e50',
            "<b>%{y:.2f} MW</b><extra></extra>"
        );

        const layout = this.graphService.getStandardLayout(
            'Demande Électrique Totale',
            'Demande (MW)',
            granularity,
            { margin: { t: 80 }, height: Math.floor(window.innerHeight * 0.65) }
        );

        Plotly.newPlot(graphServiceConfig.TEMPORAL_DEMANDE_PRODUCTION_ID, [trace], layout as any, { responsive: true });
    }

    clear() {
        Plotly.purge(graphServiceConfig.TEMPORAL_DEMANDE_PRODUCTION_ID);
    }
}
