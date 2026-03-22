import { TestBed, ComponentFixture } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ScenarioCreationModal } from './scenario-creation-modal';
import { ScenariosService } from '@app/services/scenarios-service';
import { Scenario } from '@app/models/scenario';
import { Weather } from '@app/models/weather';
import { Consumption } from '@app/models/consumption';

const MOCK_CREATED_SCENARIO: Scenario = {
  id: 999,
  nom: 'Mon Scénario',
  description: 'Description test',
  date_de_debut: '2035-01-01T00:00:00',
  date_de_fin: '2035-12-31T00:00:00',
  pas_de_temps: 'PT1H',
  weather: Weather.Typical,
  consomation: Consumption.Normal,
};

const mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };
const mockScenariosService = { createScenario: vi.fn() };

describe('ScenarioCreationModal', () => {
  let component: ScenarioCreationModal;
  let fixture: ComponentFixture<ScenarioCreationModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScenarioCreationModal],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ScenariosService, useValue: mockScenariosService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ScenarioCreationModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  it('should create the scenario creation modal component', () => {
    expect(component).toBeTruthy();
  });

  describe('initial state', () => {
    it('should initialize scenario with empty fields', () => {
      expect(component.scenario.nom).toBe('');
      expect(component.scenario.id).toBe(0);
    });

    it('should expose Weather enum', () => {
      expect(component.Weather).toBeDefined();
    });

    it('should expose Consumption enum', () => {
      expect(component.Consumption).toBeDefined();
    });
  });

  describe('onSubmit', () => {
    it('should call scenariosService.createScenario with the current scenario', () => {
      component.scenario = MOCK_CREATED_SCENARIO;

      component.onSubmit();

      expect(mockScenariosService.createScenario).toHaveBeenCalledWith(MOCK_CREATED_SCENARIO);
    });

    it('should close the modal after submitting', () => {
      component.onSubmit();

      expect(mockActiveModal.close).toHaveBeenCalled();
    });
  });

  describe('dismiss', () => {
    it('should call activeModal.dismiss()', () => {
      component.dismiss();

      expect(mockActiveModal.dismiss).toHaveBeenCalled();
    });
  });
});
