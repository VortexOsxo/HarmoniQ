import { render } from '@testing-library/angular';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ScenarioTemporalDemandGraph } from './scenario-temporal-demand-graph';
import { DemandeTemporalGraphService } from '@app/services/graph-services/demande-temporal-graph-service';
import { SimulationStepService } from '@app/services/simulation-step-service';

vi.mock('plotly.js-dist-min', () => ({
  newPlot: vi.fn(),
  purge: vi.fn(),
  downloadImage: vi.fn(),
}));

const mockGraphService = {
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

  describe('hasData', () => {
    it('should return false when no steps are present', async () => {
      mockStepService.steps.set([]);
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.hasData).toBe(false);
    });

    it('should return false when the matching step is not completed', async () => {
      mockStepService.steps.set([
        { name: 'Generation de la demande temporelle', status: 'pending' },
      ]);
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.hasData).toBe(false);
    });

    it('should return true when the matching step is completed', async () => {
      mockStepService.steps.set([
        { name: 'Generation de la demande temporelle', status: 'completed' },
      ]);
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.hasData).toBe(true);
    });
  });
});
