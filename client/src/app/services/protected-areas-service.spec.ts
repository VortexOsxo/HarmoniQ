vi.mock('leaflet', () => ({
  default: {
    icon: vi.fn().mockReturnValue({}),
    map: vi.fn().mockReturnValue({}),
    tileLayer: vi.fn().mockReturnValue({ addTo: vi.fn().mockReturnThis(), off: vi.fn().mockReturnThis() }),
    popup: vi.fn().mockReturnValue({ setLatLng: vi.fn().mockReturnThis(), setContent: vi.fn().mockReturnThis(), openOn: vi.fn().mockReturnThis() }),
    Point: vi.fn().mockImplementation((x, y) => ({ x, y, add: vi.fn().mockReturnValue({ x: x + 256, y: y + 256 }), scaleBy: vi.fn().mockReturnValue({ x: x * 256, y: y * 256 }) })),
  },
  icon: vi.fn().mockReturnValue({}),
  map: vi.fn().mockReturnValue({}),
  tileLayer: vi.fn().mockReturnValue({ addTo: vi.fn().mockReturnThis(), off: vi.fn().mockReturnThis() }),
  popup: vi.fn().mockReturnValue({ setLatLng: vi.fn().mockReturnThis(), setContent: vi.fn().mockReturnThis(), openOn: vi.fn().mockReturnThis() }),
  Point: vi.fn().mockImplementation((x, y) => ({ x, y, add: vi.fn().mockReturnValue({ x: x + 256, y: y + 256 }), scaleBy: vi.fn().mockReturnValue({ x: x * 256, y: y * 256 }) })),
}));

import { TestBed } from '@angular/core/testing';
import { ProtectedAreasService } from './protected-areas-service';

const MOCK_LAT = 45.5017;
const MOCK_LNG = -73.5673;

describe('ProtectedAreasService', () => {
  let service: ProtectedAreasService;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ results: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    TestBed.configureTestingModule({
      providers: [ProtectedAreasService],
    });
    service = TestBed.inject(ProtectedAreasService);
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

    it('should have layerTree defined', () => {
      expect(service.layerTree).toBeDefined();
      expect(service.layerTree.length).toBeGreaterThan(0);
    });
  });

  describe('checkProtectedArea', () => {
    it('should return a Promise', () => {
      const result = service.checkProtectedArea(MOCK_LAT, MOCK_LNG);

      expect(result).toBeInstanceOf(Promise);
    });

    it('should cache the result for the same coordinates', () => {
      const first = service.checkProtectedAreaWithDetails(MOCK_LAT, MOCK_LNG);
      const second = service.checkProtectedAreaWithDetails(MOCK_LAT, MOCK_LNG);

      expect(first).toBe(second);
    });

    it('should make separate requests for different coordinates', () => {
      const first = service.checkProtectedAreaWithDetails(45.0, -73.0);
      const second = service.checkProtectedAreaWithDetails(46.0, -74.0);

      expect(first).not.toBe(second);
    });

    it('should return null when no protected area is found', async () => {
      const result = await service.checkProtectedArea(MOCK_LAT, MOCK_LNG);

      expect(result).toBeNull();
    });
  });

  describe('isLayerSelected', () => {
    it('should return true for layers selected by default', () => {
      const selectedLayers = service.selectedLayers();
      const firstSelectedId = [...selectedLayers][0];

      expect(service.isLayerSelected(firstSelectedId)).toBe(true);
    });

    it('should return false for a layer id that is not selected', () => {
      service.deselectAll();

      expect(service.isLayerSelected(999)).toBe(false);
    });
  });

  describe('selectAll / deselectAll', () => {
    it('should select all layers on selectAll()', () => {
      service.deselectAll();
      service.selectAll();

      expect(service.selectedLayers().size).toBeGreaterThan(0);
    });

    it('should deselect all layers on deselectAll()', () => {
      service.deselectAll();

      expect(service.selectedLayers().size).toBe(0);
    });
  });
});
