import { Injectable } from '@angular/core';
import { Scenario } from '@app/models/scenario';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import { firstValueFrom } from 'rxjs';
import { InfrastruturesService } from '../infrastrutures-service';
import { SimulationStep } from '@app/models/interfaces/simulation-step';


@Injectable({
    providedIn: 'root',
})
export class SimulationCo2GraphService implements SimulationStep {
    public cachedScenarioId?: number;
    public cachedData: any;

    constructor(
        private infrastructuresService: InfrastruturesService,
        private http: HttpClient,
    ) { }

    getStepName(): string {
        return 'Simulation des emissions du reseau';
    }

    async generate(scenario: Scenario) {
        const url = `${environment.apiUrl}/reseau/emission`;

        const payload = {
            scenario: scenario,
            infra_group: this.infrastructuresService.buildSimulationPayload()
        };


        if (scenario.id != this.cachedScenarioId) {
            this.cachedScenarioId = scenario.id;
            this.cachedData = await firstValueFrom(this.http.post(url, payload));
        }

        return this.handleData(this.cachedData);
    }

    public handleData(simulationResult: any) {
        console.log(simulationResult);
    }

    clear() {
    }
}
