import { Injectable } from '@angular/core';
import * as Plotly from 'plotly.js-dist-min';

@Injectable({
    providedIn: 'root'
})
export class GraphService {

    constructor() { }

    public createGraph(type: string, data: any, elementId: string = 'graph-plot'): void {
        let unit = '';
        let xval: any[] = [];
        let yval: any[] = [];

        console.log(type, data);

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
            type: 'scatter' as any, // Cast to any or specific Plotly type if available
            mode: 'lines' as any,
            marker: { color: 'blue' },
            line: { shape: 'spline' as any }
        };

        Plotly.newPlot(elementId, [trace], layout as any);
    }
}
