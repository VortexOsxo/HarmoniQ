vi.mock('plotly.js-dist-min', () => ({
  default: {
    newPlot: vi.fn(),
    purge: vi.fn(),
    downloadImage: vi.fn(),
  },
  newPlot: vi.fn(),
  purge: vi.fn(),
  downloadImage: vi.fn(),
}));

import { GraphService } from './graph-service';

const MOCK_X_DATES = [
  '2035-01-01T00:00:00',
  '2035-01-01T06:00:00',
  '2035-01-02T00:00:00',
  '2035-01-08T00:00:00',
  '2035-02-01T00:00:00',
];
const MOCK_Y_VALUES = [100, 200, 150, 300, 250];

describe('GraphService', () => {
  let service: GraphService;

  beforeEach(() => {
    service = new GraphService();
  });

  afterEach(() => vi.clearAllMocks());

  describe('hexToRgba', () => {
    it('should convert a valid hex color to rgba with the given alpha', () => {
      const result = service.hexToRgba('#3498db', 0.1);
      expect(result).toBe('rgba(52, 152, 219, 0.1)');
    });

    it('should handle uppercase hex correctly', () => {
      const result = service.hexToRgba('#FF0000', 1);
      expect(result).toBe('rgba(255, 0, 0, 1)');
    });

    it('should return a fallback rgba string on invalid hex input', () => {
      const result = service.hexToRgba('not-a-hex', 0.5);
      expect(result).toContain('rgba');
    });
  });

  describe('aggregateData', () => {
    it('should group data by day for daily granularity', () => {
      const result = service.aggregateData(MOCK_X_DATES, MOCK_Y_VALUES, 'daily');

      expect(result.x).toContain('2035-01-01');
      expect(result.x).toContain('2035-01-02');
      expect(result.x).toContain('2035-01-08');
      expect(result.x).toContain('2035-02-01');
    });

    it('should average values within each daily group', () => {
      const x = ['2035-01-01T00:00:00', '2035-01-01T12:00:00'];
      const y = [100, 200];

      const result = service.aggregateData(x, y, 'daily');

      expect(result.y[0]).toBe(150);
    });

    it('should group data by YYYY-MM for monthly granularity', () => {
      const result = service.aggregateData(MOCK_X_DATES, MOCK_Y_VALUES, 'monthly');

      expect(result.x).toContain('2035-01');
      expect(result.x).toContain('2035-02');
    });

    it('should group data into weeks starting on Sunday', () => {
      const result = service.aggregateData(MOCK_X_DATES, MOCK_Y_VALUES, 'weekly');

      expect(result.x.length).toBeGreaterThan(0);
      expect(result.y.length).toBe(result.x.length);
    });

    it('should skip entries with invalid date strings', () => {
      const x = ['invalid-date', '2035-01-01T00:00:00'];
      const y = [999, 100];

      const result = service.aggregateData(x, y, 'daily');

      expect(result.x).toContain('2035-01-01');
      expect(result.x).not.toContain('invalid-date');
    });

    it('should return sorted keys', () => {
      const result = service.aggregateData(MOCK_X_DATES, MOCK_Y_VALUES, 'monthly');

      const sorted = [...result.x].sort();
      expect(result.x).toEqual(sorted);
    });
  });

  describe('getStandardLayout', () => {
    it('should include title, xaxis, and yaxis properties', () => {
      const layout = service.getStandardLayout('Test Title', 'Y Label', 'original');

      expect(layout.title).toBeDefined();
      expect(layout.xaxis).toBeDefined();
      expect(layout.yaxis).toBeDefined();
    });

    it('should use monthly tickformat for monthly granularity', () => {
      const layout = service.getStandardLayout('T', 'Y', 'monthly');

      expect(layout.xaxis.tickformat).toContain('%b %Y');
    });

    it('should use daily tickformat for daily granularity', () => {
      const layout = service.getStandardLayout('T', 'Y', 'daily');

      expect(layout.xaxis.tickformat).toContain('%d %b %Y');
    });

    it('should merge extra overrides', () => {
      const layout = service.getStandardLayout('T', 'Y', 'original', { height: 800 });

      expect((layout as any).height).toBe(800);
    });
  });

  describe('getStandardTrace', () => {
    it('should return a scatter trace with the provided name and data', () => {
      const trace = service.getStandardTrace('My Trace', [1, 2, 3], [10, 20, 30], '#ff0000');

      expect(trace.type).toBe('scatter');
      expect(trace.name).toBe('My Trace');
      expect(trace.x).toEqual([1, 2, 3]);
      expect(trace.y).toEqual([10, 20, 30]);
    });

    it('should set the line color to the provided hex color', () => {
      const trace = service.getStandardTrace('T', [], [], '#3498db');

      expect(trace.line.color).toBe('#3498db');
    });

    it('should set fillcolor to an rgba version of the hex color', () => {
      const trace = service.getStandardTrace('T', [], [], '#3498db');

      expect(trace.fillcolor).toMatch(/^rgba/);
    });

    it('should use the provided hovertemplate when given', () => {
      const trace = service.getStandardTrace('T', [], [], '#000', 'custom-template');

      expect(trace.hovertemplate).toBe('custom-template');
    });
  });

  describe('generateProductionSingleInfraGraph', () => {
    beforeEach(() => {
      const el = document.createElement('div');
      el.id = 'production-single-infra-id';
      document.body.appendChild(el);
    });

    afterEach(() => {
      document.getElementById('production-single-infra-id')?.remove();
    });

    it('should complete without error for eolienneparc type', () => {
      const data = { tempsdate: { 0: '2035-01-01' }, puissance: { 0: 100 } };
      expect(() => service.generateProductionSingleInfraGraph('eolienneparc', data)).not.toThrow();
    });

    it('should complete without error for thermique type', () => {
      const data = { production_mwh: { '2035-01-01': 50 } };
      expect(() => service.generateProductionSingleInfraGraph('thermique', data)).not.toThrow();
    });

    it('should complete without error for solaire type', () => {
      const data = { production: { '2035-01-01': 75 } };
      expect(() => service.generateProductionSingleInfraGraph('solaire', data)).not.toThrow();
    });
  });

  describe('downloadGraph', () => {
    beforeEach(() => {
      const el = document.createElement('div');
      el.id = 'my-graph-id';
      document.body.appendChild(el);
    });

    afterEach(() => {
      document.getElementById('my-graph-id')?.remove();
    });

    it('should complete without error for a valid graph id', () => {
      expect(() => service.downloadGraph('my-graph-id')).not.toThrow();
    });
  });
});
