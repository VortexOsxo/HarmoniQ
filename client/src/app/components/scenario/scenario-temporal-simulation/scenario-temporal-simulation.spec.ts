import { render, screen } from '@testing-library/angular';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ScenarioTemporalSimulation } from './scenario-temporal-simulation';
import { SimulationTemporalGraphService } from '@app/services/graph-services/simulation-temporal-graph-service';
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
  time: ['2035-01-01T00:00:00'],
  residentiel: [300],
};

const mockGraphService = {
  cachedSimulationResult: null as any,
  cachedDemandeResult: null as any,
  handleData: vi.fn(),
  getStepName: vi.fn().mockReturnValue('Simulation temporelle'),
  getProductionNodes: vi.fn().mockReturnValue([]),
};

const mockStepService = {
  steps: signal([] as any[]),
  currentStepIndex: signal(-1),
  currentStepName: signal('Initialisation'),
  runSteps: vi.fn(),
};

async function renderComponent() {
  return render(ScenarioTemporalSimulation, {
    providers: [
      { provide: SimulationTemporalGraphService, useValue: mockGraphService },
      { provide: SimulationStepService, useValue: mockStepService },
    ],
    schemas: [NO_ERRORS_SCHEMA],
  });
}

describe('ScenarioTemporalSimulation', () => {
  beforeEach(() => {
    mockGraphService.cachedSimulationResult = null;
    mockGraphService.cachedDemandeResult = null;
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

  describe('cachedSimulationResult', () => {
    it('should return null when no simulation has run', async () => {
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.cachedSimulationResult).toBeNull();
    });

    it('should delegate to graphService.cachedSimulationResult', async () => {
      mockGraphService.cachedSimulationResult = MOCK_SIMULATION_RESULT;
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.cachedSimulationResult).toEqual(MOCK_SIMULATION_RESULT);
    });
  });

  describe('cachedDemandeResult', () => {
    it('should return null when no simulation has run', async () => {
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.cachedDemandeResult).toBeNull();
    });

    it('should delegate to graphService.cachedDemandeResult', async () => {
      mockGraphService.cachedDemandeResult = MOCK_DEMANDE_RESULT;
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.cachedDemandeResult).toEqual(MOCK_DEMANDE_RESULT);
    });
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

    it('should not call graphService.handleData when cachedSimulationResult is null', async () => {
      mockGraphService.cachedSimulationResult = null;
      mockGraphService.cachedDemandeResult = MOCK_DEMANDE_RESULT;
      const { fixture } = await renderComponent();
      fixture.componentInstance.onGranularityChange('daily');
      expect(mockGraphService.handleData).not.toHaveBeenCalled();
    });

    it('should not call graphService.handleData when cachedDemandeResult is null', async () => {
      mockGraphService.cachedSimulationResult = MOCK_SIMULATION_RESULT;
      mockGraphService.cachedDemandeResult = null;
      const { fixture } = await renderComponent();
      fixture.componentInstance.onGranularityChange('weekly');
      expect(mockGraphService.handleData).not.toHaveBeenCalled();
    });
  });

  describe('hasData', () => {
    it('should return false when no steps are present', async () => {
      mockStepService.steps.set([]);
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.hasData).toBe(false);
    });

    it('should return false when the matching step is not completed', async () => {
      mockStepService.steps.set([
        { name: 'Simulation temporelle', status: 'loading', getStepName: () => 'Simulation temporelle', generate: vi.fn() },
      ]);
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.hasData).toBe(false);
    });

    it('should return true when the matching step is completed', async () => {
      mockStepService.steps.set([
        { name: 'Simulation temporelle', status: 'completed', getStepName: () => 'Simulation temporelle', generate: vi.fn() },
      ]);
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.hasData).toBe(true);
    });

    it('should not render the granularity selector when hasData is false', async () => {
      mockStepService.steps.set([]);
      await renderComponent();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });
  });
});
