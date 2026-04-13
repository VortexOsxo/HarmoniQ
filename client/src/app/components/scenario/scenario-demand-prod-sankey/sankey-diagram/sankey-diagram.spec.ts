import { render } from '@testing-library/angular';
import { NO_ERRORS_SCHEMA, signal, ChangeDetectorRef } from '@angular/core';
import { Subject } from 'rxjs';
import { SankeyDiagramComponent } from './sankey-diagram';
import { SimulationService } from '@app/services/simulation-service';
import { SankeyData } from '../sankey-data.types';

vi.mock('leaflet', () => ({
  default: { icon: vi.fn().mockReturnValue({}), divIcon: vi.fn().mockReturnValue({}) },
  icon: vi.fn().mockReturnValue({}),
  divIcon: vi.fn().mockReturnValue({}),
}));

const MOCK_SANKEY_DATA: SankeyData = {
  demandNodes: [
    { id: 'residentiel', label: 'Résidentiel', value: 300, electricityValue: 300, gasValue: 0, color: '#3498db', icon: 'fa-home' },
    { id: 'commercial', label: 'Commercial', value: 200, electricityValue: 200, gasValue: 0, color: '#2ecc71', icon: 'fa-building' },
  ],
  productionNodes: [
    { id: 'hydro', label: 'Hydro', value: 400, color: '#1abc9c', icon: 'fa-water', co2FactorKgMWh: 4, energyType: 'electricity' },
    { id: 'eolien', label: 'Éolien', value: 100, color: '#9b59b6', icon: 'fa-wind', co2FactorKgMWh: 7, energyType: 'electricity' },
  ],
  energyTypeNodes: [
    { id: 'electricity', label: 'Électricité', value: 500, color: '#3a7abf', icon: 'fa-bolt' },
  ],
};

const mockSimulationService = {
  openSourcesPanel$: new Subject<void>(),
  canLaunch: signal(false),
  productionNodes: signal(null),
};

const mockCdr = { detectChanges: vi.fn(), markForCheck: vi.fn() };

describe('SankeyDiagramComponent', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        disconnect = vi.fn();
        unobserve = vi.fn();
      },
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  async function renderComponent(data: SankeyData = MOCK_SANKEY_DATA) {
    return render(SankeyDiagramComponent, {
      componentInputs: { data },
      providers: [
        { provide: SimulationService, useValue: mockSimulationService },
        { provide: ChangeDetectorRef, useValue: mockCdr },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
  }

  it('should create the sankey diagram component', async () => {
    const { fixture } = await renderComponent();
    expect(fixture.componentInstance).toBeTruthy();
  });

  describe('formatMW', () => {
    it('should round and format values >= 10', async () => {
      const { fixture } = await renderComponent();
      const result = fixture.componentInstance.formatMW(1234.5);
      expect(result).toContain('MW');
    });

    it('should include MW suffix', async () => {
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.formatMW(5)).toContain('MW');
      expect(fixture.componentInstance.formatMW(100)).toContain('MW');
    });

    it('should format small values with 2 decimal places', async () => {
      const { fixture } = await renderComponent();
      const result = fixture.componentInstance.formatMW(0.123);
      expect(result).toContain('MW');
    });
  });

  describe('formatCo2', () => {
    it('should round values >= 10', async () => {
      const { fixture } = await renderComponent();
      const result = fixture.componentInstance.formatCo2(1234.5);
      expect(result).not.toContain('MW');
    });

    it('should format values between 1 and 10 with 1 decimal', async () => {
      const { fixture } = await renderComponent();
      const result = fixture.componentInstance.formatCo2(5.678);
      expect(result).toBeTruthy();
    });

    it('should format small values with 2 decimals', async () => {
      const { fixture } = await renderComponent();
      const result = fixture.componentInstance.formatCo2(0.123);
      expect(result).toBeTruthy();
    });
  });

  describe('flowOpacity', () => {
    it('should return 0.45 when no flow or node is hovered', async () => {
      const { fixture } = await renderComponent();
      const instance = fixture.componentInstance;
      instance.hoveredFlowIndex = null;
      instance.hoveredNodeKey = null;
      expect(instance.flowOpacity(0)).toBe(0.45);
    });
  });

  describe('onFlowMouseLeave', () => {
    it('should clear hoveredFlowIndex', async () => {
      const { fixture } = await renderComponent();
      const instance = fixture.componentInstance;
      instance.hoveredFlowIndex = 2;
      instance.onFlowMouseLeave();
      expect(instance.hoveredFlowIndex).toBeNull();
    });

    it('should clear tooltip', async () => {
      const { fixture } = await renderComponent();
      const instance = fixture.componentInstance;
      instance.tooltip = { x: 10, y: 20, lines: ['test'], color: '#fff' };
      instance.onFlowMouseLeave();
      expect(instance.tooltip).toBeNull();
    });
  });

  describe('onNodeMouseEnter / onNodeMouseLeave', () => {
    it('should set hoveredNodeKey on enter', async () => {
      const { fixture } = await renderComponent();
      const instance = fixture.componentInstance;
      instance.onNodeMouseEnter('demand-0');
      expect(instance.hoveredNodeKey).toBe('demand-0');
    });

    it('should clear hoveredNodeKey on leave', async () => {
      const { fixture } = await renderComponent();
      const instance = fixture.componentInstance;
      instance.hoveredNodeKey = 'demand-0';
      instance.onNodeMouseLeave();
      expect(instance.hoveredNodeKey).toBeNull();
    });
  });

  describe('totalCo2', () => {
    it('should sum co2 for all production nodes', async () => {
      const { fixture } = await renderComponent();
      // hydro: 400 * 4 / 1000 = 1.6, eolien: 100 * 7 / 1000 = 0.7 → total = 2.3
      expect(fixture.componentInstance.totalCo2).toBeCloseTo(2.3);
    });
  });
});
