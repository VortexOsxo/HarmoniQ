import { TestBed, ComponentFixture } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { SimulationLauncher } from './simulation-launcher';
import { SimulationService } from '@app/services/simulation-service';
import { ScenariosService } from '@app/services/scenarios-service';
import { InfrastruturesService } from '@app/services/infrastrutures-service';
import { InfrastructureGroup } from '@app/models/infrastructure-group';
import { Scenario } from '@app/models/scenario';
import { Weather } from '@app/models/weather';
import { Consumption } from '@app/models/consumption';

vi.mock('leaflet', () => ({
  default: { icon: vi.fn().mockReturnValue({}), divIcon: vi.fn().mockReturnValue({}) },
  icon: vi.fn().mockReturnValue({}),
  divIcon: vi.fn().mockReturnValue({}),
}));

const MOCK_SCENARIO: Scenario = {
  id: 1,
  nom: 'Scénario 2035',
  description: 'Base',
  date_de_debut: '2035-01-01T00:00:00',
  date_de_fin: '2035-12-31T00:00:00',
  pas_de_temps: 'PT1H',
  weather: Weather.Typical,
  consomation: Consumption.Normal,
};

const MOCK_GROUP: InfrastructureGroup = {
  id: 10,
  nom: 'Mon Groupe',
  parc_eoliens: [],
  parc_solaires: [],
  central_hydroelectriques: [],
  central_thermique: [],
  central_nucleaire: [],
};

const canLaunch = signal(false);
const selectedScenario = signal<Scenario | null>(null);
const selectedInfraGroup = signal<InfrastructureGroup | null>(null);

const mockSimulationService = {
  canLaunch,
  productionNodes: signal(null),
  openSourcesPanel$: new Subject<void>(),
  hasExportableData: signal(false),
  launchSimulation: vi.fn(),
};

const mockScenariosService = { selectedScenario };

const mockInfrastruturesService = {
  selectedInfraGroup,
  infraGroups: signal([] as InfrastructureGroup[]),
};

const mockRouter = { navigate: vi.fn() };

describe('SimulationLauncher', () => {
  let component: SimulationLauncher;
  let fixture: ComponentFixture<SimulationLauncher>;

  beforeEach(async () => {
    canLaunch.set(false);
    selectedScenario.set(null);
    selectedInfraGroup.set(null);

    await TestBed.configureTestingModule({
      imports: [SimulationLauncher],
      providers: [
        { provide: SimulationService, useValue: mockSimulationService },
        { provide: ScenariosService, useValue: mockScenariosService },
        { provide: InfrastruturesService, useValue: mockInfrastruturesService },
        { provide: Router, useValue: mockRouter },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(SimulationLauncher);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  it('should create the simulation launcher component', () => {
    expect(component).toBeTruthy();
  });

  describe('launchSimulation', () => {
    it('should navigate to /simulation', () => {
      component.launchSimulation();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/simulation']);
    });
  });

  describe('canLaunch signal', () => {
    it('should be false when no scenario or group is selected', () => {
      expect(component.canLaunch()).toBe(false);
    });

    it('should reflect changes from the simulation service', () => {
      canLaunch.set(true);
      expect(component.canLaunch()).toBe(true);
    });
  });

  describe('selectedScenario signal', () => {
    it('should return null initially', () => {
      expect(component.selectedScenario()).toBeNull();
    });

    it('should return the selected scenario', () => {
      selectedScenario.set(MOCK_SCENARIO);
      expect(component.selectedScenario()).toEqual(MOCK_SCENARIO);
    });
  });

  describe('selectedInfrastructure signal', () => {
    it('should return null initially', () => {
      expect(component.selectedInfrastructure()).toBeNull();
    });

    it('should return the selected infrastructure group', () => {
      selectedInfraGroup.set(MOCK_GROUP);
      expect(component.selectedInfrastructure()).toEqual(MOCK_GROUP);
    });
  });

  describe('isLaunching signal', () => {
    it('should be false initially', () => {
      expect(component.isLaunching()).toBe(false);
    });
  });
});
