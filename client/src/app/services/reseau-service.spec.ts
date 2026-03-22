vi.mock('leaflet', () => ({
  default: {
    icon: vi.fn().mockReturnValue({}),
    map: vi.fn().mockReturnValue({}),
    circleMarker: vi.fn().mockReturnValue({ bindPopup: vi.fn().mockReturnThis(), addTo: vi.fn().mockReturnThis(), setStyle: vi.fn().mockReturnThis() }),
    polyline: vi.fn().mockReturnValue({ bindPopup: vi.fn().mockReturnThis(), addTo: vi.fn().mockReturnThis(), setStyle: vi.fn().mockReturnThis() }),
  },
  icon: vi.fn().mockReturnValue({}),
  map: vi.fn().mockReturnValue({}),
  circleMarker: vi.fn().mockReturnValue({ bindPopup: vi.fn().mockReturnThis(), addTo: vi.fn().mockReturnThis(), setStyle: vi.fn().mockReturnThis() }),
  polyline: vi.fn().mockReturnValue({ bindPopup: vi.fn().mockReturnThis(), addTo: vi.fn().mockReturnThis(), setStyle: vi.fn().mockReturnThis() }),
}));

import { TestBed } from '@angular/core/testing';
import { ReseauService, BUS_CATEGORIES, LINE_CATEGORIES } from './reseau-service';

describe('ReseauService', () => {
  let service: ReseauService;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([]),
    });
    vi.stubGlobal('fetch', mockFetch);

    TestBed.configureTestingModule({
      providers: [ReseauService],
    });
    service = TestBed.inject(ReseauService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should start with isVisible as false', () => {
      expect(service.isVisible()).toBe(false);
    });

    it('should start with legendOpen as false', () => {
      expect(service.legendOpen()).toBe(false);
    });

    it('should have all bus categories selected by default', () => {
      BUS_CATEGORIES.forEach(cat => {
        expect(service.isBusTypeSelected(cat.key)).toBe(true);
      });
    });

    it('should have all line categories selected by default', () => {
      LINE_CATEGORIES.forEach(cat => {
        expect(service.isLineTypeSelected(cat.key)).toBe(true);
      });
    });
  });

  describe('toggleVisibility', () => {
    it('should toggle isVisible from false to true', () => {
      service.toggleVisibility();

      expect(service.isVisible()).toBe(true);
    });

    it('should open legend when toggling visible on', () => {
      service.toggleVisibility();

      expect(service.legendOpen()).toBe(true);
    });

    it('should toggle isVisible from true to false on second call', () => {
      service.toggleVisibility();
      service.toggleVisibility();

      expect(service.isVisible()).toBe(false);
    });

    it('should close legend when toggling visible off', () => {
      service.toggleVisibility();
      service.toggleVisibility();

      expect(service.legendOpen()).toBe(false);
    });
  });

  describe('toggleBusType', () => {
    it('should remove a bus type that was previously selected', () => {
      service.toggleBusType('Transport');

      expect(service.isBusTypeSelected('Transport')).toBe(false);
    });

    it('should add a bus type that was previously deselected', () => {
      service.toggleBusType('Transport');
      service.toggleBusType('Transport');

      expect(service.isBusTypeSelected('Transport')).toBe(true);
    });
  });

  describe('toggleLineType', () => {
    it('should remove a line type that was previously selected', () => {
      service.toggleLineType('Éoliennes');

      expect(service.isLineTypeSelected('Éoliennes')).toBe(false);
    });

    it('should add a line type that was previously deselected', () => {
      service.toggleLineType('Éoliennes');
      service.toggleLineType('Éoliennes');

      expect(service.isLineTypeSelected('Éoliennes')).toBe(true);
    });
  });

  describe('selectAll', () => {
    it('should select all bus types', () => {
      service.toggleBusType('Transport');
      service.selectAll();

      BUS_CATEGORIES.forEach(cat => {
        expect(service.isBusTypeSelected(cat.key)).toBe(true);
      });
    });

    it('should select all line types', () => {
      service.toggleLineType('Éoliennes');
      service.selectAll();

      LINE_CATEGORIES.forEach(cat => {
        expect(service.isLineTypeSelected(cat.key)).toBe(true);
      });
    });
  });

  describe('deselectAll', () => {
    it('should deselect all bus types', () => {
      service.deselectAll();

      BUS_CATEGORIES.forEach(cat => {
        expect(service.isBusTypeSelected(cat.key)).toBe(false);
      });
    });

    it('should deselect all line types', () => {
      service.deselectAll();

      LINE_CATEGORIES.forEach(cat => {
        expect(service.isLineTypeSelected(cat.key)).toBe(false);
      });
    });
  });

  describe('isBusGroupSelected', () => {
    it('should return true when all bus categories are selected', () => {
      expect(service.isBusGroupSelected()).toBe(true);
    });

    it('should return false when any bus category is deselected', () => {
      service.toggleBusType('Transport');

      expect(service.isBusGroupSelected()).toBe(false);
    });
  });

  describe('toggleBusGroup', () => {
    it('should deselect all bus types when all are selected', () => {
      service.toggleBusGroup();

      expect(service.isBusGroupSelected()).toBe(false);
    });

    it('should select all bus types when not all are selected', () => {
      service.toggleBusType('Transport');
      service.toggleBusGroup();

      expect(service.isBusGroupSelected()).toBe(true);
    });
  });
});
