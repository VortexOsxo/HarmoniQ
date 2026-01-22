import { Injectable } from '@angular/core';
import * as Plotly from 'plotly.js-dist-min';

export const graphServiceConfig = {
    PRODUCTION_SINGLE_INFRA_ID: 'production-single-infra-id',
    ENERGY_PROD_CONS_SANKEY_ID: 'energy-prod-cons-sankey-id',
    SECTOR_ENERGY_CONS_SANKEY_ID: 'sector-energy-cons-sankey-id',
    TEMPORAL_DEMANDE_PRODUCTION_ID: 'temporal-demande-production-id'
};


@Injectable({
    providedIn: 'root'
})
export class GraphService {

    constructor() { }

    public generateProductionSingleInfraGraph(type: string, data: any): void {
        let unit = '';
        let xval: any[] = [];
        let yval: any[] = [];

        if (type === "eolienneparc") {
            unit = "MW";
            xval = Object.values(data.tempsdate);
            yval = Object.values(data.puissance);
        } else if (type === "thermique" || type === "nucleaire") {
            unit = "MW";
            xval = Object.keys(data.production_mwh);
            yval = Object.values(data.production_mwh);
        } else if (type === "solaire") {
            unit = "W";
            xval = Object.keys(data.production_horaire_wh);
            yval = Object.values(data.production_horaire_wh);
        }

        const layout = {
            xaxis: {
                title: "Date",
                tickformat: "%d %b %Y"
            },
            yaxis: {
                title: "Production (" + unit + ")",
                autorange: true
            },
        };

        const trace = {
            x: xval,
            y: yval,
            type: 'scatter' as any,
            mode: 'lines' as any,
            marker: { color: 'blue' },
            line: { shape: 'spline' as any }
        };

        Plotly.newPlot(graphServiceConfig.PRODUCTION_SINGLE_INFRA_ID, [trace], layout as any);
    }

    public generateEnergyProdConsSankeyGraph(data: any): void {
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

        Plotly.react(graphServiceConfig.ENERGY_PROD_CONS_SANKEY_ID, [data], layout);
    }

    public downloadGraph(graphId: string) {
        Plotly.downloadImage(graphId, {
            format: "png",
            filename: graphId,
            height: 600,
            width: 1000
        });
    }
}
