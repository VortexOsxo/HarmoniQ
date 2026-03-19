import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'environments/environment';
import { Scenario } from '@app/models/scenario';
import { firstValueFrom } from 'rxjs';


@Injectable({
    providedIn: 'root',
})
export class DemandeSankeyGraphService {
    private cachedData: any;
    private cachedScenarioId?: number;

    tempShouldShowSignal = signal(false);

    constructor(private http: HttpClient) { }

    display() { }
    undisplay() { }

    async generate(scenario: Scenario) {
        const mrc_id = 1;

        let data;
        if (scenario.id != this.cachedScenarioId)
            data = await firstValueFrom(this.http.post(`${environment.apiUrl}/demande/sankey?CUID=${mrc_id}`, scenario));
        else
            data = this.cachedData;
        return this.handleData(data);
    }

    protected handleData(apidata: any) {
        // TODO

        this.generateGraph()
    }

    protected generateGraph() {
        this.tempShouldShowSignal.set(true);
        // Plotly.newPlot(graphServiceConfig.SECTOR_ENERGY_CONS_SANKEY_ID, this.cachedData, layout);
    }

    clear() {
        // Plotly.purge(graphServiceConfig.SECTOR_ENERGY_CONS_SANKEY_ID);
    }
}
