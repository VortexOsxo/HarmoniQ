import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import { Scenario } from '@app/models/scenario';
import { firstValueFrom } from 'rxjs';
import { SimulationStep } from '@app/models/interfaces/simulation-step';
import { DemandNode } from '@app/components/scenario/scenario-demand-prod-sankey/sankey-data.types';

const COMMERCIAL_SECTORS = ['MediumOffice', 'RetailStandalone', 'QuickServiceRestaurant', 'SecondarySchool', 'HOSPITAL'];

@Injectable({
    providedIn: 'root',
})
export class DemandeSankeyGraphService implements SimulationStep {
    private cachedData: any;
    private cachedScenarioId?: number;

    demandNodes = signal<DemandNode[] | null>(null);
    tempShouldShowSignal = signal(false);

    constructor(private http: HttpClient) { }

    getStepName(): string {
        return 'Generation de la demande des differents secteurs';
    }

    async generate(scenario: Scenario): Promise<void> {
        this.tempShouldShowSignal.set(false);
        const mrc_id = 1;

        if (scenario.id != this.cachedScenarioId) {
            this.cachedScenarioId = scenario.id;
            this.cachedData = await firstValueFrom(
                this.http.post(`${environment.apiUrl}/demande/sankey?CUID=${mrc_id}`, scenario)
            );
        }

        this.handleData(this.cachedData, scenario);
    }

    protected handleData(apidata: any, scenario: Scenario) {
        const sectorLabels: string[] = Object.values(apidata.sector);
        const electricityValues: number[] = Object.values(apidata.total_electricity);
        const sectorMap = new Map<string, number>();
        sectorLabels.forEach((s, i) => sectorMap.set(s, (sectorMap.get(s) ?? 0) + electricityValues[i]));

        // DB stores electricity in kW. Sum over all hours → total kWh. Divide by hours and 1000 → average MW.
        const hours = (new Date(scenario.date_de_fin).getTime() - new Date(scenario.date_de_debut).getTime()) / 3_600_000;
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

        this.tempShouldShowSignal.set(true);
    }

    clear() { }
}
