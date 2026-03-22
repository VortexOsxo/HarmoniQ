vi.mock('leaflet', () => ({
  default: {
    icon: vi.fn().mockReturnValue({}),
    map: vi.fn().mockReturnValue({}),
    marker: vi.fn().mockReturnValue({ addTo: vi.fn(), setIcon: vi.fn(), on: vi.fn() }),
  },
  icon: vi.fn().mockReturnValue({}),
  map: vi.fn().mockReturnValue({}),
  marker: vi.fn().mockReturnValue({ addTo: vi.fn(), setIcon: vi.fn(), on: vi.fn() }),
}));

import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { InfraDetailService } from './infra-detail-service';
import { InfrastruturesService } from './infrastrutures-service';

const MOCK_HYDRO_INFRA = {
  id: 42,
  nom: 'Barrage Test',
  latitude: 45.5,
  longitude: -73.5,
  isUserCreated: false,
};

const MOCK_WIND_INFRA = {
  id: 10,
  nom: 'Parc Éolien Test',
  latitude: 46.0,
  longitude: -72.0,
  isUserCreated: false,
};

describe('InfraDetailService', () => {
  let service: InfraDetailService;
  let mockInfrasService: { getInfrasSignalByType: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockInfrasService = {
      getInfrasSignalByType: vi.fn().mockImplementation((type: string) => {
        if (type === 'hydro') return signal([MOCK_HYDRO_INFRA]);
        if (type === 'eolienneparc') return signal([MOCK_WIND_INFRA]);
        return signal([]);
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        InfraDetailService,
        { provide: InfrastruturesService, useValue: mockInfrasService },
      ],
    });

    service = TestBed.inject(InfraDetailService);
  });

  afterEach(() => vi.clearAllMocks());

  describe('initial state', () => {
    it('should have isOpen() as false', () => {
      expect(service.isOpen()).toBe(false);
    });

    it('should have selectedInfra() as null', () => {
      expect(service.selectedInfra()).toBeNull();
    });
  });

  describe('openDetail', () => {
    it('should open detail and set isOpen to true when infra is found', () => {
      service.openDetail('hydro', '42');

      expect(service.isOpen()).toBe(true);
    });

    it('should set selectedInfra with type, id, and data', () => {
      service.openDetail('hydro', '42');

      const detail = service.selectedInfra();
      expect(detail?.type).toBe('hydro');
      expect(detail?.id).toBe('42');
      expect(detail?.data).toEqual(MOCK_HYDRO_INFRA);
    });

    it('should set the categoryName using prettyNames map', () => {
      service.openDetail('hydro', '42');

      expect(service.selectedInfra()?.categoryName).toBe('Barrage hydroélectrique');
    });

    it('should handle eolienneparc type with correct categoryName', () => {
      service.openDetail('eolienneparc', '10');

      expect(service.selectedInfra()?.categoryName).toBe('Parc éolien');
    });

    it('should do nothing when infra is not found by id', () => {
      service.openDetail('hydro', '9999');

      expect(service.isOpen()).toBe(false);
      expect(service.selectedInfra()).toBeNull();
    });

    it('should match infra id as string comparison', () => {
      service.openDetail('hydro', '42');

      expect(service.selectedInfra()).not.toBeNull();
    });
  });

  describe('closeDetail', () => {
    it('should set isOpen to false', () => {
      service.openDetail('hydro', '42');
      service.closeDetail();

      expect(service.isOpen()).toBe(false);
    });

    it('should reset selectedInfra to null', () => {
      service.openDetail('hydro', '42');
      service.closeDetail();

      expect(service.selectedInfra()).toBeNull();
    });
  });
});
