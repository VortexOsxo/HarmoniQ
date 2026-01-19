import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { getWindFarmFromJson, WindFarm } from '@app/models/wind-farm';
import { environment } from 'environments/environment';

@Injectable({
    providedIn: 'root',
})
export class WindFarmsService {
    private apiUrl = `${environment.apiUrl}/eolienneparc`;

    infras = signal<WindFarm[]>([]);

    constructor(private http: HttpClient) {
        this.refresh();
    }

    refresh() {
        this.http.get(this.apiUrl).subscribe((data: any) => {
            const updated_infras = data.map((i: any) => getWindFarmFromJson(i));
            this.infras.set(updated_infras);
        })
    }

}
