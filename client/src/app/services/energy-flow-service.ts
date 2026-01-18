import { Injectable } from '@angular/core';
import * as Plotly from 'plotly.js-dist-min';

@Injectable({
  providedIn: 'root',
})
export class EnergyFlowService {

  consumption: any = null;
  production: any = null;

  async generateSankey(climateScenario: string, growthScenario: string, efficiencyScenario: string) {
    await this.load_energy_flow_data(climateScenario, growthScenario, efficiencyScenario);
    let source: any[] = [], target: any[] = [], value: any[] = [], labels: any[] = [];

    const nodeLabels = [
      "Gaz", "Électricité", "Transport", "Bâtiment", "Industrie",
      "Hydro", "Solaire", "Éolien", "Thermique", "Nucléaire"
    ];

    const colorMap: any = {
      Gaz: "#a9a9a9",
      Électricité: "#34c759",
      Transport: "#ff7f50",
      Bâtiment: "#20b2aa",
      Industrie: "#778899",
      Hydro: "#1e90ff",
      Solaire: "#ffd700",
      Éolien: "#87ceeb",
      Thermique: "#ff8c00",
      Nucléaire: "#9370db"
    };

    const nodeIndex: any = {
      Gaz: 0,
      Électricité: 1,
      Transport: 2,
      Bâtiment: 3,
      Industrie: 4,
      Hydro: 5,
      Solaire: 6,
      Éolien: 7,
      Thermique: 8,
      Nucléaire: 9
    };

    this.consumption.forEach((row: any) => {
      const [_, __, ___, secteur, energie, val] = row;
      if (secteur in nodeIndex && energie in nodeIndex) {
        source.push(nodeIndex[energie]);
        target.push(nodeIndex[secteur]);
        value.push(parseFloat(val));
        labels.push(`${energie} → ${secteur}: ${val} TWh`);
      }
    });

    this.production.forEach((row: any) => {
      const [_, __, ___, cible, sourceProd, val] = row;
      if (sourceProd in nodeIndex && cible in nodeIndex) {
        source.push(nodeIndex[sourceProd]);
        target.push(nodeIndex[cible]);
        value.push(parseFloat(val));
        labels.push(`${sourceProd} → ${cible}: ${val} TWh`);
      }
    });

    const data: Plotly.Data = {
      type: "sankey",
      orientation: "h",
      node: {
        pad: 20,
        thickness: 25,
        line: { color: "black", width: 0.7 },
        label: nodeLabels,
        color: nodeLabels.map(label => colorMap[label]),
        x: [0.4, 0.4, 0.8, 0.8, 0.8, 0, 0, 0, 0, 0],  // Horizontal placement (0 to 1)
        y: [0.25, 0.7, 0.2, 0.5, 0.8, 0.0, 0.2, 0.4, 0.6, 0.8], // Vertical placement
        hovertemplate: "%{label}<extra></extra>"
      },
      link: {
        source,
        target,
        value,
        label: labels,
        color: source.map(s => colorMap[nodeLabels[s]]),
        hovertemplate: "%{label}<br>%{value} TWh<extra></extra>"
      }
    };

    const layout = {
      title: {
        text: "Flux de Production et de Consommation d'Énergie",
        font: { size: 22, family: "Arial", color: "#333" }
      },
      font: { size: 14, family: "Helvetica" },
      margin: { l: 20, r: 20, t: 60, b: 20 },
      paper_bgcolor: "#f8f9fa",
      plot_bgcolor: "#f8f9fa",
    };


    Plotly.react("sankeyDiagram", [data], layout);
  }

  private async loadCSV(fileName: string) {
    try {
      const response = await fetch(fileName);
      if (!response.ok) throw new Error(`Error loading ${fileName}`);
      return await response.text();
    } catch (error) {
      console.error("Fetch error:", error);
      return "";
    }
  }

  private parseCSV(data: any, climateScenario: string, growthScenario: string, efficiencyScenario: string) {
    const rows = data.replace(/\r/g, "").split("\n").slice(1);
    return rows
      .map((row: any) => row.split(",").map((cell: any) => cell.trim()))
      .filter(
        (row: any) =>
          row.length >= 6 &&
          row[0].toLowerCase() === climateScenario.toLowerCase() &&
          row[1].toLowerCase() === growthScenario.toLowerCase() &&
          row[2].toLowerCase() === efficiencyScenario.toLowerCase()
      );
  }

  private async load_energy_flow_data(climateScenario: string, growthScenario: string, efficiencyScenario: string) {
    const [consumptionRaw, productionRaw] = await Promise.all([
      this.loadCSV("/energy_flow/data_sankey_cons.csv"),
      this.loadCSV("/energy_flow/data_sankey_prod.csv")
    ]);
    this.consumption = this.parseCSV(consumptionRaw, climateScenario, growthScenario, efficiencyScenario);
    this.production = this.parseCSV(productionRaw, climateScenario, growthScenario, efficiencyScenario);
  }

  async downloadPNG() {
    Plotly.downloadImage("sankeyDiagram", {
      format: "png",
      filename: "sankey_diagram",
      height: 600,
      width: 1000
    });
  }
}
