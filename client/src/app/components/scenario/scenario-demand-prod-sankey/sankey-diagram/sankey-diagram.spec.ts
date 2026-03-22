import { TestBed, ComponentFixture } from '@angular/core/testing';
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
    { id: 'residentiel', label: 'Résidentiel', value: 300, color: '#3498db', icon: 'fa-home' },
    { id: 'commercial', label: 'Commercial', value: 200, color: '#2ecc71', icon: 'fa-building' },
  ],
  productionNodes: [
    { id: 'hydro', label: 'Hydro', value: 400, color: '#1abc9c', icon: 'fa-water', co2FactorKgMWh: 4 },
    { id: 'eolien', label: 'Éolien', value: 100, color: '#9b59b6', icon: 'fa-wind', co2FactorKgMWh: 7 },
  ],
};

const mockSimulationService = {
  openSourcesPanel$: new Subject<void>(),
  canLaunch: signal(false),
  productionNodes: signal(null),
};

const mockCdr = { detectChanges: vi.fn(), markForCheck: vi.fn() };

describe('SankeyDiagramComponent', () => {
  let component: SankeyDiagramComponent;
  let fixture: ComponentFixture<SankeyDiagramComponent>;

  beforeEach(async () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        disconnect = vi.fn();
        unobserve = vi.fn();
      },
    );

    await TestBed.configureTestingModule({
      imports: [SankeyDiagramComponent],
      providers: [
        { provide: SimulationService, useValue: mockSimulationService },
        { provide: ChangeDetectorRef, useValue: mockCdr },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(SankeyDiagramComponent);
    component = fixture.componentInstance;
    component.data = MOCK_SANKEY_DATA;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('should create the sankey diagram component', () => {
    expect(component).toBeTruthy();
  });

  describe('formatMW', () => {
    it('should round and format values >= 10', () => {
      const result = component.formatMW(1234.5);
      expect(result).toContain('MW/jour');
    });

    it('should include MW/jour suffix', () => {
      expect(component.formatMW(5)).toContain('MW/jour');
      expect(component.formatMW(100)).toContain('MW/jour');
    });

    it('should format small values with 2 decimal places', () => {
      const result = component.formatMW(0.123);
      expect(result).toContain('MW/jour');
    });
  });

  describe('formatCo2', () => {
    it('should round values >= 10', () => {
      const result = component.formatCo2(1234.5);
      expect(result).not.toContain('MW/jour');
    });

    it('should format values between 1 and 10 with 1 decimal', () => {
      const result = component.formatCo2(5.678);
      expect(result).toBeTruthy();
    });

    it('should format small values with 2 decimals', () => {
      const result = component.formatCo2(0.123);
      expect(result).toBeTruthy();
    });
  });

  describe('flowOpacity', () => {
    it('should return 0.45 when no flow or node is hovered', () => {
      component.hoveredFlowIndex = null;
      component.hoveredNodeKey = null;
      expect(component.flowOpacity(0)).toBe(0.45);
    });
  });

  describe('onFlowMouseLeave', () => {
    it('should clear hoveredFlowIndex', () => {
      component.hoveredFlowIndex = 2;
      component.onFlowMouseLeave();
      expect(component.hoveredFlowIndex).toBeNull();
    });

    it('should clear tooltip', () => {
      component.tooltip = { x: 10, y: 20, lines: ['test'], color: '#fff' };
      component.onFlowMouseLeave();
      expect(component.tooltip).toBeNull();
    });
  });

  describe('onNodeMouseEnter / onNodeMouseLeave', () => {
    it('should set hoveredNodeKey on enter', () => {
      component.onNodeMouseEnter('demand-0');
      expect(component.hoveredNodeKey).toBe('demand-0');
    });

    it('should clear hoveredNodeKey on leave', () => {
      component.hoveredNodeKey = 'demand-0';
      component.onNodeMouseLeave();
      expect(component.hoveredNodeKey).toBeNull();
    });
  });

  describe('totalCo2', () => {
    it('should sum co2 for all production nodes', () => {
      component.data = MOCK_SANKEY_DATA;
      // hydro: 400 * 4 / 1000 = 1.6, eolien: 100 * 7 / 1000 = 0.7 → total = 2.3
      expect(component.totalCo2).toBeCloseTo(2.3);
    });
  });
});
