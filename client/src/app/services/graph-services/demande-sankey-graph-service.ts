import { Injectable, effect, signal } from '@angular/core';
import { ScenariosService } from '../scenarios-service';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import * as Plotly from 'plotly.js-dist-min';
import { Scenario } from '@app/models/scenario';
import { graphServiceConfig } from '@app/services/graph-service';
import { map } from 'rxjs';


export enum GraphState {
    Unavailable,
    Loading,
    Displayable,
}


@Injectable({
    providedIn: 'root',
})
export class DemandeSankeyGraphService {

    state = signal(GraphState.Unavailable);
    private cachedData: any;
    private isDisplayed = false;

    constructor(
        private scenariosService: ScenariosService,
        private http: HttpClient
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
        const mrc_id = 1; // No idea what it is ngl
        return this.http.post(`${environment.apiUrl}/demande/sankey/?scenario_id=${scenario.id}&CUID=${mrc_id}`, {})
            .pipe(map(this.handleData.bind(this)));
    }

    private handleData(apidata: any) {
        const sectorLabels: any = Object.values(apidata.sector);
        const energyLabels = ["Electricity", "Gaz"];
        const allLabels = energyLabels.concat(sectorLabels);

        const electricitySourceIndex = 0; // Electricité
        const gazSourceIndex = 1;         // Gaz

        const sources = [];
        const targets = [];
        const values = [];

        for (let i = 0; i < sectorLabels.length; i++) {
            const targetIndex = i + energyLabels.length;

            // Electricity to sector
            sources.push(electricitySourceIndex);
            targets.push(targetIndex);
            values.push(apidata.total_electricity[i]);

            // Gaz to sector
            sources.push(gazSourceIndex);
            targets.push(targetIndex);
            values.push(apidata.total_gaz[i]);
        }

        this.cachedData = [{
            type: "sankey",
            orientation: "h",
            node: {
                pad: 15,
                thickness: 20,
                label: allLabels
            },
            link: {
                source: sources,
                target: targets,
                value: values
            }
        }];
    }

    private generateGraph() {
        const layout: any = {
            title: "Flux d'énergie vers les secteurs pour scénario " + this.scenariosService.selectedScenario()?.nom,
            font: { size: 10 }
        };

        Plotly.newPlot(graphServiceConfig.SECTOR_ENERGY_CONS_SANKEY_ID, this.cachedData, layout);
    }

    private removeGraph() {
        Plotly.purge(graphServiceConfig.SECTOR_ENERGY_CONS_SANKEY_ID);
    }
}
