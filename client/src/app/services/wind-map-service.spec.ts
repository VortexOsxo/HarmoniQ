import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { signal } from '@angular/core';

import { WindMapService } from './wind-map-service';
import { MapService } from './map-service';
import { ProtectedAreasService } from './protected-areas-service';
import { ReseauService } from './reseau-service';

describe('WindMapService', () => {
  let service: WindMapService;
  let httpGetMock: ReturnType<typeof vi.fn>;
  let mapFilterTypesSignal = signal<Set<string>>(new Set(['hydro', 'eolienneparc']));
  let protectedVisibleSignal = signal<boolean>(true);
  let protectedLegendSignal = signal<boolean>(true);
  let reseauVisibleSignal = signal<boolean>(true);
  let reseauLegendSignal = signal<boolean>(true);
  let reseauBusTypesSignal = signal<Set<string>>(new Set(['Transport', 'Hydroélectrique']));
  let reseauLineTypesSignal = signal<Set<string>>(new Set(['Transport', 'Hydroélectrique']));

  let mapServiceMock: any;
  let protectedServiceMock: any;
  let reseauServiceMock: any;

  beforeEach(() => {
    httpGetMock = vi.fn((url: string, config?: any) => {
      if (url.endsWith('/meteo/wind-map/years')) {
        return of({ years: [2015, 2024], default_year: 2024 });
      }
      if (url.endsWith('/meteo/wind-map/annual')) {
        const requestedYear = Number(config?.params?.year ?? 2024);
        return of({
          year: requestedYear,
          metric: 'vitesse_vent_kmh_mean',
          cells: [{ latitude: 45, longitude: -73, mean_wind_kmh: 20 }],
          grid: { lat_step_deg: 1.5, lon_step_deg: 1.5, lat_half_step_deg: 0.75, lon_half_step_deg: 0.75 },
          value_range: { min: 10, max: 30 },
        });
      }
      return of(null);
    });

    mapFilterTypesSignal = signal<Set<string>>(new Set(['hydro', 'eolienneparc']));
    protectedVisibleSignal = signal<boolean>(true);
    protectedLegendSignal = signal<boolean>(true);
    reseauVisibleSignal = signal<boolean>(true);
    reseauLegendSignal = signal<boolean>(true);
    reseauBusTypesSignal = signal<Set<string>>(new Set(['Transport', 'Hydroélectrique']));
    reseauLineTypesSignal = signal<Set<string>>(new Set(['Transport', 'Hydroélectrique']));

    mapServiceMock = {
      mapFilterTypes: mapFilterTypesSignal,
      renderWindHeatmap: vi.fn(),
      clearWindLayer: vi.fn(),
    };

    protectedServiceMock = {
      isVisible: protectedVisibleSignal,
      legendOpen: protectedLegendSignal,
      hide: vi.fn(() => {
        protectedVisibleSignal.set(false);
        protectedLegendSignal.set(false);
      }),
      show: vi.fn(() => {
        protectedVisibleSignal.set(true);
      }),
    };

    reseauServiceMock = {
      isVisible: reseauVisibleSignal,
      legendOpen: reseauLegendSignal,
      selectedBusTypes: reseauBusTypesSignal,
      selectedLineTypes: reseauLineTypesSignal,
      toggleVisibility: vi.fn(() => {
        const next = !reseauVisibleSignal();
        reseauVisibleSignal.set(next);
        reseauLegendSignal.set(next);
      }),
      deselectAll: vi.fn(() => {
        reseauBusTypesSignal.set(new Set());
        reseauLineTypesSignal.set(new Set());
      }),
      rebuildLayers: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        WindMapService,
        { provide: HttpClient, useValue: { get: httpGetMock } },
        { provide: MapService, useValue: mapServiceMock },
        { provide: ProtectedAreasService, useValue: protectedServiceMock },
        { provide: ReseauService, useValue: reseauServiceMock },
      ],
    });

    service = TestBed.inject(WindMapService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should enable wind mode and render annual heatmap', async () => {
    await service.enableWindMode();

    expect(service.isWindMode()).toBe(true);
    expect(service.selectedYear()).toBe(2024);
    expect(mapServiceMock.renderWindHeatmap).toHaveBeenCalledTimes(1);
    expect(mapFilterTypesSignal().size).toBe(0);
    expect(protectedServiceMock.hide).toHaveBeenCalled();
    expect(reseauServiceMock.toggleVisibility).toHaveBeenCalled();
  });

  it('should change year while wind mode is active', async () => {
    await service.enableWindMode();
    await service.setYear(2015);

    expect(service.selectedYear()).toBe(2015);
    expect(mapServiceMock.renderWindHeatmap).toHaveBeenCalledTimes(2);
  });

  it('should restore previous layer states on disable', async () => {
    await service.enableWindMode();
    service.disableWindMode();

    expect(service.isWindMode()).toBe(false);
    expect(mapServiceMock.clearWindLayer).toHaveBeenCalled();
    expect([...mapFilterTypesSignal()]).toEqual(['hydro', 'eolienneparc']);
    expect(reseauVisibleSignal()).toBe(true);
    expect(protectedVisibleSignal()).toBe(true);
  });
});
