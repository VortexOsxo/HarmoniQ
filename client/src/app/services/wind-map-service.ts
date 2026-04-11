import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { environment } from 'environments/environment';
import { firstValueFrom } from 'rxjs';
import { MapService, WindMapAnnualResponse } from './map-service';
import { ProtectedAreasService } from './protected-areas-service';
import { ReseauService } from './reseau-service';

interface WindMapYearsResponse {
  years: number[];
  default_year: number;
}

@Injectable({
  providedIn: 'root',
})
export class WindMapService {
  isWindMode = signal(false);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  availableYears = signal<number[]>([]);
  selectedYear = signal<number | null>(null);

  constructor(
    private http: HttpClient,
    private mapService: MapService,
    private protectedAreasService: ProtectedAreasService,
    private reseauService: ReseauService,
  ) { }

  async toggleWindMode(): Promise<void> {
    if (this.isWindMode()) {
      this.disableWindMode();
    } else {
      await this.enableWindMode();
    }
  }

  async enableWindMode(): Promise<void> {
    if (this.isWindMode()) return;
    this.errorMessage.set(null);
    this.isLoading.set(true);
    try {
      await this.loadYears();
      const year = this.selectedYear();
      if (year === null) {
        throw new Error('Aucune annee ERA5 disponible pour la carte des vents.');
      }

      await this.loadAndRenderYear(year);
      this.isWindMode.set(true);
    } catch (error: any) {
      this.mapService.clearWindLayer();
      this.isWindMode.set(false);
      this.errorMessage.set(error?.message || "Impossible d'activer la carte des vents.");
    } finally {
      this.isLoading.set(false);
    }
  }

  disableWindMode(): void {
    this.mapService.clearWindLayer();
    this.isWindMode.set(false);
    this.errorMessage.set(null);
  }

  async setYear(year: number): Promise<void> {
    const yearInt = Number(year);
    if (!Number.isInteger(yearInt)) return;
    if (!this.availableYears().includes(yearInt)) return;

    this.selectedYear.set(yearInt);
    if (!this.isWindMode()) return;

    this.errorMessage.set(null);
    this.isLoading.set(true);
    try {
      await this.loadAndRenderYear(yearInt);
    } catch (error: any) {
      this.errorMessage.set(error?.message || 'Impossible de charger la heatmap de vent.');
    } finally {
      this.isLoading.set(false);
    }
  }

  private async loadYears(): Promise<void> {
    const payload = await firstValueFrom(
      this.http.get<WindMapYearsResponse>(`${environment.apiUrl}/meteo/wind-map/years`),
    );
    const years = [...(payload?.years || [])].sort((a, b) => a - b);
    this.availableYears.set(years);
    if (years.length === 0) {
      this.selectedYear.set(null);
      throw new Error('Aucune annee disponible pour la heatmap de vent.');
    }

    const preferred = Number(payload.default_year);
    if (Number.isInteger(preferred) && years.includes(preferred)) {
      this.selectedYear.set(preferred);
      return;
    }
    this.selectedYear.set(years[years.length - 1]);
  }

  private async loadAndRenderYear(year: number): Promise<void> {
    const payload = await firstValueFrom(
      this.http.get<WindMapAnnualResponse>(`${environment.apiUrl}/meteo/wind-map/annual`, {
        params: { year: String(year) },
      }),
    );
    await this.mapService.renderWindHeatmap(payload);
  }

}
