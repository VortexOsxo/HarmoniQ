import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { getSolarFarmFromJson, SolarFarm } from '@app/models/solar-farm';
import { environment } from 'environments/environment';

@Injectable({
  providedIn: 'root',
})
export class SolarFarmsService {
  private apiUrl = `${environment.apiUrl}/solaire`;

  infras = signal<SolarFarm[]>([]);

  constructor(private http: HttpClient) {
    this.refresh();
  }

  refresh() {
    this.http.get(this.apiUrl).subscribe((data: any) => {
      const updated_infras = data.map((i: any) => getSolarFarmFromJson(i));
      this.infras.set(updated_infras);
    })
  }

}
