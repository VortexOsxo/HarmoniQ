import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { getNuclearPowerPlantFromJson, NuclearPowerPlant } from '@app/models/nuclear-power-plant';
import { environment } from 'environments/environment';

@Injectable({
    providedIn: 'root',
})
export class NuclearPowerPlantsService {
    private apiUrl = `${environment.apiUrl}/nucleaire`;

    infras = signal<NuclearPowerPlant[]>([]);

    constructor(private http: HttpClient) {
        this.refresh();
    }

    refresh() {
        this.http.get(this.apiUrl).subscribe((data: any) => {
            const updated_infras = data.map((i: any) => getNuclearPowerPlantFromJson(i))
            this.infras.set(updated_infras);
        })
    }

}
