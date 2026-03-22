import { TestBed, ComponentFixture } from '@angular/core/testing';
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

describe('ScenarioTemporalSimulation', () => {
  let component: ScenarioTemporalSimulation;
  let fixture: ComponentFixture<ScenarioTemporalSimulation>;

  beforeEach(async () => {
    mockGraphService.cachedSimulationResult = null;
    mockGraphService.cachedDemandeResult = null;

    await TestBed.configureTestingModule({
      imports: [ScenarioTemporalSimulation],
      providers: [
        { provide: SimulationTemporalGraphService, useValue: mockGraphService },
        { provide: SimulationStepService, useValue: mockStepService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ScenarioTemporalSimulation);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  it('should create the scenario temporal simulation component', () => {
    expect(component).toBeTruthy();
  });

  describe('cachedSimulationResult', () => {
    it('should return null when no simulation has run', () => {
      expect(component.cachedSimulationResult).toBeNull();
    });

    it('should delegate to graphService.cachedSimulationResult', () => {
      mockGraphService.cachedSimulationResult = MOCK_SIMULATION_RESULT;
      expect(component.cachedSimulationResult).toEqual(MOCK_SIMULATION_RESULT);
    });
  });

  describe('cachedDemandeResult', () => {
    it('should return null when no simulation has run', () => {
      expect(component.cachedDemandeResult).toBeNull();
    });

    it('should delegate to graphService.cachedDemandeResult', () => {
      mockGraphService.cachedDemandeResult = MOCK_DEMANDE_RESULT;
      expect(component.cachedDemandeResult).toEqual(MOCK_DEMANDE_RESULT);
    });
  });

  describe('onGranularityChange', () => {
    it('should call graphService.handleData when both cached results are present', () => {
      mockGraphService.cachedSimulationResult = MOCK_SIMULATION_RESULT;
      mockGraphService.cachedDemandeResult = MOCK_DEMANDE_RESULT;
      component.onGranularityChange('monthly');
      expect(mockGraphService.handleData).toHaveBeenCalledWith(
        MOCK_SIMULATION_RESULT,
        MOCK_DEMANDE_RESULT,
        'monthly',
      );
    });

    it('should not call graphService.handleData when cachedSimulationResult is null', () => {
      mockGraphService.cachedSimulationResult = null;
      mockGraphService.cachedDemandeResult = MOCK_DEMANDE_RESULT;
      component.onGranularityChange('daily');
      expect(mockGraphService.handleData).not.toHaveBeenCalled();
    });

    it('should not call graphService.handleData when cachedDemandeResult is null', () => {
      mockGraphService.cachedSimulationResult = MOCK_SIMULATION_RESULT;
      mockGraphService.cachedDemandeResult = null;
      component.onGranularityChange('weekly');
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
        { name: 'Simulation temporelle', status: 'loading', getStepName: () => 'Simulation temporelle', generate: vi.fn() },
      ]);
      expect(component.hasData).toBe(false);
    });

    it('should return true when the matching step is completed', () => {
      mockStepService.steps.set([
        { name: 'Simulation temporelle', status: 'completed', getStepName: () => 'Simulation temporelle', generate: vi.fn() },
      ]);
      expect(component.hasData).toBe(true);
    });
  });
});
