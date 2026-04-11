import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import { Scenario } from '@app/models/scenario';
import { firstValueFrom } from 'rxjs';
import { SimulationStep } from '@app/models/interfaces/simulation-step';
import { DemandNode, EnergyTypeNode } from '@app/components/scenario/scenario-demand-prod-sankey/sankey-data.types';

const COMMERCIAL_SECTORS = ['MediumOffice', 'RetailStandalone', 'QuickServiceRestaurant', 'SecondarySchool', 'HOSPITAL'];

@Injectable({
    providedIn: 'root',
})
export class DemandeSankeyGraphService implements SimulationStep {
    private cachedData: any;
    private cachedScenarioId?: number;

    demandNodes = signal<DemandNode[] | null>(null);
    energyTypeNodes = signal<EnergyTypeNode[] | null>(null);
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
        const gazValues: number[] = Object.values(apidata.total_gaz);

        const elecMap = new Map<string, number>();
        const gazMap = new Map<string, number>();
        sectorLabels.forEach((s, i) => {
            elecMap.set(s, (elecMap.get(s) ?? 0) + electricityValues[i]);
            gazMap.set(s, (gazMap.get(s) ?? 0) + gazValues[i]);
        });

        // DB stores values in kW. Sum over all hours → total kWh. Divide by hours and 1000 → average MW.
        const hours = (new Date(scenario.date_de_fin).getTime() - new Date(scenario.date_de_debut).getTime()) / 3_600_000;
        const toMW = (kwhTotal: number) => Math.round(kwhTotal / hours / 1000);

        const commercialElec = COMMERCIAL_SECTORS.reduce((sum, s) => sum + (elecMap.get(s) ?? 0), 0);
        const commercialGaz  = COMMERCIAL_SECTORS.reduce((sum, s) => sum + (gazMap.get(s) ?? 0), 0);

        const nodes: DemandNode[] = [
            {
                id: 'residentiel',
                label: 'Résidentiel',
                electricityValue: toMW(elecMap.get('Résidentiel') ?? 0),
                gasValue:         toMW(gazMap.get('Résidentiel') ?? 0),
                get value() { return this.electricityValue + this.gasValue; },
                color: '#5aaa6f',
                icon: 'fa-house',
            },
            {
                id: 'commercial',
                label: 'Commercial & Institutionnel',
                electricityValue: toMW(commercialElec),
                gasValue:         toMW(commercialGaz),
                get value() { return this.electricityValue + this.gasValue; },
                color: '#5c9fd6',
                icon: 'fa-building',
            },
            {
                id: 'industrie',
                label: 'Industrie',
                electricityValue: 0,
                gasValue:         0,
                value:            0,
                color: '#9c6bb5',
                icon: 'fa-industry',
            },
            {
                id: 'autres',
                label: 'Autres',
                electricityValue: toMW(elecMap.get('AUTRES') ?? 0),
                gasValue:         toMW(gazMap.get('AUTRES') ?? 0),
                get value() { return this.electricityValue + this.gasValue; },
                color: '#e8a93c',
                icon: 'fa-triangle-exclamation',
            },
        ];

        const totalElec = nodes.reduce((s, n) => s + n.electricityValue, 0);
        const totalGaz  = nodes.reduce((s, n) => s + n.gasValue, 0);

        this.demandNodes.set(nodes);
        this.energyTypeNodes.set([
            { id: 'electricity', label: 'Électricité',     value: totalElec, color: '#3a7abf', icon: 'fa-bolt' },
            { id: 'gas',         label: 'Énergie Fossile', value: totalGaz,  color: '#b05c1a', icon: 'fa-fire', co2FactorKgMWh: 50 },
        ]);
        this.tempShouldShowSignal.set(true);
    }

    clear() { }
}
