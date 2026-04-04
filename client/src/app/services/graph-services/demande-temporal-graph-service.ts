import { Injectable, signal } from '@angular/core';
import { ScenariosService } from '../scenarios-service';
import { GraphService, graphServiceConfig } from '../graph-service';
import * as Plotly from 'plotly.js-dist-min';
import { Scenario } from '@app/models/scenario';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import { firstValueFrom } from 'rxjs';
import { SimulationStep } from '@app/models/interfaces/simulation-step';

@Injectable({
    providedIn: 'root',
})
export class DemandeTemporalGraphService implements SimulationStep {
    public cachedData: any;
    private cachedScenarioId?: number;

    /**
     * Demande de pointe (MW) — valeur maximale sur toute la période de simulation.
     * Peuplé dès que generate() a été appelé une première fois.
     * C'est la référence à utiliser pour le dimensionnement des capacités garanties :
     * si la puissance installée pilotable < peakDemandMW, le réseau ne peut pas couvrir
     * les heures de pointe (ex. vague de froid hivernal au Québec).
     */
    peakDemandMW = signal<number | null>(null);

    /** Énergie totale demandée sur toute la période de simulation (TWh). */
    totalDemandEnergyTWh = signal<number | null>(null);

    constructor(
        private scenariosService: ScenariosService,
        private graphService: GraphService,
        private http: HttpClient,
    ) { }

    getStepName(): string {
        return 'Generation de la demande temporelle';
    }

    async generate(scenario: Scenario): Promise<void> {
        if (scenario.id != this.cachedScenarioId) {
            this.cachedScenarioId = scenario.id;
            this.cachedData = await firstValueFrom(
                this.http.post(`${environment.apiUrl}/demande/temporal`, scenario)
            );
        }
        
        if (this.cachedData && this.cachedData.total_electricity) {
            let yval = Object.values(this.cachedData.total_electricity).map((value: any) => value / 1000);
            this.peakDemandMW.set(Math.round(Math.max(...yval)));
            const rawKw = Object.values(this.cachedData.total_electricity) as number[];
            this.totalDemandEnergyTWh.set(Math.round(rawKw.reduce((s, v) => s + v, 0) / 1e9 * 10) / 10);
        }
    }

    public handleData(apidata: any, granularity: string = 'original') {
        let xval = Object.keys(apidata.total_electricity);
        let yval = Object.values(apidata.total_electricity).map((value: any) => value / 1000);

        // Pic de demande : maximum horaire sur la période (kW→MW already divided above)
        this.peakDemandMW.set(Math.round(Math.max(...yval)));

        // Énergie totale : somme des kW × 1h = kWh, converti en TWh
        const rawKw = Object.values(apidata.total_electricity) as number[];
        this.totalDemandEnergyTWh.set(Math.round(rawKw.reduce((s, v) => s + v, 0) / 1e9 * 10) / 10);

        if (granularity !== 'original') {
            const aggregated = this.graphService.aggregateData(xval, yval, granularity);
            xval = aggregated.x;
            yval = aggregated.y;
        }

        const trace = this.graphService.getStandardTrace(
            'Demande Totale',
            xval,
            yval,
            '#2c3e50',
            "<b>%{y:.2f} MW</b><extra></extra>"
        );

        const layout = this.graphService.getStandardLayout(
            'Demande Électrique Totale',
            'Demande (MW)',
            granularity,
            { margin: { t: 80 }, height: 800 }
        );

        Plotly.newPlot(graphServiceConfig.TEMPORAL_DEMANDE_PRODUCTION_ID, [trace], layout as any, { responsive: true });
    }

    clear() {
        Plotly.purge(graphServiceConfig.TEMPORAL_DEMANDE_PRODUCTION_ID);
    }
}
