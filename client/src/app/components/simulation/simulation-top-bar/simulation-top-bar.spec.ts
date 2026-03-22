import { TestBed, ComponentFixture } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { SimulationTopBar } from './simulation-top-bar';
import { SimulationService } from '@app/services/simulation-service';
import { ScenariosService } from '@app/services/scenarios-service';

vi.mock('leaflet', () => ({
  default: { icon: vi.fn().mockReturnValue({}), divIcon: vi.fn().mockReturnValue({}) },
  icon: vi.fn().mockReturnValue({}),
  divIcon: vi.fn().mockReturnValue({}),
}));

const mockSimulationService = {
  canLaunch: signal(false),
  productionNodes: signal(null),
  openSourcesPanel$: new Subject<void>(),
  hasExportableData: signal(false),
  launchSimulation: vi.fn(),
  exportSimulationToCSV: vi.fn(),
};

const mockScenariosService = {
  selectedScenario: signal(null),
};

const mockRouter = { navigate: vi.fn() };

describe('SimulationTopBar', () => {
  let component: SimulationTopBar;
  let fixture: ComponentFixture<SimulationTopBar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SimulationTopBar],
      providers: [
        { provide: SimulationService, useValue: mockSimulationService },
        { provide: ScenariosService, useValue: mockScenariosService },
        { provide: Router, useValue: mockRouter },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(SimulationTopBar, { set: { template: '', imports: [CommonModule] } })
      .compileComponents();

    fixture = TestBed.createComponent(SimulationTopBar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  it('should create the simulation top bar component', () => {
    expect(component).toBeTruthy();
  });

  describe('goBack', () => {
    it('should navigate to /map', () => {
      component.goBack();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/map']);
    });
  });

  describe('injected services', () => {
    it('should have scenarioService available', () => {
      expect(component.scenarioService).toBeDefined();
    });

    it('should have simulationService available', () => {
      expect(component.simulationService).toBeDefined();
    });
  });
});
