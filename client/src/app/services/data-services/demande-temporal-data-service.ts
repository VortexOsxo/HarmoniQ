import { Injectable, } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import { Scenario } from '@app/models/scenario';
import { map, of } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class DemandeTemporalDataService {
    private cachedData: any;
    private cachedScenarioId?: number;

    constructor(private http: HttpClient) { }

    fetch(scenario: Scenario) {
        if (this.cachedData && this.cachedScenarioId == scenario.id) {
            return of(this.cachedData);
        }
        return this.http.post(`${environment.apiUrl}/demande/temporal/`, scenario)
            .pipe(map((data: any) => this.handleData(data, scenario.id)));
    }

    private handleData(apidata: any, scenarioId: number) {
        this.cachedData = apidata;
        this.cachedScenarioId = scenarioId;
        return this.cachedData;
    }
}
