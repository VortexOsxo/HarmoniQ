import { Injectable, computed, effect } from '@angular/core';
import { ScenariosService } from './scenarios-service';
import { InfrastruturesService } from './infrastrutures-service';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import * as Plotly from 'plotly.js-dist-min';
import { Scenario } from '@app/models/scenario';

@Injectable({
  providedIn: 'root',
})
export class SimulationService {
  canLaunch = computed(() => this.infrastructuresService.selectedInfraGroup() !== null && this.scenariosService.selectedScenario() !== null);

  private cachedDemandeSankey: any = null;
  private cachedDemandeTemporal: any = null;

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

    Plotly.newPlot("sankey-plot", sankeyData, layout);
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

    Plotly.newPlot("temporal-plot", [trace], layout);
    return true;
  }
}
