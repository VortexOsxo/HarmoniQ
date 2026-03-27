import { Injectable } from '@angular/core';
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

    constructor(private http: HttpClient) { }

    getStepName(): string {
        return 'Generation de la demande temporelle';
    }

    async generate(scenario: Scenario): Promise<void> {
        if (scenario.id != this.cachedScenarioId) {
            this.cachedScenarioId = scenario.id;
            this.cachedData = await firstValueFrom(
                this.http.post(`${environment.apiUrl}/demande/temporal`, scenario)
            );
        }
    }

    clear() { }
}
