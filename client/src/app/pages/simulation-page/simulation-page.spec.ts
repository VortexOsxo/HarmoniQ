import { TestBed, ComponentFixture } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { SimulationPage } from './simulation-page';
import { SimulationService } from '@app/services/simulation-service';
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

const mockSimulationService = {
  launchSimulation: vi.fn(),
  canLaunch: signal(false),
  productionNodes: signal(null),
  openSourcesPanel$: new Subject<void>(),
  hasExportableData: signal(false),
  launchSimulationSingleInfra: vi.fn().mockReturnValue(null),
  getInfraCost: vi.fn().mockReturnValue(null),
  getInfraEmission: vi.fn().mockReturnValue(null),
  exportSimulationToCSV: vi.fn(),
};

const mockStepService = {
  steps: signal([] as any[]),
  currentStepIndex: signal(-1),
  currentStepName: signal('Initialisation'),
  runSteps: vi.fn(),
};

describe('SimulationPage', () => {
  let component: SimulationPage;
  let fixture: ComponentFixture<SimulationPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SimulationPage],
      providers: [
        { provide: SimulationService, useValue: mockSimulationService },
        { provide: SimulationStepService, useValue: mockStepService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(SimulationPage, { set: { template: '', imports: [CommonModule] } })
      .compileComponents();

    fixture = TestBed.createComponent(SimulationPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => vi.restoreAllMocks());

  it('should create the simulation page component', () => {
    expect(component).toBeTruthy();
  });

  it('should inject simulationService and stepService', () => {
    expect(component.simulationService).toBeDefined();
    expect(component.stepService).toBeDefined();
  });

  describe('ngAfterViewInit', () => {
    it('should call simulationService.launchSimulation on init', () => {
      expect(mockSimulationService.launchSimulation).toHaveBeenCalled();
    });
  });

  describe('scrollToGraph', () => {
    it('should call scrollIntoView when element exists', () => {
      const mockElement = { scrollIntoView: vi.fn() };
      vi.spyOn(document, 'getElementById').mockReturnValue(mockElement as any);

      component.scrollToGraph(0);

      expect(mockElement.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    });

    it('should not throw when element does not exist', () => {
      vi.spyOn(document, 'getElementById').mockReturnValue(null);

      expect(() => component.scrollToGraph(99)).not.toThrow();
    });
  });
});
