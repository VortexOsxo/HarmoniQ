import { Injectable, signal } from '@angular/core';
import * as Plotly from 'plotly.js-dist-min';
import { graphServiceConfig } from '../graph-service';
import { InfrastruturesService } from '../infrastrutures-service';
import { DemandeSankeyGraphService } from './demande-sankey-graph-service';

import { INFRA_COLORS } from '@app/data/infra-colors.data';

const PROD_SEGMENTS = [
    { prodKey: 'total_eolien', label: 'Éolien', color: INFRA_COLORS['eolien'], segKey: 'eolien' },
    { prodKey: 'total_solaire', label: 'Solaire', color: INFRA_COLORS['solaire'], segKey: 'solaire' },
    {
        prodKey: 'total_hydro_fil',
        label: "Hydro (fil de l'eau)",
        color: INFRA_COLORS['hydro_fil'],
        segKey: 'hydro_fil',
    },
    {
        prodKey: 'total_hydro_reservoir',
        label: 'Hydro (réservoir)',
        color: INFRA_COLORS['hydro_reservoir'],
        segKey: 'hydro_res',
    },
    { prodKey: 'total_nucleaire', label: 'Nucléaire', color: INFRA_COLORS['nucleaire'], segKey: 'nucleaire' },
    { prodKey: 'total_thermique', label: 'Thermique', color: INFRA_COLORS['thermique'], segKey: 'thermique' },
    { prodKey: 'total_import', label: 'Importations', color: INFRA_COLORS['import'], segKey: 'import' },
];

const SEASONS = [
    { label: 'Hiver', months: [12, 1, 2], color: '#7bbfe8' },
    { label: 'Printemps', months: [3, 4, 5], color: '#5aaa6f' },
    { label: 'Été', months: [6, 7, 8], color: '#e8c53c' },
    { label: 'Automne', months: [9, 10, 11], color: '#e8754a' },
];

const TYPE_KEY_MAP: Record<string, string> = {
    eolienneparc: 'parc_eoliens',
    solaire: 'parc_solaires',
    thermique: 'central_thermique',
    nucleaire: 'central_nucleaire',
    hydro: 'central_hydroelectriques',
};

function formatLabel(label: string, maxLen = 22): string {
    if (!label) return '';
    let arr = [];
    let current = '';
    const parts = label.split(' ');
    
    for (let word of parts) {
        if (word.length > maxLen) {
            if (current) arr.push(current);
            let w = word;
            while (w.length > maxLen) {
                arr.push(w.substring(0, maxLen));
                w = w.substring(maxLen);
            }
            current = w;
        } else if (current.length + word.length + 1 <= maxLen) {
            current = current ? current + ' ' + word : word;
        } else {
            if (current) arr.push(current);
            current = word;
        }
    }
    if (current) arr.push(current);
    return arr.join('<br>');
}

@Injectable({ providedIn: 'root' })
export class SimulationAnalysisGraphService {
    public isLoading = signal(true);

    constructor(
        private infrastructuresService: InfrastruturesService,
        private demandeSankeyService: DemandeSankeyGraphService,
    ) {}

    update(simResult: any) {
        const production: any[] = simResult?.production ?? [];
        if (!production.length) return;

        const t0 = new Date(production[0].snapshot).getTime();
        const t1 = new Date(production[1].snapshot).getTime();
        const hoursPerStep = (t1 - t0) / (1000 * 3600);
        const annualScale = 8760 / (production.length * hoursPerStep);

        const annualMWh: Record<string, number> = {};
        for (const seg of PROD_SEGMENTS) {
            annualMWh[seg.segKey] =
                production.reduce((s: number, r: any) => s + (r[seg.prodKey] ?? 0), 0) *
                hoursPerStep *
                annualScale;
        }

        this.renderProductionDonut(annualMWh);
        this.renderDemandDonut();
        this.renderTop10Productive(annualMWh);
        this.renderSeasonalBreakdown(production, hoursPerStep);
        this.isLoading.set(false);
    }

    reset() {
        this.isLoading.set(true);
        [
            graphServiceConfig.PROD_DONUT_ID,
            graphServiceConfig.DEMAND_DONUT_ID,
            graphServiceConfig.PROD_TOP10_ID,
            graphServiceConfig.SEASONAL_ID,
        ].forEach((id) => {
            if (document.getElementById(id)) Plotly.purge(id);
        });
    }

