import { Injectable } from '@angular/core';
import * as Plotly from 'plotly.js-dist-min';
import { INFRA_COLORS } from '@app/data/infra-colors.data';

export const graphServiceConfig = {
    PRODUCTION_SINGLE_INFRA_ID: 'production-single-infra-id',
    ENERGY_PROD_CONS_SANKEY_ID: 'energy-prod-cons-sankey-id',
    TEMPORAL_SIMULATION_ID: 'temporal-simulation-id',
    COST_SIMULATION_ID: 'cost-simulation-id',
    COST_RENTABILITE_ID: 'cost-rentabilite-id',
    COST_TOP10_ID: 'cost-top10-id',
    CO2_SIMULATION_ID: 'co2-simulation-id',
    PROD_DONUT_ID: 'prod-donut-id',
    DEMAND_DONUT_ID: 'demand-donut-id',
    PROD_TOP10_ID: 'prod-top10-id',
    SEASONAL_ID: 'seasonal-id',
};

@Injectable({
    providedIn: 'root',
})
export class GraphService {
    constructor() {
        (Plotly as any).register({
            moduleType: 'locale',
            name: 'fr',
            dictionary: {},
            format: {
                months: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
                shortMonths: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'],
                days: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'],
                shortDays: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
                decimal: ',',
                thousands: '\u00a0',
                grouping: [3],
                currency: ['', '\u00a0€'],
                periods: ['', ''],
                dateTime: '%A %e %B %Y %X',
                date: '%d/%m/%Y',
                time: '%H:%M:%S',
            },
        });
        (Plotly as any).setPlotConfig({ locale: 'fr' });
    }

    public generateProductionSingleInfraGraph(
        type: string,
        data: any,
        granularity: string = 'original',
    ): void {
        let unit = '';
        let xval: any[] = [];
        let yval: any[] = [];

        if (type === 'eolienneparc') {
            unit = 'MW';
            xval = Object.values(data.tempsdate);
            yval = Object.values(data.puissance);
        } else if (type === 'thermique' || type === 'nucleaire') {
            unit = 'MW';
            xval = Object.keys(data.production_mwh);
            yval = Object.values(data.production_mwh);
        } else if (type === 'solaire') {
            unit = 'W';
            xval = Object.keys(data.production);
            yval = Object.values(data.production);
        }

        if (granularity !== 'original') {
            const aggregated = this.aggregateData(xval, yval, granularity);
            xval = aggregated.x;
            yval = aggregated.y;
        }

        const layout = this.getStandardLayout(
            null,
            `Production (${unit})`,
            granularity,
            { margin: { t: 20 } }
        );

        const lineColor =
            type === 'eolienneparc'
                ? INFRA_COLORS['eolienneparc']
                : type === 'solaire'
                  ? INFRA_COLORS['solaire']
                  : type === 'thermique'
                    ? INFRA_COLORS['thermique']
                    : type === 'nucleaire'
                      ? INFRA_COLORS['nucleaire']
                      : '#3498db';
        const trace = this.getStandardTrace(
            'Production',
            xval,
            yval,
            lineColor,
            `%{y:.2f} ${unit}<extra></extra>`,
        );

        Plotly.newPlot(graphServiceConfig.PRODUCTION_SINGLE_INFRA_ID, [trace], layout as any, {
            responsive: true,
        });
    }

    public getStandardLayout(title: any, yTitle: string, granularity: string, extra: any = {}) {
        return {
            title:
                typeof title === 'string'
                    ? {
                          text: `<b>${title}</b>`,
                          font: { size: 20, color: '#2c3e50' },
                      }
                    : title,
            xaxis: {
                title: null,
                tickformat:
                    granularity === 'monthly'
                        ? '%b %Y'
                        : granularity === 'daily' || granularity === 'weekly'
                          ? '%d %b %Y'
                          : '%d %b %H:%M',
                gridcolor: '#eee',
                rangeslider: { visible: false },
                type: 'date',
                ...extra.xaxis,
            },
            yaxis: {
                title: { text: yTitle, font: { size: 14, color: '#7f8c8d' } },
                gridcolor: '#eee',
                zerolinecolor: '#ccc',
                autorange: true,
                ...extra.yaxis,
            },
            template: 'plotly_white',
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            margin: { t: 80, b: 100, l: 80, r: 40, ...extra.margin },
            hovermode: 'x unified',
            hoverlabel: {
                bgcolor: 'white',
                bordercolor: '#ccc',
                font: { size: 16, color: '#2c3e50' },
                namelength: -1,
                align: 'left',
            },
            legend: {
                orientation: 'h',
                yanchor: 'top',
                y: -0.2,
                xanchor: 'center',
                x: 0.5,
                font: { size: 14 },
                ...extra.legend,
            },
            ...extra,
        };
    }

    public getStandardTrace(
        name: string,
        x: any[],
        y: any[],
        color: string,
        hovertemplate?: string,
    ) {
        return {
            x: x,
            y: y,
            type: 'scatter' as any,
            mode: 'lines' as any,
            name: name,
            line: { shape: 'spline' as any, color: color, width: 4 },
            fill: 'tozeroy',
            fillcolor: this.hexToRgba(color, 0.1),
            hovertemplate: hovertemplate || '<b>%{y:.2f}</b><extra></extra>',
        };
    }

    public hexToRgba(hex: string, alpha: number): string {
        try {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        } catch (e) {
            return `rgba(52, 152, 219, ${alpha})`;
        }
    }

    public aggregateData(x: any[], y: any[], granularity: string): { x: any[]; y: any[] } {
        const groups: { [key: string]: number[] } = {};

        x.forEach((dateStr, index) => {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return;

            let key = '';
            if (granularity === 'daily') {
                key = date.toISOString().split('T')[0];
            } else if (granularity === 'weekly') {
                const d = new Date(date);
                d.setHours(0, 0, 0, 0);
                d.setDate(d.getDate() - d.getDay()); // Sunday as the start of the week
                key = d.toISOString().split('T')[0];
            } else if (granularity === 'monthly') {
                key = date.toISOString().substring(0, 7); // YYYY-MM
            }

            if (!groups[key]) groups[key] = [];
            groups[key].push(y[index]);
        });

        const sortedKeys = Object.keys(groups).sort();
        return {
            x: sortedKeys,
            y: sortedKeys.map((key) => {
                const values = groups[key];
                return values.reduce((a, b) => a + b, 0) / values.length;
            }),
        };
    }

    public downloadGraph(graphId: string) {
        Plotly.downloadImage(graphId, {
            format: 'png',
            filename: graphId,
            height: 600,
            width: 1000,
        });
    }
}
