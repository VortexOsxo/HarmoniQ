import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { getThermalPowerPlantFromJson, ThermalPowerPlant } from '@app/models/thermal-power-plant';
import { environment } from 'environments/environment';

@Injectable({
    providedIn: 'root',
})
export class ThermalPowerPlantsService {
    private apiUrl = `${environment.apiUrl}/thermique`;

    infras = signal<ThermalPowerPlant[]>([]);

    constructor(private http: HttpClient) {
        this.refresh();
    }

    refresh() {
        this.http.get(this.apiUrl).subscribe((data: any) => {
            const updated_infras = data.map((i: any) => getThermalPowerPlantFromJson(i))
            this.infras.set(updated_infras);
        })
    }

}
