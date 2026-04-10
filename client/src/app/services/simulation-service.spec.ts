vi.mock('leaflet', () => ({
  default: {
    icon: vi.fn().mockReturnValue({}),
    map: vi.fn().mockReturnValue({}),
    marker: vi.fn().mockReturnValue({ addTo: vi.fn(), setIcon: vi.fn(), on: vi.fn() }),
    circleMarker: vi.fn().mockReturnValue({ addTo: vi.fn(), setStyle: vi.fn(), bindPopup: vi.fn().mockReturnThis() }),
    polyline: vi.fn().mockReturnValue({ addTo: vi.fn(), setStyle: vi.fn(), bindPopup: vi.fn().mockReturnThis() }),
    tileLayer: vi.fn().mockReturnValue({ addTo: vi.fn() }),
    popup: vi.fn().mockReturnValue({ setLatLng: vi.fn().mockReturnThis(), setContent: vi.fn().mockReturnThis(), openOn: vi.fn() }),
    Point: vi.fn().mockImplementation((x, y) => ({ x, y, add: vi.fn(), scaleBy: vi.fn() })),
  },
  icon: vi.fn().mockReturnValue({}),
  map: vi.fn().mockReturnValue({}),
  marker: vi.fn().mockReturnValue({ addTo: vi.fn(), setIcon: vi.fn(), on: vi.fn() }),
  circleMarker: vi.fn().mockReturnValue({ addTo: vi.fn(), setStyle: vi.fn(), bindPopup: vi.fn().mockReturnThis() }),
  polyline: vi.fn().mockReturnValue({ addTo: vi.fn(), setStyle: vi.fn(), bindPopup: vi.fn().mockReturnThis() }),
  tileLayer: vi.fn().mockReturnValue({ addTo: vi.fn() }),
  popup: vi.fn().mockReturnValue({ setLatLng: vi.fn().mockReturnThis(), setContent: vi.fn().mockReturnThis(), openOn: vi.fn() }),
  Point: vi.fn().mockImplementation((x, y) => ({ x, y, add: vi.fn(), scaleBy: vi.fn() })),
}));

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { SimulationService } from './simulation-service';
import { ScenariosService } from './scenarios-service';
import { InfrastruturesService } from './infrastrutures-service';
import { DemandeSankeyGraphService } from './graph-services/demande-sankey-graph-service';
import { SimulationTemporalGraphService } from './graph-services/simulation-temporal-graph-service';
import { SimulationStepService } from './simulation-step-service';
import { SnackbarService } from './snackbar-service';
import { Scenario } from '@app/models/scenario';
import { Weather } from '@app/models/weather';
import { Consumption } from '@app/models/consumption';
import { InfrastructureGroup } from '@app/models/infrastructure-group';
import { signal } from '@angular/core';

const MOCK_SCENARIO: Scenario = {
  id: 1,
  nom: 'Test 2035',
  description: '',
  date_de_debut: '2035-01-01T00:00:00',
  date_de_fin: '2035-12-31T00:00:00',
  pas_de_temps: 'PT1H',
  weather: Weather.Typical,
  consomation: Consumption.Normal,
};

const MOCK_INFRA_GROUP: InfrastructureGroup = {
  id: 1,
  nom: 'Test Group',
  parc_eoliens: [],
  parc_solaires: [],
  central_hydroelectriques: [],
  central_thermique: [],
  central_nucleaire: [],
};

