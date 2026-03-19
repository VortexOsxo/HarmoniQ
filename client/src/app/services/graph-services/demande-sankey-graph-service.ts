import { Injectable, signal } from '@angular/core';
import { ScenariosService } from '../scenarios-service';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import * as Plotly from 'plotly.js-dist-min';
import { Scenario } from '@app/models/scenario';
import { graphServiceConfig } from '@app/services/graph-service';
import { map } from 'rxjs';
import { BaseGraphService } from './base-graph-service';
import { DemandNode } from '@app/components/scenario/scenario-demand-prod-sankey/sankey-data.types';

const COMMERCIAL_SECTORS = ['MediumOffice', 'RetailStandalone', 'QuickServiceRestaurant', 'SecondarySchool', 'HOSPITAL'];

@Injectable({
    providedIn: 'root',
})
export class DemandeSankeyGraphService extends BaseGraphService {

    demandNodes = signal<DemandNode[] | null>(null);

    constructor(
        private scenariosService: ScenariosService,
        private http: HttpClient
    ) {
        super(scenariosService.selectedScenario);
    }

    protected fetchData(scenario: Scenario) {
        const mrc_id = 1; // No idea what it is ngl
        return this.http.post(`${environment.apiUrl}/demande/sankey?CUID=${mrc_id}`, scenario)
            .pipe(map(this.handleData.bind(this)));
    }

    protected handleData(apidata: any) {
        const sectorLabels: string[] = Object.values(apidata.sector);
        const energyLabels = ["Electricity", "Gaz"];
        const allLabels = energyLabels.concat(sectorLabels);

        const electricitySourceIndex = 0;
        const gazSourceIndex = 1;

        const sources = [];
        const targets = [];
        const values = [];

        for (let i = 0; i < sectorLabels.length; i++) {
            const targetIndex = i + energyLabels.length;
            sources.push(electricitySourceIndex);
            targets.push(targetIndex);
            values.push(apidata.total_electricity[i]);
            sources.push(gazSourceIndex);
            targets.push(targetIndex);
            values.push(apidata.total_gaz[i]);
        }

        this.cachedData = [{
            type: "sankey",
            orientation: "h",
            node: { pad: 15, thickness: 20, label: allLabels },
            link: { source: sources, target: targets, value: values }
        }];

        // Build grouped demand nodes
        const electricityValues: number[] = Object.values(apidata.total_electricity);
        const sectorMap = new Map<string, number>();
        sectorLabels.forEach((s, i) => sectorMap.set(s, (sectorMap.get(s) ?? 0) + electricityValues[i]));

        // DB stores electricity in kW. Sum over all hours → total kWh. Divide by hours and 1000 → average MW.
        const scenario = this.scenariosService.selectedScenario();
        const hours = scenario
            ? (new Date(scenario.date_de_fin).getTime() - new Date(scenario.date_de_debut).getTime()) / 3_600_000
            : 8760;

        const toDaily = (kwhTotal: number) => Math.round(kwhTotal / hours / 1000);

        this.demandNodes.set([
            {
                id: 'residentiel',
                label: 'Résidentiel',
                value: toDaily(sectorMap.get('Résidentiel') ?? 0),
                color: '#5aaa6f',
                icon: 'fa-house',
            },
            {
                id: 'commercial',
                label: 'Commercial & Institutionnel',
                value: toDaily(COMMERCIAL_SECTORS.reduce((sum, s) => sum + (sectorMap.get(s) ?? 0), 0)),
                color: '#5c9fd6',
                icon: 'fa-building',
            },
            {
                id: 'industrie',
                label: 'Industrie',
                value: 0,
                color: '#9c6bb5',
                icon: 'fa-industry',
            },
            {
                id: 'autres',
                label: 'Autres',
                value: toDaily(sectorMap.get('AUTRES') ?? 0),
                color: '#e8a93c',
                icon: 'fa-triangle-exclamation',
            },
        ]);
    }

    protected generateGraph() {
        const layout: any = {
            title: "Flux d'énergie vers les secteurs pour scénario " + this.scenariosService.selectedScenario()?.nom,
            font: { size: 10 }
        };

        Plotly.newPlot(graphServiceConfig.SECTOR_ENERGY_CONS_SANKEY_ID, this.cachedData, layout);
    }

    protected removeGraph() {
        Plotly.purge(graphServiceConfig.SECTOR_ENERGY_CONS_SANKEY_ID);
    }
}
