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

  private previousInfraTypes: Set<string> | null = null;
  private previousProtectedVisible: boolean | null = null;
  private previousProtectedLegendOpen: boolean | null = null;
  private previousReseauVisible: boolean | null = null;
  private previousReseauLegendOpen: boolean | null = null;
  private previousReseauBusTypes: Set<string> | null = null;
  private previousReseauLineTypes: Set<string> | null = null;

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

      this.snapshotCurrentState();
      this.hideNonWindLayers();
      await this.loadAndRenderYear(year);
      this.isWindMode.set(true);
    } catch (error: any) {
      this.restorePreviousState();
      this.mapService.clearWindLayer();
      this.isWindMode.set(false);
      this.errorMessage.set(error?.message || "Impossible d'activer la carte des vents.");
    } finally {
      this.isLoading.set(false);
    }
  }

  disableWindMode(): void {
    this.mapService.clearWindLayer();
    this.restorePreviousState();
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

  private snapshotCurrentState(): void {
    this.previousInfraTypes = new Set(this.mapService.mapFilterTypes());
    this.previousProtectedLegendOpen = this.protectedAreasService.legendOpen();
    this.previousReseauLegendOpen = this.reseauService.legendOpen();
    this.previousReseauBusTypes = new Set(this.reseauService.selectedBusTypes());
    this.previousReseauLineTypes = new Set(this.reseauService.selectedLineTypes());
  }

  private hideNonWindLayers(): void {
    this.mapService.mapFilterTypes.set(new Set());

    this.reseauService.deselectAll();
    this.reseauService.legendOpen.set(false);

    this.protectedAreasService.hide();
    this.protectedAreasService.legendOpen.set(false);
  }

  private restorePreviousState(): void {
    if (this.previousInfraTypes) {
      this.mapService.mapFilterTypes.set(new Set(this.previousInfraTypes));
    }

    if (this.previousReseauVisible !== null) {
      if (this.previousReseauBusTypes) {
        this.reseauService.selectedBusTypes.set(new Set(this.previousReseauBusTypes));
      }
      if (this.previousReseauLineTypes) {
        this.reseauService.selectedLineTypes.set(new Set(this.previousReseauLineTypes));
      }
      this.reseauService.rebuildLayers();

      if (this.previousReseauLegendOpen !== null) {
        this.reseauService.legendOpen.set(this.previousReseauLegendOpen);
      }
    }

    if (this.previousProtectedVisible !== null) {
      if (this.previousProtectedVisible) {
        this.protectedAreasService.show();
      } else {
        this.protectedAreasService.hide();
      }
      if (this.previousProtectedLegendOpen !== null) {
        this.protectedAreasService.legendOpen.set(this.previousProtectedLegendOpen);
      }
    }

    this.previousInfraTypes = null;
    this.previousProtectedVisible = null;
    this.previousProtectedLegendOpen = null;
    this.previousReseauVisible = null;
    this.previousReseauLegendOpen = null;
    this.previousReseauBusTypes = null;
    this.previousReseauLineTypes = null;
  }
}
