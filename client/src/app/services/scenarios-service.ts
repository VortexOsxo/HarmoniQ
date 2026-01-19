import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import { getScenarioFromJson, scenarioToJson } from '@app/models/scenario';
import { map, tap } from 'rxjs/operators';
import { signal } from '@angular/core';
import { Scenario } from '@app/models/scenario';

@Injectable({
  providedIn: 'root',
})
export class ScenariosService {
  scenarios = signal<Scenario[]>([]);
  selectedScenario = signal<Scenario | null>(null);

  constructor(private http: HttpClient) {
    this.refreshScenarios().subscribe();
  }

  refreshScenarios() {
    return this.http.get(environment.apiUrl + '/scenario/', { headers: { 'Content-Type': 'application/json' } })
      .pipe(
        map((data: any) => data.map((scenario: any) => getScenarioFromJson(scenario))),
        tap((scenarios: Scenario[]) => this.scenarios.set(scenarios))
      );
  }

  fetchScenarios() {
    return this.refreshScenarios();
  }

  createScenario(scenario: Scenario) {
    return this.http.post(environment.apiUrl + '/scenario/', scenarioToJson(scenario), { headers: { 'Content-Type': 'application/json' } })
      .pipe(
        map((data: any) => getScenarioFromJson(data)),
        tap((newScenario) => {
          this.scenarios.update(s => [...s, newScenario]);
          this.selectedScenario.set(newScenario);
        })
      );
  }

  deleteScenario(scenario: Scenario) {
    return this.http.delete(environment.apiUrl + '/scenario/' + scenario.id, { headers: { 'Content-Type': 'application/json' } })
      .pipe(
        tap(() => {
          this.scenarios.update(s => s.filter(item => item.id !== scenario.id));
          if (this.selectedScenario()?.id === scenario.id) {
            this.selectedScenario.set(null);
          }
        })
      );
  }
}
