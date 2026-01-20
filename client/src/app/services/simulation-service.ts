import { Injectable } from '@angular/core';
import { computed } from '@angular/core';
import { ScenariosService } from './scenarios-service';
import { InfrastruturesService } from './infrastrutures-service';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';

@Injectable({
  providedIn: 'root',
})
export class SimulationService {

  constructor(
    private scenariosService: ScenariosService,
    private infrastructuresService: InfrastruturesService,
    private http: HttpClient
  ) { }

  canLaunch = computed(() => this.infrastructuresService.selectedInfraGroup() !== null && this.scenariosService.selectedScenario() !== null);

  launchSimulationSingleInfra(type: string, infraId: number) {
    const scenario = this.scenariosService.selectedScenario();
    if (!scenario) return;

    const url = `${environment.apiUrl}/${type}/${infraId}/production?scenario_id=${scenario.id}`;
    return this.http.post(url, {});
  }
}
