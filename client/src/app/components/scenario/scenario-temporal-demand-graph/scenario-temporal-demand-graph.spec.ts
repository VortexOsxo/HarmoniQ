import { TestBed, ComponentFixture } from '@angular/core/testing';
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

describe('ScenarioTemporalDemandGraph', () => {
  let component: ScenarioTemporalDemandGraph;
  let fixture: ComponentFixture<ScenarioTemporalDemandGraph>;

  beforeEach(async () => {
    mockGraphService.cachedData = null;

    await TestBed.configureTestingModule({
      imports: [ScenarioTemporalDemandGraph],
      providers: [
        { provide: DemandeTemporalGraphService, useValue: mockGraphService },
        { provide: SimulationStepService, useValue: mockStepService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ScenarioTemporalDemandGraph);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  it('should create the scenario temporal demand graph component', () => {
    expect(component).toBeTruthy();
  });

  describe('onGranularityChange', () => {
    it('should call graphService.handleData when cachedData is present', () => {
      mockGraphService.cachedData = MOCK_CACHED_DATA;
      component.onGranularityChange('monthly');
      expect(mockGraphService.handleData).toHaveBeenCalledWith(MOCK_CACHED_DATA, 'monthly');
    });

    it('should not call graphService.handleData when cachedData is null', () => {
      mockGraphService.cachedData = null;
      component.onGranularityChange('daily');
      expect(mockGraphService.handleData).not.toHaveBeenCalled();
    });
  });

  describe('hasData', () => {
    it('should return false when no steps are present', () => {
      mockStepService.steps.set([]);
      expect(component.hasData).toBe(false);
    });

    it('should return false when the matching step is not completed', () => {
      mockStepService.steps.set([
        { name: 'Demande temporelle', status: 'pending', getStepName: () => 'Demande temporelle', generate: vi.fn() },
      ]);
      expect(component.hasData).toBe(false);
    });

    it('should return true when the matching step is completed', () => {
      mockStepService.steps.set([
        { name: 'Demande temporelle', status: 'completed', getStepName: () => 'Demande temporelle', generate: vi.fn() },
      ]);
      expect(component.hasData).toBe(true);
    });
  });
});
