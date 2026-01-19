import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { getHydroelectricDamFromJson, HydroelectricDam } from '@app/models/hydroelectric-dam';
import { environment } from 'environments/environment';

@Injectable({
    providedIn: 'root',
})
export class HydroelectricDamsService {
    private apiUrl = `${environment.apiUrl}/hydro`;

    infras = signal<HydroelectricDam[]>([]);

    constructor(private http: HttpClient) {
        this.refresh();
    }

    refresh() {
        this.http.get(this.apiUrl).subscribe((data: any) => {
            const updated_infras = data.map((i: any) => getHydroelectricDamFromJson(i));
            this.infras.set(updated_infras);
        })
    }

}
