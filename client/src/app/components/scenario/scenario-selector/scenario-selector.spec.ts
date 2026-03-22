import { TestBed, ComponentFixture } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { signal } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ScenarioSelector } from './scenario-selector';
import { ScenariosService } from '@app/services/scenarios-service';
import { TutorialService } from '@app/services/tutorial-service';
import { Scenario } from '@app/models/scenario';
import { Weather } from '@app/models/weather';
import { Consumption } from '@app/models/consumption';

const DEFAULT_SCENARIO_2035: Scenario = {
  id: 1,
  nom: 'année 2035',
  description: 'Scénario de base pour l\'année 2035',
  date_de_debut: '2035-01-01T00:00:00',
  date_de_fin: '2035-12-31T00:00:00',
  pas_de_temps: 'PT1H',
  weather: Weather.Typical,
  consomation: Consumption.Normal,
};

const CUSTOM_SCENARIO: Scenario = {
  id: 999,
  nom: 'Mon Scénario',
  description: 'Custom',
  date_de_debut: '2030-01-01T00:00:00',
  date_de_fin: '2030-12-31T00:00:00',
  pas_de_temps: 'PT1H',
  weather: Weather.Hot,
  consomation: Consumption.Conservative,
};

const mockModalService = {
  open: vi.fn().mockReturnValue({ componentInstance: {}, result: Promise.resolve(null) }),
};

const mockTutorialService = { currentState: { currentStep: 0 } };

describe('ScenarioSelector', () => {
  let component: ScenarioSelector;
  let fixture: ComponentFixture<ScenarioSelector>;
  let mockScenariosService: {
    scenarios: ReturnType<typeof signal<Scenario[]>>;
    selectedScenario: ReturnType<typeof signal<Scenario | null>>;
    deleteScenario: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockScenariosService = {
      scenarios: signal([DEFAULT_SCENARIO_2035, CUSTOM_SCENARIO]),
      selectedScenario: signal<Scenario | null>(null),
      deleteScenario: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ScenarioSelector],
      providers: [
        { provide: ScenariosService, useValue: mockScenariosService },
        { provide: NgbModal, useValue: mockModalService },
        { provide: TutorialService, useValue: mockTutorialService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ScenarioSelector);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  it('should create the scenario selector component', () => {
    expect(component).toBeTruthy();
  });

  describe('scenarios getter', () => {
    it('should return the list of scenarios from the service', () => {
      expect(component.scenarios).toHaveLength(2);
    });
  });

  describe('compareScenarios', () => {
    it('should return true when two scenarios have the same id', () => {
      expect(component.compareScenarios(DEFAULT_SCENARIO_2035, { ...DEFAULT_SCENARIO_2035 })).toBe(true);
    });

    it('should return false when two scenarios have different ids', () => {
      expect(component.compareScenarios(DEFAULT_SCENARIO_2035, CUSTOM_SCENARIO)).toBe(false);
    });
  });

  describe('openModal', () => {
    it('should call modalService.open()', () => {
      component.openModal();

      expect(mockModalService.open).toHaveBeenCalled();
    });
  });

  describe('deleteScenario', () => {
    it('should call scenariosService.deleteScenario with the provided scenario', () => {
      component.deleteScenario(CUSTOM_SCENARIO);

      expect(mockScenariosService.deleteScenario).toHaveBeenCalledWith(CUSTOM_SCENARIO);
    });
  });
});
