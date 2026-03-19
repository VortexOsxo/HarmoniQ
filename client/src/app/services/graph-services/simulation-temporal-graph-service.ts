import { Injectable } from '@angular/core';
import { ScenariosService } from '../scenarios-service';
import * as Plotly from 'plotly.js-dist-min';
import { Scenario } from '@app/models/scenario';
import { graphServiceConfig } from '@app/services/graph-service';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import { firstValueFrom } from 'rxjs';
import { InfrastruturesService } from '../infrastrutures-service';

@Injectable({
    providedIn: 'root',
})
export class SimulationTemporalGraphService {
    private cachedScenarioId?: number;
    private cachedSimulationResult: any;
    private cachedDemandeResult: any;

    constructor(
        private scenariosService: ScenariosService,
        private infrastructuresService: InfrastruturesService,
        private http: HttpClient,
    ) { }

    display() { }
    undisplay() { }

    async generate(scenario: Scenario) {
        const url = `${environment.apiUrl}/reseau/production?is_journalier=false`;

        const payload = {
            scenario: scenario,
            infra_group: this.infrastructuresService.buildSimulationPayload()
        };


        let simulationResult;
        let demandeResult;
        if (scenario.id != this.cachedScenarioId) {
            this.cachedScenarioId = scenario.id;
            this.cachedSimulationResult = await firstValueFrom(this.http.post(url, payload));
            this.cachedDemandeResult = await firstValueFrom(this.http.post(`${environment.apiUrl}/demande/temporal`, scenario));
        }
        simulationResult = this.cachedSimulationResult;
        demandeResult = this.cachedDemandeResult;


        return this.handleData(simulationResult, demandeResult);
    }

    protected handleData(simulationResult: any, demandeResult: any) {
        const productionData = simulationResult.production;
        let x = productionData.map((instance: any) => (instance["snapshot"]));
        let y = productionData.map((instance: any) => (instance["totale"]));
        let eolien = productionData.map((instance: any) => (instance["total_eolien"]));
        let solaire = productionData.map((instance: any) => (instance["total_solaire"]));
        let hydro_fil = productionData.map((instance: any) => (instance["total_hydro_fil"]));
        let hydro_res = productionData.map((instance: any) => (instance["total_hydro_reservoir"]));
        let imports = productionData.map((instance: any) => (instance["total_import"]));
        let nucleaire = productionData.map((instance: any) => (instance["total_nucleaire"]));
        let thermique = productionData.map((instance: any) => (instance["total_thermique"]));

        let demandeX = Object.keys(demandeResult.total_electricity);
        let demandeY = Object.values(demandeResult.total_electricity).map((value: any) => value / 1000);

        const productionTraces: any = [
            {
                x: demandeX,
                y: demandeY,
                type: 'scatter',
                mode: 'lines',
                name: 'Demande',
                line: { shape: 'spline', color: 'black' },
                hovertemplate: "%{x}<br>%{y:.2f} MW<extra></extra>"
            },
            {
                x: x,
                y: y,
                type: 'scatter',
                mode: 'lines',
                name: 'Production totale',
                line: { shape: 'spline', color: 'green' },
                hovertemplate: "%{x}<br>%{y:.2f} MW<extra></extra>"
            },
            {
                x: x,
                y: eolien,
                type: 'scatter',
                mode: 'lines',
                name: 'Éolien',
                line: { shape: 'spline', color: 'orange' },
                hovertemplate: "%{x}<br>%{y:.2f} MW<extra></extra>"
            },
            {
                x: x,
                y: solaire,
                type: 'scatter',
                mode: 'lines',
                name: 'Solaire',
                line: { shape: 'spline', color: 'yellow' },
                hovertemplate: "%{x}<br>%{y:.2f} MW<extra></extra>"
            },
            {
                x: x,
                y: hydro_fil,
                type: 'scatter',
                mode: 'lines',
                name: 'Hydro (fil)',
                line: { shape: 'spline', color: 'blue' },
                hovertemplate: "%{x}<br>%{y:.2f} MW<extra></extra>"
            },
            {
                x: x,
                y: hydro_res,
                type: 'scatter',
                mode: 'lines',
                name: 'Hydro (réservoir)',
                line: { shape: 'spline', color: 'cyan' },
                hovertemplate: "%{x}<br>%{y:.2f} MW<extra></extra>"
            },
            {
                x: x,
                y: imports,
                type: 'scatter',
                mode: 'lines',
                name: 'Importations',
                line: { shape: 'spline', color: 'purple' },
                hovertemplate: "%{x}<br>%{y:.2f} MW<extra></extra>"
            },
            {
                x: x,
                y: nucleaire,
                type: 'scatter',
                mode: 'lines',
                name: 'Nucléaire',
                line: { shape: 'spline', color: 'red' },
                hovertemplate: "%{x}<br>%{y:.2f} MW<extra></extra>"
            },
            {
                x: x,
                y: thermique,
                type: 'scatter',
                mode: 'lines',
                name: 'Thermique',
                line: { shape: 'spline', color: 'brown' },
                hovertemplate: "%{x}<br>%{y:.2f} MW<extra></extra>"
            }
        ];

        Plotly.newPlot(graphServiceConfig.TEMPORAL_SIMULATION_ID, productionTraces, {
            title: `Production et Demande pour scénario ${this.scenariosService.selectedScenario()?.nom}`,
            height: 800,
            xaxis: {
                title: "Date",
                tickformat: "%d %b %Y"
            },
            yaxis: {
                title: "Puissance (MW)",
                autorange: true
            },
            legend: {
                orientation: "h",
                yanchor: "bottom",
                y: 1.02,
                xanchor: "right",
                x: 1
            }

        } as any);
        return true;
    }

    clear() {
        Plotly.purge(graphServiceConfig.TEMPORAL_SIMULATION_ID);
    }
}
