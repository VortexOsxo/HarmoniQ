import { TestBed, ComponentFixture } from '@angular/core/testing';
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
};

const mockInfraDetailService = {
  isOpen: signal(false),
  selectedInfra: signal(null),
};

describe('QuebecMap', () => {
  let component: QuebecMap;
  let fixture: ComponentFixture<QuebecMap>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuebecMap],
      providers: [
        { provide: MapService, useValue: mockMapService },
        { provide: ProtectedAreasService, useValue: mockProtectedAreasService },
        { provide: ReseauService, useValue: mockReseauService },
        { provide: InfraDetailService, useValue: mockInfraDetailService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(QuebecMap);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  it('should create the quebec map component', () => {
    expect(component).toBeTruthy();
  });

  describe('ngAfterViewInit', () => {
    it('should call mapService.createMap()', () => {
      expect(mockMapService.createMap).toHaveBeenCalled();
    });

    it('should call mapService.initMarkers()', () => {
      expect(mockMapService.initMarkers).toHaveBeenCalled();
    });

    it('should call mapService.onMapLoaded()', () => {
      expect(mockMapService.onMapLoaded).toHaveBeenCalled();
    });
  });

  describe('ngOnDestroy', () => {
    it('should call mapService.destroyMap()', () => {
      component.ngOnDestroy();
      expect(mockMapService.destroyMap).toHaveBeenCalled();
    });

    it('should call mapService.destroyMarkers()', () => {
      component.ngOnDestroy();
      expect(mockMapService.destroyMarkers).toHaveBeenCalled();
    });

    it('should call protectedAreasService.destroy()', () => {
      component.ngOnDestroy();
      expect(mockProtectedAreasService.destroy).toHaveBeenCalled();
    });

    it('should call reseauService.destroy()', () => {
      component.ngOnDestroy();
      expect(mockReseauService.destroy).toHaveBeenCalled();
    });
  });
});
