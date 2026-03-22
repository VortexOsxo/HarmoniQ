import { TestBed } from '@angular/core/testing';
import { ScenariosService } from './scenarios-service';
import { LocalStorageService } from './local-storage-service';
import { Scenario } from '@app/models/scenario';
import { Weather } from '@app/models/weather';
import { Consumption } from '@app/models/consumption';

const MOCK_SCENARIO: Scenario = {
  id: 999,
  nom: 'Scénario de test',
  description: 'Description de test',
  date_de_debut: '2030-01-01T00:00:00',
  date_de_fin: '2030-12-31T00:00:00',
  pas_de_temps: 'PT1H',
  weather: Weather.Hot,
  consomation: Consumption.Conservative,
};

const CREATED_SCENARIO: Scenario = { ...MOCK_SCENARIO, id: 999 };

describe('ScenariosService', () => {
  let service: ScenariosService;
  let mockStorageService: {
    loadElements: ReturnType<typeof vi.fn>;
    createElement: ReturnType<typeof vi.fn>;
    deleteElement: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockStorageService = {
      loadElements: vi.fn().mockReturnValue([]),
      createElement: vi.fn().mockImplementation((_key: string, el: Scenario) => ({ ...el, id: 999 })),
      deleteElement: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        ScenariosService,
        { provide: LocalStorageService, useValue: mockStorageService },
      ],
    });

    service = TestBed.inject(ScenariosService);
  });

  afterEach(() => vi.clearAllMocks());

  describe('refreshScenarios', () => {
    it('should include the 2035 default scenario', () => {
      const ids = service.scenarios().map(s => s.id);
      expect(ids).toContain(1);
    });

    it('should include the 2050 default scenario', () => {
      const ids = service.scenarios().map(s => s.id);
      expect(ids).toContain(2);
    });

    it('should merge locally stored scenarios with the defaults', () => {
      mockStorageService.loadElements.mockReturnValue([MOCK_SCENARIO]);
      service.refreshScenarios();

      expect(service.scenarios()).toHaveLength(3);
    });
  });

  describe('createScenario', () => {
    it('should call storageService.createElement with the correct key', () => {
      service.createScenario(MOCK_SCENARIO);

      expect(mockStorageService.createElement).toHaveBeenCalledWith(
        'harmoniq_local_scenarios',
        MOCK_SCENARIO,
      );
    });

    it('should add the created scenario to the scenarios signal', () => {
      const initialCount = service.scenarios().length;
      service.createScenario(MOCK_SCENARIO);

      expect(service.scenarios()).toHaveLength(initialCount + 1);
    });

    it('should set selectedScenario to the created scenario', () => {
      service.createScenario(MOCK_SCENARIO);

      expect(service.selectedScenario()?.id).toBe(999);
    });
  });

  describe('deleteScenario', () => {
    it('should call storageService.deleteElement with the correct key and id', () => {
      service.deleteScenario(MOCK_SCENARIO);

      expect(mockStorageService.deleteElement).toHaveBeenCalledWith(
        'harmoniq_local_scenarios',
        MOCK_SCENARIO.id,
      );
    });

    it('should remove the deleted scenario from the scenarios signal', () => {
      service.createScenario(MOCK_SCENARIO);
      const countAfterCreate = service.scenarios().length;

      service.deleteScenario(CREATED_SCENARIO);

      expect(service.scenarios()).toHaveLength(countAfterCreate - 1);
    });

    it('should clear selectedScenario when the selected scenario is deleted', () => {
      service.createScenario(MOCK_SCENARIO);
      service.deleteScenario(CREATED_SCENARIO);

      expect(service.selectedScenario()).toBeNull();
    });

    it('should keep selectedScenario when a different scenario is deleted', () => {
      service.createScenario(MOCK_SCENARIO);
      const otherScenario: Scenario = { ...MOCK_SCENARIO, id: 888 };

      service.deleteScenario(otherScenario);

      expect(service.selectedScenario()?.id).toBe(999);
    });
  });
});