    private renderProductionDonut(annualMWh: Record<string, number>) {
        if (!document.getElementById(graphServiceConfig.PROD_DONUT_ID)) return;

        const labels: string[] = [];
        const values: number[] = [];
        const colors: string[] = [];

        for (const seg of PROD_SEGMENTS) {
            labels.push(seg.label);
            values.push((annualMWh[seg.segKey] ?? 0) / 1e6); // TWh (0-values kept for legend)
            colors.push(seg.color);
        }

        Plotly.newPlot(
            graphServiceConfig.PROD_DONUT_ID,
            [
                {
                    type: 'pie',
                    hole: 0,
                    labels,
                    values,
                    marker: { colors },
                    domain: { x: [0, 0.6], y: [0, 1] },
                    textinfo: 'percent',
                    textposition: 'inside',
                    insidetextorientation: 'auto',
                    textfont: { size: 12 },
                    hovertemplate: '<b>%{label}</b><br>%{percent}<extra></extra>',
                },
            ],
            {
                showlegend: true,
                legend: {
                    orientation: 'v',
                    x: 0.65,
                    y: 0.5,
                    xanchor: 'left',
                    yanchor: 'middle',
                    font: { size: 13 },
                    itemwidth: 30,
                    tracegroupgap: 6,
                    itemclick: false,
                    itemdoubleclick: false,
                },
                height: Math.floor(window.innerHeight * 0.45),
                margin: { t: 20, b: 20, l: 20, r: 20 },
                paper_bgcolor: 'white',
            },
            { responsive: true }
        );
    }

    private renderDemandDonut() {
        if (!document.getElementById(graphServiceConfig.DEMAND_DONUT_ID)) return;

        const nodes = this.demandeSankeyService.demandNodes() ?? [];
        if (!nodes.length) return;

        Plotly.newPlot(
            graphServiceConfig.DEMAND_DONUT_ID,
            [
                {
                    type: 'pie',
                    hole: 0,
                    labels: nodes.map((n) => n.label),
                    values: nodes.map((n) => n.value), // 0-values kept for legend
                    marker: { colors: nodes.map((n) => n.color) },
                    domain: { x: [0, 0.6], y: [0, 1] },
                    textinfo: 'percent',
                    textposition: 'inside',
                    insidetextorientation: 'auto',
                    textfont: { size: 12 },
                    hovertemplate: '<b>%{label}</b><br>%{percent}<extra></extra>',
                },
            ],
            {
                showlegend: true,
                legend: {
                    orientation: 'v',
                    x: 0.65,
                    y: 0.5,
                    xanchor: 'left',
                    yanchor: 'middle',
                    font: { size: 13 },
                    itemwidth: 30,
                    tracegroupgap: 6,
                    itemclick: false,
                    itemdoubleclick: false,
                },
                height: Math.floor(window.innerHeight * 0.45),
                margin: { t: 20, b: 20, l: 20, r: 20 },
                paper_bgcolor: 'white',
            },
            { responsive: true }
        );
    }

