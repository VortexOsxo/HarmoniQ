import { render, screen } from '@testing-library/angular';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ScenarioTemporalDemandGraph } from './scenario-temporal-demand-graph';
import { DemandeTemporalGraphService } from '@app/services/graph-services/demande-temporal-graph-service';
import { SimulationStepService } from '@app/services/simulation-step-service';

vi.mock('plotly.js-dist-min', () => ({
  newPlot: vi.fn(),
  purge: vi.fn(),
  downloadImage: vi.fn(),
}));

const MOCK_CACHED_DATA = {
  time: ['2035-01-01T00:00:00'],
  residentiel: [1000],
  commercial: [500],
  industrie: [200],
  autres: [100],
};

const mockGraphService = {
  cachedData: null as any,
  handleData: vi.fn(),
  getStepName: vi.fn().mockReturnValue('Demande temporelle'),
};

const mockStepService = {
  steps: signal([] as any[]),
  currentStepIndex: signal(-1),
  currentStepName: signal('Initialisation'),
  runSteps: vi.fn(),
};

async function renderComponent() {
  return render(ScenarioTemporalDemandGraph, {
    providers: [
      { provide: DemandeTemporalGraphService, useValue: mockGraphService },
      { provide: SimulationStepService, useValue: mockStepService },
    ],
    schemas: [NO_ERRORS_SCHEMA],
  });
}

describe('ScenarioTemporalDemandGraph', () => {
  beforeEach(() => {
    mockGraphService.cachedData = null;
    mockStepService.steps.set([]);
  });

  afterEach(() => vi.clearAllMocks());

  it('should render the scenario temporal demand graph component', async () => {
    const { container } = await renderComponent();
    expect(container).toBeTruthy();
  });

  it('should render the graph container div', async () => {
    await renderComponent();
    expect(document.getElementById('temporal-demande-production-id')).toBeTruthy();
  });

  describe('onGranularityChange', () => {
    it('should call graphService.handleData when cachedData is present', async () => {
      mockGraphService.cachedData = MOCK_CACHED_DATA;
      const { fixture } = await renderComponent();
      fixture.componentInstance.onGranularityChange('monthly');
      expect(mockGraphService.handleData).toHaveBeenCalledWith(MOCK_CACHED_DATA, 'monthly');
    });

    it('should not call graphService.handleData when cachedData is null', async () => {
      mockGraphService.cachedData = null;
      const { fixture } = await renderComponent();
      fixture.componentInstance.onGranularityChange('daily');
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
        { name: 'Demande temporelle', status: 'pending', getStepName: () => 'Demande temporelle', generate: vi.fn() },
      ]);
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.hasData).toBe(false);
    });

    it('should return true when the matching step is completed', async () => {
      mockStepService.steps.set([
        { name: 'Demande temporelle', status: 'completed', getStepName: () => 'Demande temporelle', generate: vi.fn() },
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
