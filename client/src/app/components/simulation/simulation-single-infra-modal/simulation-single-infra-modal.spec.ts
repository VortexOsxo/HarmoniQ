import { TestBed, ComponentFixture } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, signal, ChangeDetectorRef } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { SimulationSingleInfraModal } from './simulation-single-infra-modal';
import { ScenariosService } from '@app/services/scenarios-service';
import { SimulationService } from '@app/services/simulation-service';
import { GraphService } from '@app/services/graph-service';
import { Scenario } from '@app/models/scenario';
import { Weather } from '@app/models/weather';
import { Consumption } from '@app/models/consumption';

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

const MOCK_SCENARIO: Scenario = {
  id: 1,
  nom: 'Année 2035',
  description: 'Base',
  date_de_debut: '2035-01-01T00:00:00',
  date_de_fin: '2035-12-31T00:00:00',
  pas_de_temps: 'PT1H',
  weather: Weather.Typical,
  consomation: Consumption.Normal,
};

const MOCK_PRODUCTION_DATA = { x: ['2035-01-01'], y: [100] };

const mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };

const mockScenariosService = {
  selectedScenario: signal<Scenario | null>(MOCK_SCENARIO),
};

const mockSimulationService = {
  launchSimulationSingleInfra: vi.fn().mockReturnValue(of(MOCK_PRODUCTION_DATA)),
  getInfraCost: vi.fn().mockReturnValue(of({ fixed: 100, variable: 50 })),
  getInfraEmission: vi.fn().mockReturnValue(of({ co2: 0.004 })),
  canLaunch: signal(false),
  productionNodes: signal(null),
};

const mockGraphService = {
  generateProductionSingleInfraGraph: vi.fn(),
};

const mockCdr = { detectChanges: vi.fn(), markForCheck: vi.fn() };

describe('SimulationSingleInfraModal', () => {
  let component: SimulationSingleInfraModal;
  let fixture: ComponentFixture<SimulationSingleInfraModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SimulationSingleInfraModal],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ScenariosService, useValue: mockScenariosService },
        { provide: SimulationService, useValue: mockSimulationService },
        { provide: GraphService, useValue: mockGraphService },
        { provide: ChangeDetectorRef, useValue: mockCdr },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(SimulationSingleInfraModal);
    component = fixture.componentInstance;
    component.name = 'Barrage La Grande';
    component.type = 'hydro';
    component.id = '7';
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  it('should create the simulation single infra modal component', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should call launchSimulationSingleInfra with type and id', () => {
      expect(mockSimulationService.launchSimulationSingleInfra).toHaveBeenCalledWith('hydro', '7');
    });

    it('should call getInfraCost with type and id', () => {
      expect(mockSimulationService.getInfraCost).toHaveBeenCalledWith('hydro', '7');
    });

    it('should call getInfraEmission with type and id', () => {
      expect(mockSimulationService.getInfraEmission).toHaveBeenCalledWith('hydro', '7');
    });

    it('should call generateProductionSingleInfraGraph after receiving data', () => {
      expect(mockGraphService.generateProductionSingleInfraGraph).toHaveBeenCalledWith(
        'hydro',
        MOCK_PRODUCTION_DATA,
        'original',
      );
    });

    it('should set isLoading to false after receiving production data', () => {
      expect(component.isLoading).toBe(false);
    });

    it('should store production data', () => {
      expect(component.productionData).toEqual(MOCK_PRODUCTION_DATA);
    });
  });

  describe('label getter', () => {
    it('should include the infra name and scenario name', () => {
      expect(component.label).toContain('Barrage La Grande');
      expect(component.label).toContain('Année 2035');
    });
  });

  describe('onGranularityChange', () => {
    it('should update selectedGranularity', () => {
      component.onGranularityChange('monthly');
      expect(component.selectedGranularity).toBe('monthly');
    });

    it('should call generateProductionSingleInfraGraph with new granularity when data is present', () => {
      component.productionData = MOCK_PRODUCTION_DATA;
      component.onGranularityChange('daily');
      expect(mockGraphService.generateProductionSingleInfraGraph).toHaveBeenCalledWith(
        'hydro',
        MOCK_PRODUCTION_DATA,
        'daily',
      );
    });

    it('should not call generateProductionSingleInfraGraph when no data', () => {
      component.productionData = undefined;
      mockGraphService.generateProductionSingleInfraGraph.mockClear();
      component.onGranularityChange('weekly');
      expect(mockGraphService.generateProductionSingleInfraGraph).not.toHaveBeenCalled();
    });
  });
});
