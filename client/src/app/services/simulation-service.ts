import { Injectable, computed, effect } from '@angular/core';
import { ScenariosService } from './scenarios-service';
import { InfrastruturesService } from './infrastrutures-service';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import * as Plotly from 'plotly.js-dist-min';
import { Scenario } from '@app/models/scenario';
import { graphServiceConfig } from '@app/services/graph-service';

@Injectable({
  providedIn: 'root',
})
export class SimulationService {
  canLaunch = computed(() => this.infrastructuresService.selectedInfraGroup() !== null && this.scenariosService.selectedScenario() !== null);

  private cachedDemandeSankey: any = null;
  private cachedDemandeTemporal: any = null;
  private cachedSimulationResult: any = null;

  constructor(
    private scenariosService: ScenariosService,
    private infrastructuresService: InfrastruturesService,
    private http: HttpClient
  ) {
    effect(() => {
      const scenario = this.scenariosService.selectedScenario();
      if (scenario) {
        this.getDemandeSankey(scenario);
        this.getDemandeTemporal(scenario);
      }
    });
  }

  launchSimulation() {
    const scenario = this.scenariosService.selectedScenario();
    const infraGroup = this.infrastructuresService.selectedInfraGroup();

    if (!scenario || !infraGroup) return;

    const url = `${environment.apiUrl}/reseau/production/?scenario_id=${scenario.id}&liste_infra_id=${infraGroup.id}&is_journalier=false`;

    this.http.post(url, {}).subscribe((data: any) => this.cachedSimulationResult = data);
  }

  launchSimulationSingleInfra(type: string, infraId: number) {
    const scenario = this.scenariosService.selectedScenario();
    if (!scenario) return;

    const url = `${environment.apiUrl}/${type}/${infraId}/production?scenario_id=${scenario.id}`;
    return this.http.post(url, {});
  }

  getDemandeSankey(scenario: Scenario) {
    const mrc_id = 1; // No idea what it is ngl

    this.http.post(`${environment.apiUrl}/demande/sankey/?scenario_id=${scenario.id}&CUID=${mrc_id}`, {})
      .subscribe((demandeSankey: any) => this.cachedDemandeSankey = demandeSankey);
  }

  getDemandeTemporal(scenario: Scenario) {
    this.http.post(`${environment.apiUrl}/demande/temporal/?scenario_id=${scenario.id}`, {})
      .subscribe((demandeTemporal: any) => this.cachedDemandeTemporal = demandeTemporal);
  }

  generateDemandeSankey() {
    if (!this.cachedDemandeSankey) return false;

    const sectorLabels: any = Object.values(this.cachedDemandeSankey.sector);
    const energyLabels = ["Electricity", "Gaz"];
    const allLabels = energyLabels.concat(sectorLabels);

    const electricitySourceIndex = 0; // Electricité
    const gazSourceIndex = 1;         // Gaz

    const sources = [];
    const targets = [];
    const values = [];

    for (let i = 0; i < sectorLabels.length; i++) {
      const targetIndex = i + energyLabels.length;

      // Electricity to sector
      sources.push(electricitySourceIndex);
      targets.push(targetIndex);
      values.push(this.cachedDemandeSankey.total_electricity[i]);

      // Gaz to sector
      sources.push(gazSourceIndex);
      targets.push(targetIndex);
      values.push(this.cachedDemandeSankey.total_gaz[i]);
    }

    const sankeyData: any = [{
      type: "sankey",
      orientation: "h",
      node: {
        pad: 15,
        thickness: 20,
        label: allLabels
      },
      link: {
        source: sources,
        target: targets,
        value: values
      }
    }];

    const layout: any = {
      title: "Flux d'énergie vers les secteurs pour scénario " + this.scenariosService.selectedScenario()?.nom,
      font: { size: 10 }
    };

    Plotly.newPlot(graphServiceConfig.SECTOR_ENERGY_CONS_SANKEY_ID, sankeyData, layout);
    return true;
  }

  generateTemporalPlot() {
    if (!this.cachedDemandeTemporal) return false;

    const xval = Object.keys(this.cachedDemandeTemporal.total_electricity);
    const yval = Object.values(this.cachedDemandeTemporal.total_electricity).map((value: any) => value / 1000);

    const layout: any = {
      title: "Demande pour scénario " + this.scenariosService.selectedScenario()?.nom,
      xaxis: {
        title: "Date",
        tickformat: "%d %b %Y"
      },
      yaxis: {
        title: "Demande (MW)",
        autorange: true
      },
      legend: {
        orientation: "h",
        yanchor: "bottom",
        y: 1.02,
        xanchor: "right",
        x: 1
      },
    };

    const trace: any = {
      x: xval,
      y: yval,
      type: 'scatter',
      mode: 'lines',
      marker: { color: 'blue' },
      line: { shape: 'spline' },
      hovertemplate: "%{x}<br>%{y:.2f} MW<extra></extra>"
    };

    Plotly.newPlot(graphServiceConfig.TEMPORAL_DEMANDE_PRODUCTION_ID, [trace], layout);
    return true;
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
}
