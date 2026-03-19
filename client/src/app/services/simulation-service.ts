import { signal, Injectable, computed, } from '@angular/core';
import { ScenariosService } from './scenarios-service';
import { InfrastruturesService } from './infrastrutures-service';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import { DemandeTemporalGraphService } from './graph-services/demande-temporal-graph-service';
import { DemandeSankeyGraphService } from './graph-services/demande-sankey-graph-service';
import { SimulationTemporalGraphService } from './graph-services/simulation-temporal-graph-service';

@Injectable({
  providedIn: 'root',
})
export class SimulationService {
  canLaunch = computed(() => this.infrastructuresService.selectedInfraGroup() !== null && this.scenariosService.selectedScenario() !== null);
  step = signal<string>('Initialisation');

  constructor(
    private scenariosService: ScenariosService,
    private infrastructuresService: InfrastruturesService,
    private http: HttpClient,
    private demandeTemporalGraphService: DemandeTemporalGraphService,
    private demandeSankeyGraphService: DemandeSankeyGraphService,
    private simulationTemporalGraphService: SimulationTemporalGraphService,
  ) { }

  private getInfraScenarioPayload(type: string, infraId: number) {
    const scenario = this.scenariosService.selectedScenario();
    if (!scenario) return undefined;

    const allInfras = this.infrastructuresService.getInfrasSignalByType(type)();
    const infra = allInfras.find((i: any) => String(i.id) === String(infraId));
    if (!infra) return undefined;

    const { isUserCreated, ...infraPayload } = infra as any;
    return { scenario: scenario, infra_payload: infraPayload };
  }

  launchSimulationSingleInfra(type: string, infraId: number) {
    const url = `${environment.apiUrl}/production/${type}`;
    const payload = this.getInfraScenarioPayload(type, infraId);
    if (!payload) return;

    return this.http.post(url, payload);
  }

  getInfraCost(type: string, infraId: number) {
    const url = `${environment.apiUrl}/cout/${type}`;
    const payload = this.getInfraScenarioPayload(type, infraId);
    if (!payload) return;
    return this.http.post(url, payload);
  }

  async launchSimulation() {
    const scenario = this.scenariosService.selectedScenario();
    const infraGroup = this.infrastructuresService.selectedInfraGroup();

    if (!scenario || !infraGroup) return;

    this.step.set('Generation de la demande des differents secteurs');
    await this.demandeSankeyGraphService.generate(scenario);

    this.step.set('Generation de la demande temporelle');
    await this.demandeTemporalGraphService.generate(scenario);

    this.step.set('Simulation Complete');
    await this.simulationTemporalGraphService.generate(scenario);

    this.step.set('Simulation termine');
  }

  hasExportableData(): boolean {
    const cachedSimulationResult = null;
    const cachedDemandeTemporal = null;
    return false && (cachedSimulationResult !== null || cachedDemandeTemporal !== null);
  }

  exportSimulationToCSV(): void {
    console.warn('No simulation data available to export');
    return;
    const cachedSimulationResult: any = null;
    const cachedDemandeTemporal: any = null;

    const headers = ['Date', 'Demande (MW)', 'Production Totale (MW)', 'Éolien (MW)', 'Solaire (MW)',
      'Hydro Fil (MW)', 'Hydro Réservoir (MW)', 'Importations (MW)', 'Nucléaire (MW)', 'Thermique (MW)'];

    const rows: string[] = [headers.join(',')];

    if (cachedSimulationResult && cachedSimulationResult.production) {
      const productionData = cachedSimulationResult.production;
      const demandeData = cachedDemandeTemporal?.total_electricity || {};

      productionData.forEach((instance: any) => {
        // TODO : we can modify the precision if needed later (talk w meca people)
        const date = instance['snapshot'];
        const demande = demandeData[date] ? (demandeData[date] / 1000).toFixed(2) : '';
        const row = [
          date,
          demande,
          instance['totale']?.toFixed(2) || '',
          instance['total_eolien']?.toFixed(2) || '',
          instance['total_solaire']?.toFixed(2) || '',
          instance['total_hydro_fil']?.toFixed(2) || '',
          instance['total_hydro_reservoir']?.toFixed(2) || '',
          instance['total_import']?.toFixed(2) || '',
          instance['total_nucleaire']?.toFixed(2) || '',
          instance['total_thermique']?.toFixed(2) || ''
        ];
        rows.push(row.join(','));
      });
    } else if (cachedDemandeTemporal) {
      //if no simulation result, we export only the demand data
      const demandeData = cachedDemandeTemporal.total_electricity;
      Object.keys(demandeData).forEach((date: string) => {
        const row = [
          date,
          (demandeData[date] / 1000).toFixed(2),
          '', '', '', '', '', '', '', ''
        ];
        rows.push(row.join(','));
      });
    }

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const scenarioName = this.scenariosService.selectedScenario()?.nom || 'simulation';
    const filename = `simulation_${scenarioName}_${new Date().toISOString().split('T')[0]}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
