vi.mock('leaflet', () => ({
  default: {
    icon: vi.fn().mockReturnValue({}),
    map: vi.fn().mockReturnValue({}),
    marker: vi.fn().mockReturnValue({ addTo: vi.fn(), setIcon: vi.fn(), on: vi.fn(), off: vi.fn(), remove: vi.fn() }),
    markerClusterGroup: vi.fn().mockReturnValue({ addLayer: vi.fn(), addTo: vi.fn() }),
    tileLayer: vi.fn().mockReturnValue({ addTo: vi.fn() }),
    circleMarker: vi.fn().mockReturnValue({ addTo: vi.fn(), bindPopup: vi.fn().mockReturnThis(), setStyle: vi.fn() }),
    polyline: vi.fn().mockReturnValue({ addTo: vi.fn(), bindPopup: vi.fn().mockReturnThis(), setStyle: vi.fn() }),
    popup: vi.fn().mockReturnValue({ setLatLng: vi.fn().mockReturnThis(), setContent: vi.fn().mockReturnThis(), openOn: vi.fn() }),
    Point: vi.fn().mockImplementation((x, y) => ({ x, y, add: vi.fn(), scaleBy: vi.fn() })),
    tileLayer_wms: vi.fn().mockReturnValue({ addTo: vi.fn() }),
  },
  icon: vi.fn().mockReturnValue({}),
  map: vi.fn().mockReturnValue({}),
  marker: vi.fn().mockReturnValue({ addTo: vi.fn(), setIcon: vi.fn(), on: vi.fn(), off: vi.fn(), remove: vi.fn() }),
  markerClusterGroup: vi.fn().mockReturnValue({ addLayer: vi.fn(), addTo: vi.fn() }),
  tileLayer: vi.fn().mockReturnValue({ addTo: vi.fn() }),
  circleMarker: vi.fn().mockReturnValue({ addTo: vi.fn(), bindPopup: vi.fn().mockReturnThis(), setStyle: vi.fn() }),
  polyline: vi.fn().mockReturnValue({ addTo: vi.fn(), bindPopup: vi.fn().mockReturnThis(), setStyle: vi.fn() }),
  popup: vi.fn().mockReturnValue({ setLatLng: vi.fn().mockReturnThis(), setContent: vi.fn().mockReturnThis(), openOn: vi.fn() }),
  Point: vi.fn().mockImplementation((x, y) => ({ x, y, add: vi.fn(), scaleBy: vi.fn() })),
  tileLayer_wms: vi.fn().mockReturnValue({ addTo: vi.fn() }),
}));

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { InfrastruturesService } from './infrastrutures-service';
import { OpenApiService } from './open-api-service';
import { LocalStorageService } from './local-storage-service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { InfrastructureGroup } from '@app/models/infrastructure-group';

const INFRA_TYPES = ['hydro', 'eolienneparc', 'solaire', 'thermique', 'nucleaire'];
const API_BASE = 'http://localhost:5000/api';

const MOCK_INFRA_GROUP: InfrastructureGroup = {
  id: 100,
  nom: 'Groupe Test',
  parc_eoliens: ['1'],
  parc_solaires: [],
  central_hydroelectriques: ['2'],
  central_thermique: [],
  central_nucleaire: [],
};

