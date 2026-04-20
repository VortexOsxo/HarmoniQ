import { Injectable, signal } from '@angular/core';
import { ScenariosService } from '../scenarios-service';
import * as Plotly from 'plotly.js-dist-min';
import { Scenario } from '@app/models/scenario';
import { GraphService, graphServiceConfig } from '@app/services/graph-service';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import { firstValueFrom } from 'rxjs';
import { InfrastruturesService } from '../infrastrutures-service';
import { SimulationStep } from '@app/models/interfaces/simulation-step';
import { ProductionNode } from '@app/components/scenario/scenario-demand-prod-sankey/sankey-data.types';
import { INFRA_COLORS, INFRA_LABELS } from '@app/data/infra-colors.data';
import { SimulationCo2GraphService } from './simulation-co2-graph-service';

const CARRIER_NODE_DEFS: Record<string, Omit<ProductionNode, 'value'>> = {
    hydro_fil: {
        id: 'hydro_fil',
        label: "Hydro (fil de l'eau)",
        color: INFRA_COLORS['hydro_fil'],
        icon: 'fa-droplet',
        energyType: 'electricity',
    },
    hydro_res: {
        id: 'hydro_res',
        label: 'Hydro (réservoir)',
        color: INFRA_COLORS['hydro_reservoir'],
        icon: 'fa-droplet',
        energyType: 'electricity',
    },
    eolien: {
        id: 'eolien',
        label: INFRA_LABELS['eolien'],
        color: INFRA_COLORS['eolien'],
        icon: 'fa-wind',
        energyType: 'electricity',
    },
    solaire: {
        id: 'solaire',
        label: INFRA_LABELS['solaire'],
        color: INFRA_COLORS['solaire'],
        icon: 'fa-sun',
        energyType: 'electricity',
    },
    thermique: {
        id: 'thermique',
        label: INFRA_LABELS['thermique'],
        color: INFRA_COLORS['thermique'],
        icon: 'fa-bolt',
        energyType: 'electricity',
    },
    nucleaire: {
        id: 'nucleaire',
        label: INFRA_LABELS['nucleaire'],
        color: INFRA_COLORS['nucleaire'],
        icon: 'fa-radiation',
        energyType: 'electricity',
    },
    import: {
        id: 'import',
        label: INFRA_LABELS['import'],
        color: INFRA_COLORS['import'],
        icon: 'fa-right-to-bracket',
        energyType: 'electricity',
    },
};

@Injectable({
    providedIn: 'root',
})
export class SimulationTemporalGraphService implements SimulationStep {
    public cachedScenarioId?: number;
    public cachedSimulationResult: any;
    public cachedDemandeResult = signal<any>(undefined);

    peakDemandMW = signal<number | null>(null);
    totalDemandEnergyTWh = signal<number | null>(null);

    /**
     * Bilan énergétique sur toute la période de simulation (TWh par source + demande).
     * Peuplé après chaque appel à generate() / handleData().
     * null si la simulation n'a pas encore été lancée.
     */
    energySummaryTWh = signal<{
        demand: number;
        hydro: number;
        wind: number;
        solar: number;
        thermal: number;
        nuclear: number;
        imported: number;
    } | null>(null);

    constructor(
        private scenariosService: ScenariosService,
        private infrastructuresService: InfrastruturesService,
        private graphService: GraphService,
        private http: HttpClient,
        private co2GraphService: SimulationCo2GraphService,
    ) {}

    getStepName(): string {
        return 'Simulation du reseau complet';
    }

