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
    it('should start with hasSelection as false', () => {
      expect(service.hasSelection()).toBe(false);
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
    it('should return false for a layer id that is not selected by default', () => {
      const allIds = [...service.selectedLayers()];
      expect(allIds.length).toBe(0);
    });

    it('should return false for a specific layer id that is not selected', () => {
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

  describe('isLayerSelected', () => {
    it('should return true when a layer is selected', () => {
      service.selectAll();
      expect(service.isLayerSelected(100)).toBe(true);
    });

    it('should return false when a layer is not selected', () => {
      service.deselectAll();
      expect(service.isLayerSelected(100)).toBe(false);
    });
  });

  describe('toggleNode', () => {
    it('should select a leaf node when it is not selected', () => {
      service.deselectAll();
      const leafNode = { id: 100, name: 'Test' };
      service.toggleNode(leafNode);
      expect(service.isLayerSelected(100)).toBe(true);
    });

    it('should deselect a leaf node when it is selected', () => {
      service.deselectAll();
      const leafNode = { id: 100, name: 'Test' };
      service.toggleNode(leafNode);
      service.toggleNode(leafNode);
      expect(service.isLayerSelected(100)).toBe(false);
    });

    it('should select children when toggling a parent node', () => {
      service.deselectAll();
      const parentNode = { id: 200, name: 'Parent', children: [
        { id: 201, name: 'Child 1' },
        { id: 202, name: 'Child 2' },
      ]};
      service.toggleNode(parentNode);
      expect(service.isLayerSelected(200)).toBe(true);
      expect(service.isLayerSelected(201)).toBe(true);
      expect(service.isLayerSelected(202)).toBe(true);
    });
  });

  describe('isGroupFullySelected', () => {
    it('should return false when no layers are selected', () => {
      service.deselectAll();
      const node = { id: 100, name: 'Test' };
      expect(service.isGroupFullySelected(node)).toBe(false);
    });

    it('should return true when a leaf node is selected', () => {
      service.deselectAll();
      const node = { id: 100, name: 'Test' };
      service.toggleNode(node);
      expect(service.isGroupFullySelected(node)).toBe(true);
    });

    it('should return false when only some children are selected', () => {
      service.deselectAll();
      const parent = { id: 200, name: 'Parent', children: [
        { id: 201, name: 'Child 1' },
        { id: 202, name: 'Child 2' },
      ]};
      service.toggleNode({ id: 201, name: 'Child 1' });
      expect(service.isGroupFullySelected(parent)).toBe(false);
    });
  });

  describe('isGroupPartiallySelected', () => {
    it('should return false for a leaf node', () => {
      service.deselectAll();
      const node = { id: 100, name: 'Test' };
      expect(service.isGroupPartiallySelected(node)).toBe(false);
    });

    it('should return true when some but not all children are selected', () => {
      service.deselectAll();
      const parent = { id: 200, name: 'Parent', children: [
        { id: 201, name: 'Child 1' },
        { id: 202, name: 'Child 2' },
      ]};
      service.toggleNode({ id: 201, name: 'Child 1' });
      expect(service.isGroupPartiallySelected(parent)).toBe(true);
    });

    it('should return false when no children are selected', () => {
      service.deselectAll();
      const parent = { id: 200, name: 'Parent', children: [
        { id: 201, name: 'Child 1' },
        { id: 202, name: 'Child 2' },
      ]};
      expect(service.isGroupPartiallySelected(parent)).toBe(false);
    });
  });

  describe('toggleVisibility', () => {
    it('should deselect all when layers are selected', () => {
      service.selectAll();
      service.toggleVisibility();
      expect(service.hasSelection()).toBe(false);
    });

    it('should restore previous selection when toggling back on', () => {
      service.selectAll();
      service.toggleVisibility(); // deselect all
      service.toggleVisibility(); // restore
      expect(service.hasSelection()).toBe(true);
    });

    it('should call selectAll when no previous selection and toggling on', () => {
      service.deselectAll();
      service.toggleVisibility();
      expect(service.hasSelection()).toBe(true);
    });
  });

  describe('show / hide', () => {
    it('show should call selectAll when no layers are selected', () => {
      service.deselectAll();
      service.show();
      expect(service.hasSelection()).toBe(true);
    });

    it('show should not change selection when layers are already selected', () => {
      service.selectAll();
      const sizeBefore = service.selectedLayers().size;
      service.show();
      expect(service.selectedLayers().size).toBe(sizeBefore);
    });

    it('hide should deselect all layers', () => {
      service.selectAll();
      service.hide();
      expect(service.hasSelection()).toBe(false);
    });
  });

  describe('hasSelection computed', () => {
    it('should be true when any layer is selected', () => {
      service.deselectAll();
      service.toggleNode({ id: 1, name: 'Test' });
      expect(service.hasSelection()).toBe(true);
    });

    it('should be false when no layers are selected', () => {
      service.deselectAll();
      expect(service.hasSelection()).toBe(false);
    });
  });
});
