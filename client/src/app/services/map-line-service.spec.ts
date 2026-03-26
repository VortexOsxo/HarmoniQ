vi.mock('leaflet', () => {
  const leafletMock = {
    icon: vi.fn().mockReturnValue({}),
    map: vi.fn().mockReturnValue({}),
  };
  return { default: leafletMock, ...leafletMock };
});

import { MapLineService } from './map-line-service';

const CSV_HEADER = 'voltage,latitude_starting,longitude_starting,latitude_ending,longitude_ending,network_node_name_starting,network_node_name_ending';
const CSV_LINE_80V = '80,45.5,-73.5,46.0,-72.0,NodeA,NodeB';
const CSV_LINE_220V = '220,47.0,-74.0,48.0,-75.0,NodeC,NodeD';
const MOCK_CSV = `${CSV_HEADER}\n${CSV_LINE_80V}\n${CSV_LINE_220V}`;

const createMockFetch = (csvContent: string) =>
  vi.fn().mockResolvedValue({
    ok: true,
    text: vi.fn().mockResolvedValue(csvContent),
  });

describe('MapLineService', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = createMockFetch(MOCK_CSV);
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should call fetch with the CSV file path on instantiation', () => {
      new MapLineService();

      expect(mockFetch).toHaveBeenCalledWith('/lignes_quebec.csv');
    });

    it('should initiate data loading without throwing', () => {
      expect(() => new MapLineService()).not.toThrow();
    });
  });

  describe('loadLineData', () => {
    it('should handle a failed fetch response without throwing', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 });
      const service = new MapLineService();

      await expect((service as any).loadPromise).rejects.toThrow();
    });
  });
});