describe('InfrastruturesService', () => {
  let service: InfrastruturesService;
  let httpMock: HttpTestingController;
  let mockOpenApiService: Partial<OpenApiService>;
  let mockStorageService: Partial<LocalStorageService>;
  let mockModalService: Partial<NgbModal>;

  const flushInitialHttpRequests = () => {
    INFRA_TYPES.forEach(type => {
      httpMock.expectOne(`${API_BASE}/${type}`).flush([]);
    });
  };

  beforeEach(() => {
    mockOpenApiService = { getOpenApiSchemas: vi.fn().mockReturnValue({}) };
    mockStorageService = {
      loadElements: vi.fn().mockReturnValue([]),
      createElement: vi.fn().mockImplementation((_key: string, el: any) => ({ ...el, id: 100 })),
      updateElement: vi.fn(),
      deleteElement: vi.fn(),
    };
    mockModalService = {
      open: vi.fn().mockReturnValue({
        componentInstance: {},
        result: Promise.resolve(null),
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        InfrastruturesService,
        { provide: OpenApiService, useValue: mockOpenApiService },
        { provide: LocalStorageService, useValue: mockStorageService },
        { provide: NgbModal, useValue: mockModalService },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(InfrastruturesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should make HTTP GET requests for all 5 infrastructure types on init', () => {
      INFRA_TYPES.forEach(type => {
        const req = httpMock.expectOne(`${API_BASE}/${type}`);
        expect(req.request.method).toBe('GET');
        req.flush([]);
      });
    });

    it('should load infrastructure groups from storage on init', () => {
      flushInitialHttpRequests();

      expect(mockStorageService.loadElements).toHaveBeenCalledWith('harmoniq_local_infra_groups');
    });
  });

  describe('getInfrasSignalByType', () => {
    it('should return a signal for a valid infra type', () => {
      flushInitialHttpRequests();

      const result = service.getInfrasSignalByType('hydro');
      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });

    it('should return an empty signal for an unknown type', () => {
      flushInitialHttpRequests();

      const result = service.getInfrasSignalByType('unknown');
      expect(result()).toEqual([]);
    });
  });

  describe('isInfraSelected', () => {
    it('should return false when no infrastructure group is selected', () => {
      flushInitialHttpRequests();

      expect(service.isInfraSelected('hydro', '1')).toBe(false);
    });

    it('should return true when infra id is in the selected group', () => {
      flushInitialHttpRequests();
      service.selectedInfraGroup.set(MOCK_INFRA_GROUP);

      expect(service.isInfraSelected('eolienneparc', '1')).toBe(true);
    });

    it('should return false when infra id is not in the selected group', () => {
      flushInitialHttpRequests();
      service.selectedInfraGroup.set(MOCK_INFRA_GROUP);

      expect(service.isInfraSelected('eolienneparc', '999')).toBe(false);
    });
  });

  describe('toggleInfra', () => {
    it('should add infra to the group when not selected', () => {
      flushInitialHttpRequests();
      service.selectedInfraGroup.set({ ...MOCK_INFRA_GROUP, parc_eoliens: [] });

      service.toggleInfra('eolienneparc', '5');

      expect(service.selectedInfraGroup()?.parc_eoliens).toContain('5');
    });

    it('should remove infra from the group when already selected', () => {
      flushInitialHttpRequests();
      service.selectedInfraGroup.set({ ...MOCK_INFRA_GROUP, parc_eoliens: ['5'] });

      service.toggleInfra('eolienneparc', '5');

      expect(service.selectedInfraGroup()?.parc_eoliens).not.toContain('5');
    });

    it('should do nothing when no group is selected', () => {
      flushInitialHttpRequests();

      expect(() => service.toggleInfra('eolienneparc', '5')).not.toThrow();
    });
  });

  describe('createInfraGroup', () => {
    it('should persist the new group to storage', () => {
      flushInitialHttpRequests();
      const newGroup: InfrastructureGroup = {
        id: 0, nom: 'New Group',
        parc_eoliens: [], parc_solaires: [],
        central_hydroelectriques: [], central_thermique: [], central_nucleaire: [],
      };

      service.createInfraGroup(newGroup);

      expect(mockStorageService.createElement).toHaveBeenCalledWith('harmoniq_local_infra_groups', newGroup);
    });

    it('should set the newly created group as selected', () => {
      flushInitialHttpRequests();
      const newGroup: InfrastructureGroup = {
        id: 0, nom: 'New Group',
        parc_eoliens: [], parc_solaires: [],
        central_hydroelectriques: [], central_thermique: [], central_nucleaire: [],
      };

      service.createInfraGroup(newGroup);

      expect(service.selectedInfraGroup()?.nom).toBe('New Group');
    });
  });

  describe('deleteInfraGroup', () => {
    it('should remove the group from storage and local state', () => {
      flushInitialHttpRequests();
      (mockStorageService.loadElements as ReturnType<typeof vi.fn>).mockReturnValue([MOCK_INFRA_GROUP]);
      service.refreshInfraGroups();

      service.deleteInfraGroup(MOCK_INFRA_GROUP);

      expect(mockStorageService.deleteElement).toHaveBeenCalledWith('harmoniq_local_infra_groups', MOCK_INFRA_GROUP.id);
    });

    it('should clear selectedInfraGroup when the selected group is deleted', () => {
      flushInitialHttpRequests();
      (mockStorageService.loadElements as ReturnType<typeof vi.fn>).mockReturnValue([MOCK_INFRA_GROUP]);
      service.refreshInfraGroups();
      service.selectedInfraGroup.set(MOCK_INFRA_GROUP);

      service.deleteInfraGroup(MOCK_INFRA_GROUP);

      expect(service.selectedInfraGroup()).toBeNull();
    });
  });

  describe('buildSimulationPayload', () => {
    it('should return null when no group is selected', () => {
      flushInitialHttpRequests();

      expect(service.buildSimulationPayload()).toBeNull();
    });

    it('should return a payload with the group nom when a group is selected', () => {
      flushInitialHttpRequests();
      service.selectedInfraGroup.set(MOCK_INFRA_GROUP);

      const payload = service.buildSimulationPayload();

      expect(payload?.nom).toBe(MOCK_INFRA_GROUP.nom);
    });
  });
});
