import { Injectable } from '@angular/core';
import { ScenariosService } from '../scenarios-service';
import * as Plotly from 'plotly.js-dist-min';
import { Scenario } from '@app/models/scenario';
import { graphServiceConfig } from '@app/services/graph-service';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import { firstValueFrom } from 'rxjs';
import { InfrastruturesService } from '../infrastrutures-service';
import { SimulationStep } from '@app/models/interfaces/simulation-step';
import { ProductionNode } from '@app/components/scenario/scenario-demand-prod-sankey/sankey-data.types';

const CARRIER_NODE_DEFS: Record<string, Omit<ProductionNode, 'value'>> = {
    hydro:      { id: 'hydraulique', label: 'Hydraulique',  color: '#4a9dd4', icon: 'fa-droplet',           co2FactorKgMWh: 24  },
    eolien:     { id: 'eolien',      label: 'Éolien',       color: '#6abbc4', icon: 'fa-wind',               co2FactorKgMWh: 12  },
    solaire:    { id: 'solaire',     label: 'Solaire',      color: '#e8c53c', icon: 'fa-sun',                co2FactorKgMWh: 48  },
    thermique:  { id: 'thermique',   label: 'Thermique',    color: '#e25c5c', icon: 'fa-bolt',               co2FactorKgMWh: 820 },
    nucleaire:  { id: 'nucleaire',   label: 'Nucléaire',    color: '#e8754a', icon: 'fa-radiation',          co2FactorKgMWh: 12  },
    import:     { id: 'import',      label: 'Importation',  color: '#a0a0c8', icon: 'fa-right-to-bracket',   co2FactorKgMWh: 200 },
};

@Injectable({
    providedIn: 'root',
})
export class SimulationTemporalGraphService implements SimulationStep {
    private cachedScenarioId?: number;
    private cachedSimulationResult: any;
    private cachedDemandeResult: any;

    constructor(
        private scenariosService: ScenariosService,
        private infrastructuresService: InfrastruturesService,
        private http: HttpClient,
    ) { }

    getStepName(): string {
        return 'Simulation du reseau complet';
    }

    async generate(scenario: Scenario) {
        const url = `${environment.apiUrl}/reseau/production?is_journalier=false`;

        const payload = {
            scenario: scenario,
            infra_group: this.infrastructuresService.buildSimulationPayload()
        };


        if (scenario.id != this.cachedScenarioId) {
            this.cachedScenarioId = scenario.id;
            this.cachedSimulationResult = await firstValueFrom(this.http.post(url, payload));
            this.cachedDemandeResult = await firstValueFrom(this.http.post(`${environment.apiUrl}/demande/temporal`, scenario));
        }

        return this.handleData(this.cachedSimulationResult, this.cachedDemandeResult);
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
    }

    getCachedSimulationResult(): any { return this.cachedSimulationResult; }
    getCachedDemandeResult(): any { return this.cachedDemandeResult; }

    getProductionNodes(): ProductionNode[] {
        if (!this.cachedSimulationResult?.production?.length) return [];
        const data: any[] = this.cachedSimulationResult.production;
        const n = data.length;
        const avg = (key: string) => data.reduce((sum: number, row: any) => sum + (row[key] ?? 0), 0) / n;
        const hydro = avg('total_hydro_reservoir') + avg('total_hydro_fil');
        const carriers: [string, number][] = [
            ['hydro',     hydro],
            ['eolien',    avg('total_eolien')],
            ['solaire',   avg('total_solaire')],
            ['thermique', avg('total_thermique')],
            ['nucleaire', avg('total_nucleaire')],
            ['import',    avg('total_import')],
        ];
        return carriers.map(([carrier, value]) => ({ ...CARRIER_NODE_DEFS[carrier], value: Math.round(value) }));
    }

    clear() {
        Plotly.purge(graphServiceConfig.TEMPORAL_SIMULATION_ID);
    }
}
