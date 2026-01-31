import { EventEmitter, Injectable, computed } from '@angular/core';
import { ScenariosService } from './scenarios-service';
import { InfrastruturesService } from './infrastrutures-service';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import * as Plotly from 'plotly.js-dist-min';
import { graphServiceConfig } from '@app/services/graph-service';
import { DemandeTemporalDataService } from './data-services/demande-temporal-data-service';

@Injectable({
  providedIn: 'root',
})
export class SimulationService {
  canLaunch = computed(() => this.infrastructuresService.selectedInfraGroup() !== null && this.scenariosService.selectedScenario() !== null);

  simulationResultsReceived = new EventEmitter<void>();

  private cachedSimulationResult: any = null;
  private cachedDemandeTemporal: any = null;

  constructor(
    private scenariosService: ScenariosService,
    private infrastructuresService: InfrastruturesService,
    private demandeTemporalDataService: DemandeTemporalDataService,
    private http: HttpClient
  ) { }

  launchSimulationSingleInfra(type: string, infraId: number) {
    const scenario = this.scenariosService.selectedScenario();
    if (!scenario) return;

    const url = `${environment.apiUrl}/${type}/${infraId}/production?scenario_id=${scenario.id}`;
    return this.http.post(url, {});
  }

  hasSimulationResults() {
    return !!this.cachedSimulationResult;
  }

  launchSimulation() {
    const scenario = this.scenariosService.selectedScenario();
    const infraGroup = this.infrastructuresService.selectedInfraGroup();

    if (!scenario || !infraGroup) return;

    this.demandeTemporalDataService.fetch(scenario.id).subscribe((data: any) => {
      this.cachedDemandeTemporal = data;
    })

    const url = `${environment.apiUrl}/reseau/production/?scenario_id=${scenario.id}&liste_infra_id=${infraGroup.id}&is_journalier=false`;

    this.http.post(url, {}).subscribe((data: any) => {
      this.cachedSimulationResult = data;
      this.simulationResultsReceived.emit();
    });
  }

  generateSimulationDemandeGraph() {
    if (!this.cachedSimulationResult) return false;

    const productionData = this.cachedSimulationResult.production;
    let x = productionData.map((instance: any) => (instance["snapshot"]));
    let y = productionData.map((instance: any) => (instance["totale"]));
    let eolien = productionData.map((instance: any) => (instance["total_eolien"]));
    let solaire = productionData.map((instance: any) => (instance["total_solaire"]));
    let hydro_fil = productionData.map((instance: any) => (instance["total_hydro_fil"]));
    let hydro_res = productionData.map((instance: any) => (instance["total_hydro_reservoir"]));
    let imports = productionData.map((instance: any) => (instance["total_import"]));
    let nucleaire = productionData.map((instance: any) => (instance["total_nucleaire"]));
    let thermique = productionData.map((instance: any) => (instance["total_thermique"]));

    let demandeX = Object.keys(this.cachedDemandeTemporal.total_electricity);
    let demandeY = Object.values(this.cachedDemandeTemporal.total_electricity).map((value: any) => value / 1000);

    const productionTraces: any = [
      {
        x: demandeX,
        y: demandeY,
        type: 'scatter',
        mode: 'lines',
        name: 'Demande',
        line: { shape: 'spline', color: 'black' },
        hovertemplate: "%{x}<br>%{y:.2f} MW<extra></extra>"
      },
      {
        x: x,
        y: y,
        type: 'scatter',
        mode: 'lines',
        name: 'Production totale',
        line: { shape: 'spline', color: 'green' },
        hovertemplate: "%{x}<br>%{y:.2f} MW<extra></extra>"
      },
      {
        x: x,
        y: eolien,
        type: 'scatter',
        mode: 'lines',
        name: 'Éolien',
        line: { shape: 'spline', color: 'orange' },
        hovertemplate: "%{x}<br>%{y:.2f} MW<extra></extra>"
      },
      {
        x: x,
        y: solaire,
        type: 'scatter',
        mode: 'lines',
        name: 'Solaire',
        line: { shape: 'spline', color: 'yellow' },
        hovertemplate: "%{x}<br>%{y:.2f} MW<extra></extra>"
      },
      {
        x: x,
        y: hydro_fil,
        type: 'scatter',
        mode: 'lines',
        name: 'Hydro (fil)',
        line: { shape: 'spline', color: 'blue' },
        hovertemplate: "%{x}<br>%{y:.2f} MW<extra></extra>"
      },
      {
        x: x,
        y: hydro_res,
        type: 'scatter',
        mode: 'lines',
        name: 'Hydro (réservoir)',
        line: { shape: 'spline', color: 'cyan' },
        hovertemplate: "%{x}<br>%{y:.2f} MW<extra></extra>"
      },
      {
        x: x,
        y: imports,
        type: 'scatter',
        mode: 'lines',
        name: 'Importations',
        line: { shape: 'spline', color: 'purple' },
        hovertemplate: "%{x}<br>%{y:.2f} MW<extra></extra>"
      },
      {
        x: x,
        y: nucleaire,
        type: 'scatter',
        mode: 'lines',
        name: 'Nucléaire',
        line: { shape: 'spline', color: 'red' },
        hovertemplate: "%{x}<br>%{y:.2f} MW<extra></extra>"
      },
      {
        x: x,
        y: thermique,
        type: 'scatter',
        mode: 'lines',
        name: 'Thermique',
        line: { shape: 'spline', color: 'brown' },
        hovertemplate: "%{x}<br>%{y:.2f} MW<extra></extra>"
      }
    ];

    Plotly.purge(graphServiceConfig.TEMPORAL_DEMANDE_PRODUCTION_ID);
    Plotly.newPlot(graphServiceConfig.TEMPORAL_DEMANDE_PRODUCTION_ID, productionTraces, {
      title: `Production et Demande pour scénario ${this.scenariosService.selectedScenario()?.nom}`,
      xaxis: {
        title: "Date",
        tickformat: "%d %b %Y"
      },
      yaxis: {
        title: "Puissance (MW)",
        autorange: true
      },
      legend: {
        orientation: "h",
        yanchor: "bottom",
        y: 1.02,
        xanchor: "right",
        x: 1
      }
    } as any);
    return true;
  }

  hasExportableData(): boolean {
    return this.cachedSimulationResult !== null || this.cachedDemandeTemporal !== null;
  }

  exportSimulationToCSV(): void {
    if (!this.cachedSimulationResult && !this.cachedDemandeTemporal) {
      console.warn('No simulation data available to export');
      return;
    }

    const headers = ['Date', 'Demande (MW)', 'Production Totale (MW)', 'Éolien (MW)', 'Solaire (MW)',
      'Hydro Fil (MW)', 'Hydro Réservoir (MW)', 'Importations (MW)', 'Nucléaire (MW)', 'Thermique (MW)'];

    const rows: string[] = [headers.join(',')];

    if (this.cachedSimulationResult && this.cachedSimulationResult.production) {
      const productionData = this.cachedSimulationResult.production;
      const demandeData = this.cachedDemandeTemporal?.total_electricity || {};

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
    } else if (this.cachedDemandeTemporal) {
      //if no simulation result, we export only the demand data
      const demandeData = this.cachedDemandeTemporal.total_electricity;
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