    async generate(scenario: Scenario) {
        if (scenario.id != this.cachedScenarioId) {
            this.cachedScenarioId = scenario.id;
            this.cachedSimulationResult = undefined;
            this.cachedDemandeResult.set(undefined);
            this.peakDemandMW.set(null);
            this.totalDemandEnergyTWh.set(null);

            const demandeRes = await firstValueFrom(
                this.http.post(`${environment.apiUrl}/demande/temporal`, scenario),
            );
            this.cachedDemandeResult.set(demandeRes);

            if (demandeRes && (demandeRes as any).total_electricity) {
                let yval = Object.values((demandeRes as any).total_electricity).map((value: any) => value / 1000);
                this.peakDemandMW.set(Math.round(Math.max(...yval)));
            }

            const url = `${environment.apiUrl}/reseau/production?is_journalier=false`;
            const payload = {
                scenario: scenario,
                infra_group: this.infrastructuresService.buildSimulationPayload(),
            };
            this.cachedSimulationResult = await firstValueFrom(this.http.post(url, payload));
        }
    }

    public handleData(simulationResult: any, demandeResult: any, granularity: string = 'weekly') {
        if (!document.getElementById(graphServiceConfig.TEMPORAL_SIMULATION_ID)) return;

        const productionData = simulationResult.production;
        let x = productionData.map((instance: any) => instance['snapshot']);

        // Mode "viz import/export" : granularité figée à hebdomadaire, sources mises à l'échelle
        // pour que le haut du stack = production livrée au Québec (= totale - total_export),
        // export affiché en miroir orange sous la ligne zéro, Importation en bas du stack.
        const isImportExportMode = granularity === 'import_export';
        const effectiveGranularity = isImportExportMode ? 'weekly' : granularity;

        // Importation toujours placée en bas du stack (socle, source primaire)
        const components = [
            { key: 'total_import', name: INFRA_LABELS['import'], color: INFRA_COLORS['import'] },
            { key: 'total_eolien', name: INFRA_LABELS['eolien'], color: INFRA_COLORS['eolien'] },
            { key: 'total_solaire', name: INFRA_LABELS['solaire'], color: INFRA_COLORS['solaire'] },
            { key: 'total_hydro_fil', name: 'Hydro (fil de l\'eau)', color: INFRA_COLORS['hydro_fil'] },
            { key: 'total_hydro_reservoir', name: 'Hydro (réservoir)', color: INFRA_COLORS['hydro_reservoir'] },
            {
                key: 'total_nucleaire',
                name: INFRA_LABELS['nucleaire'],
                color: INFRA_COLORS['nucleaire'],
            },
            {
                key: 'total_thermique',
                name: INFRA_LABELS['thermique'],
                color: INFRA_COLORS['thermique'],
            },
        ];

        let traces: any[] = [];

        // Pré-calcul du facteur d'échelle par pas de temps pour le mode viz import/export :
        // chaque source est multipliée par (totale - export) / totale → le stack colle à la ligne
        // "Production Totale livrée au QC". Le hover affiche la valeur brute via customdata.
        const scaleFactor: number[] = productionData.map((instance: any) => {
            const totale = instance['totale'] || 0;
            const exp = instance['total_export'] || 0;
            if (!isImportExportMode || totale <= 0) return 1.0;
            return Math.max(0, (totale - exp) / totale);
        });

        components.forEach((comp) => {
            const rawY: number[] = productionData.map((instance: any) => instance[comp.key] || 0);
            let y: number[] = isImportExportMode
                ? rawY.map((v, i) => v * scaleFactor[i])
                : rawY;
            let rawYAgg: number[] = rawY;
            let xLocal = x;

            if (effectiveGranularity !== 'original') {
                const aggregated = this.graphService.aggregateData(x, y, effectiveGranularity);
                xLocal = aggregated.x;
                y = aggregated.y;
                if (isImportExportMode) {
                    rawYAgg = this.graphService.aggregateData(x, rawY, effectiveGranularity).y;
                }
            }

            const trace: any = {
                x: xLocal,
                y: y,
                type: 'scatter',
                mode: 'none',
                name: comp.name,
                stackgroup: 'one',
                fillcolor: this.graphService.hexToRgba(comp.color, 0.7),
                hovertemplate: `<b>%{y:.2f} MW</b>`,
            };
            if (isImportExportMode) {
                trace.customdata = rawYAgg;
                trace.hovertemplate = `<b>%{customdata:.2f} MW</b> (brut)<extra></extra>`;
            }
            traces.push(trace);
        });

        // Exportation en miroir (uniquement en mode viz import/export)
        if (isImportExportMode) {
            let exportRaw: number[] = productionData.map((i: any) => i['total_export'] || 0);
            let exportX = x;
            if (effectiveGranularity !== 'original') {
                const aggregated = this.graphService.aggregateData(x, exportRaw, effectiveGranularity);
                exportX = aggregated.x;
                exportRaw = aggregated.y;
            }
            const exportY = exportRaw.map((v: number) => -v);
            traces.push({
                x: exportX,
                y: exportY,
                type: 'scatter',
                mode: 'none',
                name: 'Exportation',
                fill: 'tozeroy',
                fillcolor: this.graphService.hexToRgba('#f5a9a4', 0.5),
                customdata: exportRaw,
                hovertemplate: `<b>%{customdata:.2f} MW exportés</b><extra></extra>`,
            });
        }

        // Production Totale : brute par défaut, nette d'export en mode viz import/export
        let totalY = productionData.map((instance: any) =>
            isImportExportMode
                ? (instance['totale'] || 0) - (instance['total_export'] || 0)
                : instance['totale'] || 0,
        );
        let totalX = x;
        if (effectiveGranularity !== 'original') {
            const aggregated = this.graphService.aggregateData(x, totalY, effectiveGranularity);
            totalX = aggregated.x;
            totalY = aggregated.y;
        }
        traces.push({
            x: totalX,
            y: totalY,
            type: 'scatter',
            mode: 'lines',
            name: isImportExportMode ? 'Production livrée au QC' : 'Production Totale',
            line: { color: '#27ae60', width: 2, dash: 'solid' },
            fill: 'none',
            hovertemplate: `<b>%{y:.2f} MW</b>`,
        });

        let demandeX = Object.keys(demandeResult.total_electricity);
        let demandeY = Object.values(demandeResult.total_electricity).map(
            (value: any) => (value as number) / 1000,
        );

        if (effectiveGranularity !== 'original') {
            const aggregated = this.graphService.aggregateData(demandeX, demandeY, effectiveGranularity);
            demandeX = aggregated.x;
            demandeY = aggregated.y;
        }

        traces.push({
            x: demandeX,
            y: demandeY,
            type: 'scatter',
            mode: 'lines',
            name: 'Besoin Québécois',
            line: { color: '#000000', width: 2, dash: 'dot' },
            fill: 'none',
            hovertemplate: `<b>%{y:.2f} MW</b>`,
        });

        // --- Bilan énergétique (TWh) sur la période complète ---
        // Chaque snapshot est horaire → MW × 1h = MWh → /1e6 = TWh
        const sumMWh = (key: string) =>
            productionData.reduce((s: number, r: any) => s + (r[key] ?? 0), 0);
        const demandKwh = Object.values(demandeResult.total_electricity as Record<string, number>)
            .reduce((s, v) => s + v, 0);
        
        const demandTWh = Math.round(demandKwh / 1e9 * 10) / 10;
        this.totalDemandEnergyTWh.set(demandTWh);

        this.energySummaryTWh.set({
            demand:   demandTWh,
            hydro:    Math.round((sumMWh('total_hydro_reservoir') + sumMWh('total_hydro_fil')) / 1e6 * 10) / 10,
            wind:     Math.round(sumMWh('total_eolien')    / 1e6 * 10) / 10,
            solar:    Math.round(sumMWh('total_solaire')   / 1e6 * 10) / 10,
            thermal:  Math.round(sumMWh('total_thermique') / 1e6 * 10) / 10,
            nuclear:  Math.round(sumMWh('total_nucleaire') / 1e6 * 10) / 10,
            imported: Math.round(sumMWh('total_import')    / 1e6 * 10) / 10,
        });

        const layout = this.graphService.getStandardLayout(
            `Production et Demande (${this.scenariosService.selectedScenario()?.nom})`,
            isImportExportMode ? 'Puissance (MW) — exportation en négatif' : 'Puissance (MW)',
            effectiveGranularity,
            {
                height: Math.floor(window.innerHeight * 0.7),
                ...(isImportExportMode
                    ? { yaxis: { zeroline: true, zerolinecolor: '#888', zerolinewidth: 1 } }
                    : {}),
            },
        );

        Plotly.newPlot(graphServiceConfig.TEMPORAL_SIMULATION_ID, traces, layout as any, {
            responsive: true,
        });
    }

