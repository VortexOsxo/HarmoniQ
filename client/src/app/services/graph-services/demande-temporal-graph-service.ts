import { Injectable } from '@angular/core';
import { ScenariosService } from '../scenarios-service';
import * as Plotly from 'plotly.js-dist-min';
import { Scenario } from '@app/models/scenario';
import { graphServiceConfig } from '@app/services/graph-service';
import { map } from 'rxjs';
import { DemandeTemporalDataService } from '../data-services/demande-temporal-data-service';
import { BaseGraphService } from './base-graph-service';

@Injectable({
    providedIn: 'root',
})
export class DemandeTemporalGraphService extends BaseGraphService {

    constructor(
        private scenariosService: ScenariosService,
        private demandeTemporalDataService: DemandeTemporalDataService,
    ) {
        super(scenariosService.selectedScenario);
    }

    protected fetchData(scenario: Scenario) {
        return this.demandeTemporalDataService.fetch(scenario.id)
            .pipe(map(this.handleData.bind(this)));
    }

    protected handleData(apidata: any) {
        const xval = Object.keys(apidata.total_electricity);
        const yval = Object.values(apidata.total_electricity).map((value: any) => value / 1000);

        this.cachedData = [{
            x: xval,
            y: yval,
            type: 'scatter',
            mode: 'lines',
            marker: { color: 'blue' },
            line: { shape: 'spline' },
            hovertemplate: "%{x}<br>%{y:.2f} MW<extra></extra>"
        }];
    }

    protected generateGraph() {
        const layout: any = {
            title: "Demande pour scénario " + this.scenariosService.selectedScenario()?.nom,
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

        Plotly.newPlot(graphServiceConfig.TEMPORAL_DEMANDE_PRODUCTION_ID, this.cachedData, layout);
    }

    protected removeGraph() {
        Plotly.purge(graphServiceConfig.TEMPORAL_DEMANDE_PRODUCTION_ID);
    }
}
