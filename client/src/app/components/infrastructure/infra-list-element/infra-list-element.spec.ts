import { TestBed, ComponentFixture } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { InfraListElement } from './infra-list-element';
import { InfrastruturesService } from '@app/services/infrastrutures-service';
import { ScenariosService } from '@app/services/scenarios-service';
import { InfraDetailService } from '@app/services/infra-detail-service';
import { Scenario } from '@app/models/scenario';
import { Weather } from '@app/models/weather';
import { Consumption } from '@app/models/consumption';

vi.mock('leaflet', () => ({
  default: { icon: vi.fn().mockReturnValue({}), divIcon: vi.fn().mockReturnValue({}) },
  icon: vi.fn().mockReturnValue({}),
  divIcon: vi.fn().mockReturnValue({}),
}));

const MOCK_SCENARIO: Scenario = {
  id: 999,
  nom: 'Scénario Test',
  description: 'Test',
  date_de_debut: '2035-01-01T00:00:00',
  date_de_fin: '2035-12-31T00:00:00',
  pas_de_temps: 'PT1H',
  weather: Weather.Typical,
  consomation: Consumption.Normal,
};

const mockInfrasService = {
  isInfraSelected: vi.fn().mockReturnValue(false),
  toggleInfra: vi.fn(),
  deleteLocalInfra: vi.fn(),
};

const selectedScenario = signal<Scenario | null>(null);
const mockScenariosService = { selectedScenario };

const mockModalRef = {
  componentInstance: {} as any,
  result: Promise.resolve(true),
};
const mockModalService = {
  open: vi.fn().mockReturnValue(mockModalRef),
};

const mockInfraDetailService = {
  openDetail: vi.fn(),
};

describe('InfraListElement', () => {
  let component: InfraListElement;
  let fixture: ComponentFixture<InfraListElement>;

  beforeEach(async () => {
    selectedScenario.set(null);
    mockInfrasService.isInfraSelected.mockReturnValue(false);

    await TestBed.configureTestingModule({
      imports: [InfraListElement],
      providers: [
        { provide: InfrastruturesService, useValue: mockInfrasService },
        { provide: ScenariosService, useValue: mockScenariosService },
        { provide: NgbModal, useValue: mockModalService },
        { provide: InfraDetailService, useValue: mockInfraDetailService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(InfraListElement);
    component = fixture.componentInstance;
    component.nom = 'Barrage Test';
    component.id = '42';
    component.type = 'hydro';
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  it('should create the infra list element component', () => {
    expect(component).toBeTruthy();
  });

  describe('isSelected', () => {
    it('should return false when infra is not selected', () => {
      mockInfrasService.isInfraSelected.mockReturnValue(false);
      expect(component.isSelected).toBe(false);
    });

    it('should return true when infra is selected', () => {
      mockInfrasService.isInfraSelected.mockReturnValue(true);
      expect(component.isSelected).toBe(true);
    });

    it('should call isInfraSelected with the correct type and id', () => {
      component.isSelected;
      expect(mockInfrasService.isInfraSelected).toHaveBeenCalledWith('hydro', '42');
    });
  });

  describe('toggleInfra', () => {
    it('should call infrastructuresService.toggleInfra with type and id', () => {
      component.toggleInfra();
      expect(mockInfrasService.toggleInfra).toHaveBeenCalledWith('hydro', '42');
    });
  });

  describe('handleInfoClick', () => {
    it('should call infraDetailService.openDetail with type and id', () => {
      const event = { stopPropagation: vi.fn() };
      component.handleInfoClick(event);
      expect(mockInfraDetailService.openDetail).toHaveBeenCalledWith('hydro', '42');
    });

    it('should stop event propagation', () => {
      const event = { stopPropagation: vi.fn() };
      component.handleInfoClick(event);
      expect(event.stopPropagation).toHaveBeenCalled();
    });
  });

  describe('simulate_single', () => {
    it('should not open modal when no scenario is selected', () => {
      selectedScenario.set(null);
      const event = { stopPropagation: vi.fn() };
      component.simulate_single(event);
      expect(mockModalService.open).not.toHaveBeenCalled();
    });

    it('should open modal when a scenario is selected', () => {
      selectedScenario.set(MOCK_SCENARIO);
      const event = { stopPropagation: vi.fn() };
      component.simulate_single(event);
      expect(mockModalService.open).toHaveBeenCalled();
    });

    it('should set modal instance properties when opening', () => {
      selectedScenario.set(MOCK_SCENARIO);
      const event = { stopPropagation: vi.fn() };
      component.simulate_single(event);
      expect(mockModalRef.componentInstance.id).toBe('42');
      expect(mockModalRef.componentInstance.name).toBe('Barrage Test');
      expect(mockModalRef.componentInstance.type).toBe('hydro');
    });
  });

  describe('deleteInfra', () => {
    it('should open a confirmation modal', () => {
      const event = { stopPropagation: vi.fn() };
      component.deleteInfra(event);
      expect(mockModalService.open).toHaveBeenCalled();
    });

    it('should stop event propagation', () => {
      const event = { stopPropagation: vi.fn() };
      component.deleteInfra(event);
      expect(event.stopPropagation).toHaveBeenCalled();
    });

    it('should call deleteLocalInfra when confirmation is accepted', async () => {
      const event = { stopPropagation: vi.fn() };
      component.deleteInfra(event);
      await mockModalRef.result;
      expect(mockInfrasService.deleteLocalInfra).toHaveBeenCalledWith('hydro', 42);
    });
  });
});