    getCachedSimulationResult(): any {
        return this.cachedSimulationResult;
    }
    getCachedDemandeResult(): any {
        return this.cachedDemandeResult();
    }

    getProductionNodes(): ProductionNode[] {
        if (!this.cachedSimulationResult?.production?.length) return [];
        const data: any[] = this.cachedSimulationResult.production;
        const n = data.length;
        const avg = (key: string) =>
            data.reduce((sum: number, row: any) => sum + (row[key] ?? 0), 0) / n;

        // CO₂ from emission API (annual tonnes) → convert to t CO₂/h
        const scenario = this.scenariosService.selectedScenario();
        const simHours = scenario
            ? (new Date(scenario.date_de_fin).getTime() - new Date(scenario.date_de_debut).getTime()) / 3_600_000
            : 8760;
        const annualCo2 = this.co2GraphService.getAnnualCo2ByCarrier();
        const toTph = (key: string) => (annualCo2[key] ?? 0) / simHours;

        const carriers: [string, number][] = [
            ['hydro_fil',  avg('total_hydro_fil')],
            ['hydro_res',  avg('total_hydro_reservoir')],
            ['thermique',  avg('total_thermique')],
            ['nucleaire',  avg('total_nucleaire')],
            ['import',     avg('total_import')],
            ['eolien',     avg('total_eolien')],
            ['solaire',    avg('total_solaire')],
        ];

        const importAvgMW = carriers.find(([k]) => k === 'import')?.[1] ?? 0;
        const co2Tph: Record<string, number> = {
            hydro_fil:  toTph('hydro_fil'),
            hydro_res:  toTph('hydro_res'),
            eolien:     toTph('eolienneparc'),
            solaire:    toTph('solaire'),
            thermique:  toTph('thermique'),
            nucleaire:  toTph('nucleaire'),
            import:     (importAvgMW * 100) / 1000, // ~100 kg CO₂/MWh grid-mix factor
        };

        return carriers.map(([carrier, value]) => ({
            ...CARRIER_NODE_DEFS[carrier],
            value: value,
            co2Tph: co2Tph[carrier],
        }));
    }


