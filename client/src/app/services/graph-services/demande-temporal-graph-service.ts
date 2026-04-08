import { Injectable, signal } from '@angular/core';
import { ScenariosService } from '../scenarios-service';
import { Scenario } from '@app/models/scenario';
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

    peakDemandMW = signal<number | null>(null);
    totalDemandEnergyTWh = signal<number | null>(null);

    constructor(
        private scenariosService: ScenariosService,
        private http: HttpClient,
    ) {}

    getStepName(): string {
        return 'Generation de la demande temporelle';
    }

    async generate(scenario: Scenario): Promise<void> {
        if (scenario.id != this.cachedScenarioId) {
            this.cachedScenarioId = scenario.id;
            this.cachedData = await firstValueFrom(
                this.http.post(`${environment.apiUrl}/demande/temporal`, scenario),
            );
        }

        if (this.cachedData && this.cachedData.total_electricity) {
            const yval = Object.values(this.cachedData.total_electricity).map(
                (value: any) => value / 1000,
            );
            this.peakDemandMW.set(Math.round(Math.max(...yval)));
            const rawKw = Object.values(this.cachedData.total_electricity) as number[];
            this.totalDemandEnergyTWh.set(
                Math.round((rawKw.reduce((s, v) => s + v, 0) / 1e9) * 10) / 10,
            );
        }
    }
}
