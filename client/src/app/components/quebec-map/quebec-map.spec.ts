import { render } from '@testing-library/angular';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { QuebecMap } from './quebec-map';
import { MapService } from '@app/services/map-service';
import { ProtectedAreasService } from '@app/services/protected-areas-service';
import { ReseauService } from '@app/services/reseau-service';
import { InfraDetailService } from '@app/services/infra-detail-service';

vi.mock('leaflet.markercluster', () => ({}));

vi.mock('leaflet', () => ({
  default: {
    icon: vi.fn().mockReturnValue({}),
    divIcon: vi.fn().mockReturnValue({}),
    map: vi.fn().mockReturnValue({ setView: vi.fn(), remove: vi.fn(), addLayer: vi.fn(), on: vi.fn(), invalidateSize: vi.fn() }),
    tileLayer: vi.fn().mockReturnValue({ addTo: vi.fn() }),
    layerGroup: vi.fn().mockReturnValue({ addTo: vi.fn(), clearLayers: vi.fn() }),
    geoJSON: vi.fn().mockReturnValue({ addTo: vi.fn() }),
    marker: vi.fn().mockReturnValue({ addTo: vi.fn(), remove: vi.fn() }),
    DomUtil: { create: vi.fn().mockReturnValue({ style: {} }) },
  },
  icon: vi.fn().mockReturnValue({}),
  divIcon: vi.fn().mockReturnValue({}),
  map: vi.fn().mockReturnValue({ setView: vi.fn(), remove: vi.fn(), addLayer: vi.fn(), on: vi.fn(), invalidateSize: vi.fn() }),
  tileLayer: vi.fn().mockReturnValue({ addTo: vi.fn() }),
  layerGroup: vi.fn().mockReturnValue({ addTo: vi.fn(), clearLayers: vi.fn() }),
  geoJSON: vi.fn().mockReturnValue({ addTo: vi.fn() }),
  marker: vi.fn().mockReturnValue({ addTo: vi.fn(), remove: vi.fn() }),
  DomUtil: { create: vi.fn().mockReturnValue({ style: {} }) },
}));

const mockMapService = {
  map: null,
  createMap: vi.fn(),
  initMarkers: vi.fn(),
  destroyMap: vi.fn(),
  destroyMarkers: vi.fn(),
  onMapLoaded: vi.fn(),
  mapFilterName: signal(''),
  mapFilterTypes: signal(new Set(['hydro', 'eolienneparc', 'solaire', 'thermique', 'nucleaire'])),
  mapFilterMinPower: signal<number | null>(null),
  mapFilterMaxPower: signal<number | null>(null),
};

const mockProtectedAreasService = {
  initLayer: vi.fn(),
  destroy: vi.fn(),
  isVisible: signal(false),
  legendOpen: signal(false),
  selectAll: vi.fn(),
  deselectAll: vi.fn(),
  hide: vi.fn(),
};

const mockReseauService = {
  initLayer: vi.fn(),
  destroy: vi.fn(),
  isVisible: signal(false),
  legendOpen: signal(false),
  busTypes: signal([] as string[]),
  lineTypes: signal([] as string[]),
  toggleBusType: vi.fn(),
  toggleLineType: vi.fn(),
  isBusGroupSelected: vi.fn().mockReturnValue(true),
  toggleBusGroup: vi.fn(),
  selectAll: vi.fn(),
  deselectAll: vi.fn(),
  summaryOpen: signal(false),
  newConnections: signal([] as any[]),
  hasPendingInfras: signal(false),
  pendingInfras: signal([] as any[]),
  clearNewConnections: vi.fn(),
  closeSummary: vi.fn(),
  flyToInfra: vi.fn(),
  connectNewInfras: vi.fn(),
  isBusTypeSelected: vi.fn().mockReturnValue(true),
  isLineGroupSelected: vi.fn().mockReturnValue(true),
  toggleLineGroup: vi.fn(),
  isLineTypeSelected: vi.fn().mockReturnValue(true),
};

const mockInfraDetailService = {
  isOpen: signal(false),
  selectedInfra: signal(null),
};

async function renderComponent() {
  return render(QuebecMap, {
    providers: [
      { provide: MapService, useValue: mockMapService },
      { provide: ProtectedAreasService, useValue: mockProtectedAreasService },
      { provide: ReseauService, useValue: mockReseauService },
      { provide: InfraDetailService, useValue: mockInfraDetailService },
    ],
    schemas: [NO_ERRORS_SCHEMA],
  });
}

describe('QuebecMap', () => {
  afterEach(() => vi.clearAllMocks());

  it('should render the quebec map component', async () => {
    const { container } = await renderComponent();
    expect(container).toBeTruthy();
  });

  describe('ngAfterViewInit', () => {
    it('should call mapService.createMap()', async () => {
      await renderComponent();
      expect(mockMapService.createMap).toHaveBeenCalled();
    });

    it('should call mapService.initMarkers()', async () => {
      await renderComponent();
      expect(mockMapService.initMarkers).toHaveBeenCalled();
    });

    it('should call mapService.onMapLoaded()', async () => {
      await renderComponent();
      expect(mockMapService.onMapLoaded).toHaveBeenCalled();
    });
  });

  describe('ngOnDestroy', () => {
    it('should call mapService.destroyMap() on destroy', async () => {
      const { fixture } = await renderComponent();
      fixture.destroy();
      expect(mockMapService.destroyMap).toHaveBeenCalled();
    });

    it('should call mapService.destroyMarkers() on destroy', async () => {
      const { fixture } = await renderComponent();
      fixture.destroy();
      expect(mockMapService.destroyMarkers).toHaveBeenCalled();
    });

    it('should call protectedAreasService.destroy() on destroy', async () => {
      const { fixture } = await renderComponent();
      fixture.destroy();
      expect(mockProtectedAreasService.destroy).toHaveBeenCalled();
    });

    it('should call reseauService.destroy() on destroy', async () => {
      const { fixture } = await renderComponent();
      fixture.destroy();
      expect(mockReseauService.destroy).toHaveBeenCalled();
    });
  });
});
