import { render } from '@testing-library/angular';
import { NO_ERRORS_SCHEMA, signal, ChangeDetectorRef } from '@angular/core';
import { Subject } from 'rxjs';
import { ScenarioDemandProdSankey } from './scenario-demand-prod-sankey';
import { DemandeSankeyGraphService } from '@app/services/graph-services/demande-sankey-graph-service';
import { ScenariosService } from '@app/services/scenarios-service';
import { SimulationService } from '@app/services/simulation-service';
import { DemandNode, ProductionNode, SankeyData } from './sankey-data.types';

vi.mock('leaflet', () => ({
  default: { icon: vi.fn().mockReturnValue({}), divIcon: vi.fn().mockReturnValue({}) },
  icon: vi.fn().mockReturnValue({}),
  divIcon: vi.fn().mockReturnValue({}),
}));

const MOCK_DEMAND_NODES: DemandNode[] = [
  { id: 'residentiel', label: 'Résidentiel', value: 300, color: '#3498db', icon: 'fa-home' },
  { id: 'commercial', label: 'Commercial', value: 200, color: '#2ecc71', icon: 'fa-building' },
];

const MOCK_PRODUCTION_NODES: ProductionNode[] = [
  { id: 'hydro', label: 'Hydro', value: 400, color: '#1abc9c', icon: 'fa-water', co2FactorKgMWh: 4 },
  { id: 'eolien', label: 'Éolien', value: 100, color: '#9b59b6', icon: 'fa-wind', co2FactorKgMWh: 7 },
];

const MOCK_SANKEY_DATA: SankeyData = {
  demandNodes: MOCK_DEMAND_NODES,
  productionNodes: MOCK_PRODUCTION_NODES,
};

const demandNodes = signal<DemandNode[] | null>(null);
const productionNodes = signal<ProductionNode[] | null>(null);

const mockGraphService = {
  demandNodes,
};

const mockScenariosService = {
  selectedScenario: signal(null),
};

const mockSimulationService = {
  productionNodes,
  openSourcesPanel$: new Subject<void>(),
  canLaunch: signal(false),
  hasExportableData: signal(false),
};

const mockCdr = { markForCheck: vi.fn(), detectChanges: vi.fn() };

describe('ScenarioDemandProdSankey', () => {
  beforeEach(() => {
    demandNodes.set(null);
    productionNodes.set(null);
  });

  afterEach(() => vi.clearAllMocks());

  async function renderComponent() {
    return render(ScenarioDemandProdSankey, {
      providers: [
        { provide: DemandeSankeyGraphService, useValue: mockGraphService },
        { provide: ScenariosService, useValue: mockScenariosService },
        { provide: SimulationService, useValue: mockSimulationService },
        { provide: ChangeDetectorRef, useValue: mockCdr },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
  }

  it('should create the scenario demand prod sankey component', async () => {
    const { fixture } = await renderComponent();
    expect(fixture.componentInstance).toBeTruthy();
  });

  describe('totalDemandMW', () => {
    it('should sum all demand node values', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.sankeyData = MOCK_SANKEY_DATA;
      expect(fixture.componentInstance.totalDemandMW).toBe(500);
    });

    it('should return 0 for empty demand nodes', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.sankeyData = { demandNodes: [], productionNodes: [] };
      expect(fixture.componentInstance.totalDemandMW).toBe(0);
    });
  });

  describe('totalProductionMW', () => {
    it('should sum all production node values', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.sankeyData = MOCK_SANKEY_DATA;
      expect(fixture.componentInstance.totalProductionMW).toBe(500);
    });

    it('should return 0 for empty production nodes', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.sankeyData = { demandNodes: [], productionNodes: [] };
      expect(fixture.componentInstance.totalProductionMW).toBe(0);
    });
  });

  describe('coveragePercent', () => {
    it('should compute production / demand * 100', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.sankeyData = {
        demandNodes: [{ id: 'r', label: 'R', value: 400, color: '#000', icon: '' }],
        productionNodes: [{ id: 'h', label: 'H', value: 200, color: '#000', icon: '', co2FactorKgMWh: 0 }],
      };
      expect(fixture.componentInstance.coveragePercent).toBe(50);
    });

    it('should return 0 when total demand is 0', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.sankeyData = { demandNodes: [], productionNodes: [] };
      expect(fixture.componentInstance.coveragePercent).toBe(0);
    });
  });

  describe('productionDeficit', () => {
    it('should return 0 when simulation has not run', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.simulationRan = false;
      fixture.componentInstance.sankeyData = MOCK_SANKEY_DATA;
      expect(fixture.componentInstance.productionDeficit).toBe(0);
    });

    it('should return deficit when production is less than demand', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.simulationRan = true;
      fixture.componentInstance.sankeyData = {
        demandNodes: [{ id: 'r', label: 'R', value: 600, color: '#000', icon: '' }],
        productionNodes: [{ id: 'h', label: 'H', value: 400, color: '#000', icon: '', co2FactorKgMWh: 0 }],
      };
      expect(fixture.componentInstance.productionDeficit).toBe(200);
    });
  });

  describe('productionSurplus', () => {
    it('should return 0 when simulation has not run', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.simulationRan = false;
      fixture.componentInstance.sankeyData = MOCK_SANKEY_DATA;
      expect(fixture.componentInstance.productionSurplus).toBe(0);
    });

    it('should return surplus when production exceeds demand', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.simulationRan = true;
      fixture.componentInstance.sankeyData = {
        demandNodes: [{ id: 'r', label: 'R', value: 300, color: '#000', icon: '' }],
        productionNodes: [{ id: 'h', label: 'H', value: 500, color: '#000', icon: '', co2FactorKgMWh: 0 }],
      };
      expect(fixture.componentInstance.productionSurplus).toBe(200);
    });
  });
});
