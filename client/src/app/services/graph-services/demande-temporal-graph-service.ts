import { Injectable, effect, signal } from '@angular/core';
import { ScenariosService } from '../scenarios-service';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import * as Plotly from 'plotly.js-dist-min';
import { Scenario } from '@app/models/scenario';
import { graphServiceConfig } from '@app/services/graph-service';
import { map } from 'rxjs';
import { GraphState } from './demande-sankey-graph-service';
import { DemandeTemporalDataService } from '../data-services/demande-temporal-data-service';

@Injectable({
    providedIn: 'root',
})
export class DemandeTemporalGraphService {

    state = signal(GraphState.Unavailable);
    private cachedData: any;
    private isDisplayed = false;

    constructor(
        private scenariosService: ScenariosService,
        private demandeTemporalDataService: DemandeTemporalDataService,
    ) {
        effect(() => this.onScenarioChanged());
    }

    display() {
        this.isDisplayed = true;
        this.handleGraphState(this.state());
    }

    undisplay() {
        this.isDisplayed = false;
    }

    private onScenarioChanged() {
        const scenario = this.scenariosService.selectedScenario();
        if (!scenario) {
            this.updateGraphState(GraphState.Unavailable);
            return;
        }

        this.updateGraphState(GraphState.Loading);
        this.fetchData(scenario).subscribe(
            () => this.updateGraphState(GraphState.Displayable)
        );
    }

    private updateGraphState(state: GraphState) {
        this.state.set(state);
        if (!this.isDisplayed) return;

        this.handleGraphState(state);
    }

    private handleGraphState(state: GraphState) {
        if (state == GraphState.Loading || state == GraphState.Unavailable)
            this.removeGraph();
        else if (state == GraphState.Displayable)
            this.generateGraph();
    }

    private fetchData(scenario: Scenario) {
        return this.demandeTemporalDataService.fetch(scenario.id)
            .pipe(map(this.handleData.bind(this)));
    }

    private handleData(apidata: any) {
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

    private generateGraph() {
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

    private removeGraph() {
        Plotly.purge(graphServiceConfig.TEMPORAL_DEMANDE_PRODUCTION_ID);
    }
}
