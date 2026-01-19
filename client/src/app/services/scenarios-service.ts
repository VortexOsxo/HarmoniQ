import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import { getScenarioFromJson, scenarioToJson } from '@app/models/scenario';
import { map } from 'rxjs/operators';
import { signal } from '@angular/core';
import { Scenario } from '@app/models/scenario';

@Injectable({
  providedIn: 'root',
})
export class ScenariosService {
  selectedScenario = signal<Scenario | null>(null);

  constructor(private http: HttpClient) { }

  fetchScenarios() {
    return this.http.get(environment.apiUrl + '/scenario/', { headers: { 'Content-Type': 'application/json' } })
      .pipe(map((data: any) => data.map((scenario: any) => getScenarioFromJson(scenario))));
  }

  createScenario(scenario: Scenario) {
    return this.http.post(environment.apiUrl + '/scenario/', scenarioToJson(scenario), { headers: { 'Content-Type': 'application/json' } })
      .pipe(map((data: any) => getScenarioFromJson(data)));
  }
}
