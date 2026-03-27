import { render } from '@testing-library/angular';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ScenarioTemporalSimulation } from './scenario-temporal-simulation';
import { SimulationTemporalGraphService } from '@app/services/graph-services/simulation-temporal-graph-service';
import { DemandeTemporalGraphService } from '@app/services/graph-services/demande-temporal-graph-service';
import { SimulationStepService } from '@app/services/simulation-step-service';

vi.mock('leaflet', () => ({
  default: { icon: vi.fn().mockReturnValue({}), divIcon: vi.fn().mockReturnValue({}) },
  icon: vi.fn().mockReturnValue({}),
  divIcon: vi.fn().mockReturnValue({}),
}));

vi.mock('plotly.js-dist-min', () => ({
  newPlot: vi.fn(),
  purge: vi.fn(),
  downloadImage: vi.fn(),
}));

const MOCK_SIMULATION_RESULT = {
  production: [{ time: '2035-01-01T00:00:00', value: 500 }],
};

const MOCK_DEMANDE_RESULT = {
  total_electricity: { '2035-01-01T00:00:00': 300000 },
};

const mockGraphService = {
  cachedSimulationResult: null as any,
  cachedDemandeResult: null as any,
  handleData: vi.fn(),
  renderDemandPreview: vi.fn(),
  getStepName: vi.fn().mockReturnValue('Simulation du reseau complet'),
  getProductionNodes: vi.fn().mockReturnValue([]),
};

const mockDemandeGraphService = {
  cachedData: null as any,
  getStepName: vi.fn().mockReturnValue('Generation de la demande temporelle'),
};

const mockStepService = {
  steps: signal([] as any[]),
  currentStepIndex: signal(-1),
  currentStepName: vi.fn().mockReturnValue('Initialisation'),
  runSteps: vi.fn(),
};

async function renderComponent() {
  return render(ScenarioTemporalSimulation, {
    providers: [
      { provide: SimulationTemporalGraphService, useValue: mockGraphService },
      { provide: DemandeTemporalGraphService, useValue: mockDemandeGraphService },
      { provide: SimulationStepService, useValue: mockStepService },
    ],
    schemas: [NO_ERRORS_SCHEMA],
  });
}

describe('ScenarioTemporalSimulation', () => {
  beforeEach(() => {
    mockGraphService.cachedSimulationResult = null;
    mockGraphService.cachedDemandeResult = null;
    mockDemandeGraphService.cachedData = null;
    mockStepService.steps.set([]);
  });

  afterEach(() => vi.clearAllMocks());

  it('should render the scenario temporal simulation component', async () => {
    const { container } = await renderComponent();
    expect(container).toBeTruthy();
  });

  it('should render the graph container div', async () => {
    await renderComponent();
    expect(document.getElementById('temporal-simulation-id')).toBeTruthy();
  });

  describe('onGranularityChange', () => {
    it('should call graphService.handleData when both cached results are present', async () => {
      mockGraphService.cachedSimulationResult = MOCK_SIMULATION_RESULT;
      mockGraphService.cachedDemandeResult = MOCK_DEMANDE_RESULT;
      const { fixture } = await renderComponent();
      fixture.componentInstance.onGranularityChange('monthly');
      expect(mockGraphService.handleData).toHaveBeenCalledWith(
        MOCK_SIMULATION_RESULT,
        MOCK_DEMANDE_RESULT,
        'monthly',
      );
    });

    it('should call renderDemandPreview when only demand data is available', async () => {
      mockGraphService.cachedSimulationResult = null;
      mockDemandeGraphService.cachedData = MOCK_DEMANDE_RESULT;
      const { fixture } = await renderComponent();
      fixture.componentInstance.onGranularityChange('daily');
      expect(mockGraphService.renderDemandPreview).toHaveBeenCalledWith(MOCK_DEMANDE_RESULT, 'daily');
    });

    it('should not call handleData or renderDemandPreview when no data is available', async () => {
      mockGraphService.cachedSimulationResult = null;
      mockGraphService.cachedDemandeResult = null;
      mockDemandeGraphService.cachedData = null;
      const { fixture } = await renderComponent();
      fixture.componentInstance.onGranularityChange('weekly');
      expect(mockGraphService.handleData).not.toHaveBeenCalled();
      expect(mockGraphService.renderDemandPreview).not.toHaveBeenCalled();
    });

    it('should store the selected granularity', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.onGranularityChange('monthly');
      expect(fixture.componentInstance.selectedGranularity).toBe('monthly');
    });
  });

  describe('hasDemandData', () => {
    it('should return false when no steps are present', async () => {
      mockStepService.steps.set([]);
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.hasDemandData).toBe(false);
    });

    it('should return false when the demand step is not completed', async () => {
      mockStepService.steps.set([
        { name: 'Generation de la demande temporelle', status: 'loading' },
      ]);
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.hasDemandData).toBe(false);
    });

    it('should return true when the demand step is completed', async () => {
      mockStepService.steps.set([
        { name: 'Generation de la demande temporelle', status: 'completed' },
      ]);
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.hasDemandData).toBe(true);
    });
  });
});
