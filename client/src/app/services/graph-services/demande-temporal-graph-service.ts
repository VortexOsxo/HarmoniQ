import { Injectable } from '@angular/core';
import { ScenariosService } from '../scenarios-service';
import * as Plotly from 'plotly.js-dist-min';
import { Scenario } from '@app/models/scenario';
import { graphServiceConfig } from '@app/services/graph-service';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import { firstValueFrom } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class DemandeTemporalGraphService {
    private cachedData: any;
    private cachedScenarioId?: number;

    constructor(
        private scenariosService: ScenariosService,
        private http: HttpClient,
    ) { }

    async generate(scenario: Scenario) {
        if (scenario.id != this.cachedScenarioId) {
            this.cachedScenarioId = scenario.id;
            this.cachedData = await firstValueFrom(this.http.post(`${environment.apiUrl}/demande/temporal`, scenario));
        }
        return this.handleData(this.cachedData);
    }

    protected handleData(apidata: any) {
        const xval = Object.keys(apidata.total_electricity);
        const yval = Object.values(apidata.total_electricity).map((value: any) => value / 1000);

        const graphData = [{
            x: xval,
            y: yval,
            type: 'scatter',
            mode: 'lines',
            marker: { color: 'blue' },
            line: { shape: 'spline' },
            hovertemplate: "%{x}<br>%{y:.2f} MW<extra></extra>"
        }];

        this.generateGraph(graphData);
    }

    private generateGraph(graphData: any) {
        const layout: any = {
            title: "Demande pour scénario " + this.scenariosService.selectedScenario()?.nom,
            height: 800,
            xaxis: {
                title: "Date",
                tickformat: "%d %b %Y"
            },
            yaxis: {
                title: "Demande (MW)",
                autorange: true
            },
            legend: {
                orientation: "h",
                yanchor: "bottom",
                y: 1.02,
                xanchor: "right",
                x: 1
            },
        };

        Plotly.newPlot(graphServiceConfig.TEMPORAL_DEMANDE_PRODUCTION_ID, graphData, layout);
    }

    clear() {
        Plotly.purge(graphServiceConfig.TEMPORAL_DEMANDE_PRODUCTION_ID);
    }
}