describe('SimulationService', () => {
  let service: SimulationService;
  let mockScenariosService: Partial<ScenariosService>;
  let mockInfrastruturesService: Partial<InfrastruturesService>;
  let mockDemandeSankeyService: Partial<DemandeSankeyGraphService>;
  let mockSimulationTemporalService: Partial<SimulationTemporalGraphService>;
  let mockStepService: Partial<SimulationStepService>;
  let mockSnackbarService: Partial<SnackbarService>;

  beforeEach(() => {
    const selectedScenarioSignal = signal<Scenario | null>(null);
    mockScenariosService = {
      selectedScenario: selectedScenarioSignal,
    };

    mockInfrastruturesService = {
      selectedInfraGroup: signal<InfrastructureGroup | null>(null),
      getInfrasSignalByType: vi.fn().mockReturnValue(signal([])),
      buildSimulationPayload: vi.fn().mockReturnValue({ nom: 'Test' }),
      ensureInfrasLoaded: vi.fn().mockResolvedValue(undefined),
    };

    mockDemandeSankeyService = {
      getStepName: vi.fn().mockReturnValue('Sankey'),
      generate: vi.fn().mockResolvedValue(undefined),
    };

    mockSimulationTemporalService = {
      getStepName: vi.fn().mockReturnValue('Simulation'),
      generate: vi.fn().mockResolvedValue(undefined),
      getCachedSimulationResult: vi.fn().mockReturnValue(null),
      getCachedDemandeResult: vi.fn().mockReturnValue(null),
      getProductionNodes: vi.fn().mockReturnValue([]),
    };

    mockStepService = {
      runSteps: vi.fn().mockResolvedValue(undefined),
      currentStepName: vi.fn().mockReturnValue('Initialisation') as any,
    };

    mockSnackbarService = {
      show: vi.fn(),
      close: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        SimulationService,
        { provide: ScenariosService, useValue: mockScenariosService },
        { provide: InfrastruturesService, useValue: mockInfrastruturesService },
        { provide: DemandeSankeyGraphService, useValue: mockDemandeSankeyService },
        { provide: SimulationTemporalGraphService, useValue: mockSimulationTemporalService },
        { provide: SimulationStepService, useValue: mockStepService },
        { provide: SnackbarService, useValue: mockSnackbarService },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(SimulationService);
  });

  afterEach(() => vi.clearAllMocks());

  describe('canLaunch (computed)', () => {
    it('should be false when no scenario or infra group is selected', () => {
      expect(service.canLaunch()).toBe(false);
    });

    it('should be true when both scenario and infra group are selected', () => {
      (mockScenariosService.selectedScenario as ReturnType<typeof signal<Scenario | null>>).set(MOCK_SCENARIO);
      (mockInfrastruturesService.selectedInfraGroup as ReturnType<typeof signal<InfrastructureGroup | null>>).set(MOCK_INFRA_GROUP);

      expect(service.canLaunch()).toBe(true);
    });
  });

  describe('hasExportableData', () => {
    it('should return false when no cached data exists', () => {
      expect(service.hasExportableData()).toBe(false);
    });

    it('should return true when cached simulation result exists', () => {
      (mockSimulationTemporalService.getCachedSimulationResult as ReturnType<typeof vi.fn>).mockReturnValue({ production: [] });

      expect(service.hasExportableData()).toBe(true);
    });

    it('should return true when cached demande result exists', () => {
      (mockSimulationTemporalService.getCachedDemandeResult as ReturnType<typeof vi.fn>).mockReturnValue({ total_electricity: {} });

      expect(service.hasExportableData()).toBe(true);
    });
  });

  describe('launchSimulation', () => {
    it('should do nothing when no scenario is selected', async () => {
      await service.launchSimulation();

      expect(mockStepService.runSteps).not.toHaveBeenCalled();
    });

    it('should call simulationStepService.runSteps with the 3 graph services', async () => {
      (mockScenariosService.selectedScenario as ReturnType<typeof signal<Scenario | null>>).set(MOCK_SCENARIO);
      (mockInfrastruturesService.selectedInfraGroup as ReturnType<typeof signal<InfrastructureGroup | null>>).set(MOCK_INFRA_GROUP);

      await service.launchSimulation();

      expect(mockStepService.runSteps).toHaveBeenCalledWith(
        expect.arrayContaining([mockDemandeSankeyService, mockSimulationTemporalService]),
        MOCK_SCENARIO,
      );
    });
  });

  describe('launchSimulationSingleInfra', () => {
    it('should return undefined when no scenario is selected', () => {
      const result = service.launchSimulationSingleInfra('hydro', 1);

      expect(result).toBeUndefined();
    });
  });
});