    private renderTop10Productive(annualMWh: Record<string, number>) {
        if (!document.getElementById(graphServiceConfig.PROD_TOP10_ID)) return;

        const group: any = this.infrastructuresService.selectedInfraGroup();
        if (!group) return;

        // Segment key → production infra type mapping
        const segInfraMap: { segKey: string; infraType: string; hydroFilter?: string }[] = [
            { segKey: 'eolien', infraType: 'eolienneparc' },
            { segKey: 'solaire', infraType: 'solaire' },
            { segKey: 'nucleaire', infraType: 'nucleaire' },
            { segKey: 'thermique', infraType: 'thermique' },
            { segKey: 'hydro_fil', infraType: 'hydro', hydroFilter: "Fil de l'eau" },
            { segKey: 'hydro_res', infraType: 'hydro', hydroFilter: 'Réservoir' },
        ];

        const entries: { name: string; mwh: number; color: string }[] = [];

        for (const def of segInfraMap) {
            const typeTotalMWh = annualMWh[def.segKey] ?? 0;
            if (typeTotalMWh <= 0) continue;

            const groupKey = TYPE_KEY_MAP[def.infraType];
            const selectedIds: string[] = group[groupKey] ?? [];
            const allInfras: any[] = this.infrastructuresService.getInfrasSignalByType(
                def.infraType,
            )();
            let infras = allInfras.filter((i: any) => selectedIds.includes(String(i.id)));

            if (def.hydroFilter) {
                const isFil = def.hydroFilter === "Fil de l'eau";
                infras = infras.filter((i: any) =>
                    isFil ? i.type_barrage === "Fil de l'eau" : i.type_barrage !== "Fil de l'eau",
                );
            }

            const totalCap = infras.reduce((s: number, i: any) => {
                return (
                    s +
                    Number(def.infraType === 'eolienneparc'
                        ? (i.capacite_total ?? 0)
                        : (i.puissance_nominal ?? 0))
                );
            }, 0);
            if (totalCap <= 0) continue;

            const seg = PROD_SEGMENTS.find((s) => s.segKey === def.segKey);

            for (const infra of infras) {
                const cap = Number(
                    def.infraType === 'eolienneparc'
                        ? (infra.capacite_total ?? 0)
                        : (infra.puissance_nominal ?? 0)
                );
                const estimatedMWh = typeTotalMWh * (cap / totalCap);
                entries.push({ name: infra.nom, mwh: estimatedMWh, color: seg?.color ?? '#999' });
            }
        }

        entries.sort((a, b) => b.mwh - a.mwh);
        const top10 = entries.slice(0, 10).reverse(); // reverse so most productive is at top

        Plotly.newPlot(
            graphServiceConfig.PROD_TOP10_ID,
            [
                {
                    type: 'bar',
                    orientation: 'h',
                    y: top10.map((e) => formatLabel(e.name)),
                    x: top10.map((e) => e.mwh / 1e6), // TWh
                    text: top10.map((e) => `${(e.mwh / 1e6).toFixed(2)} TWh`),
                    textposition: 'outside',
                    marker: { color: top10.map((e) => e.color) },
                    hovertemplate: '<b>%{y}</b><br>%{x:.2f} TWh<extra></extra>',
                    cliponaxis: false,
                },
            ],
            {
                xaxis: {
                    title: {
                        text: 'Production annuelle (TWh)',
                        font: { size: 13, color: '#7f8c8d' },
                    },
                    gridcolor: '#eee',
                    range: [0, Math.max(...top10.map((e) => e.mwh / 1e6), 0) * 1.3],
                },
                yaxis: { type: 'category', tickfont: { size: 12 }, automargin: true },
                height: Math.max(250, top10.length * 40 + 80),
                margin: { t: 20, b: 60, l: 20, r: 100 },
                paper_bgcolor: 'white',
                plot_bgcolor: 'white',
                showlegend: false,
            },
            { responsive: true }
        );
    }

    private renderSeasonalBreakdown(production: any[], hoursPerStep: number) {
        if (!document.getElementById(graphServiceConfig.SEASONAL_ID)) return;

        // Accumulate MWh per season per segment
        const seasonMWh: number[][] = SEASONS.map(() => PROD_SEGMENTS.map(() => 0));

        for (const row of production) {
            const month = new Date(row.snapshot).getMonth() + 1; // 1–12
            const si = SEASONS.findIndex((s) => s.months.includes(month));
            if (si < 0) continue;
            for (let pi = 0; pi < PROD_SEGMENTS.length; pi++) {
                seasonMWh[si][pi] += (row[PROD_SEGMENTS[pi].prodKey] ?? 0) * hoursPerStep;
            }
        }

        // Build one stacked bar trace per segment
        const traces: any[] = PROD_SEGMENTS.map((seg, pi) => {
            const rawValues = SEASONS.map((_, si) => seasonMWh[si][pi]);
            const totals = SEASONS.map((_, si) =>
                PROD_SEGMENTS.reduce((s, _, pj) => s + seasonMWh[si][pj], 0),
            );
            const pct = rawValues.map((v, si) => (totals[si] > 0 ? (v / totals[si]) * 100 : 0));

            return {
                type: 'bar',
                name: seg.label,
                x: SEASONS.map((s) => s.label),
                y: pct,
                marker: { color: seg.color },
                hovertemplate: `<b>${seg.label}</b><br>%{y:.1f}%<extra></extra>`,
            };
        });

        Plotly.newPlot(graphServiceConfig.SEASONAL_ID, traces, {
            barmode: 'stack',
            yaxis: {
                title: { text: '% de la production', font: { size: 13, color: '#7f8c8d' } },
                range: [0, 100],
                ticksuffix: '%',
                gridcolor: '#eee',
            },
            xaxis: { tickfont: { size: 14 } },
            legend: {
                orientation: 'h',
                x: 0.5,
                y: -0.15,
                xanchor: 'center',
                font: { size: 13 },
                itemclick: false,
                itemdoubleclick: false,
            },
            height: Math.floor(window.innerHeight * 0.45),
            margin: { t: 20, b: 80, l: 60, r: 20 },
            paper_bgcolor: 'white',
            plot_bgcolor: 'white',
        }, { responsive: true });
    }
}