    renderDemandPreview(demandeResult: any, granularity: string = 'weekly') {
        if (!document.getElementById(graphServiceConfig.TEMPORAL_SIMULATION_ID)) return;

        let demandeX = Object.keys(demandeResult.total_electricity);
        let demandeY = Object.values(demandeResult.total_electricity).map(
            (value: any) => (value as number) / 1000,
        );

        if (granularity !== 'original') {
            const aggregated = this.graphService.aggregateData(demandeX, demandeY, granularity);
            demandeX = aggregated.x;
            demandeY = aggregated.y;
        }

        const demandTrace = {
            ...this.graphService.getStandardTrace(
                'Demande',
                demandeX,
                demandeY,
                '#2c3e50',
                `<b>%{y:.2f} MW</b>`,
            ),
            line: { shape: 'spline', color: '#2c3e50', width: 2 },
            fill: 'none',
        };

        const layout = this.graphService.getStandardLayout(
            `Demande (${this.scenariosService.selectedScenario()?.nom})`,
            'Puissance (MW)',
            granularity,
            { height: Math.floor(window.innerHeight * 0.7) },
        );

        Plotly.newPlot(graphServiceConfig.TEMPORAL_SIMULATION_ID, [demandTrace], layout as any, {
            responsive: true,
        });
    }

    clear() {
        Plotly.purge(graphServiceConfig.TEMPORAL_SIMULATION_ID);
    }
}
