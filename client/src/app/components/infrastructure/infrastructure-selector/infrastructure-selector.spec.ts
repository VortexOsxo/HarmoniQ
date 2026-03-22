import { TestBed, ComponentFixture } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { InfrastructureSelector } from './infrastructure-selector';
import { InfrastruturesService } from '@app/services/infrastrutures-service';
import { InfrastructureGroup } from '@app/models/infrastructure-group';

vi.mock('leaflet', () => ({
  default: { icon: vi.fn().mockReturnValue({}), divIcon: vi.fn().mockReturnValue({}) },
  icon: vi.fn().mockReturnValue({}),
  divIcon: vi.fn().mockReturnValue({}),
}));

const MOCK_GROUP_A: InfrastructureGroup = {
  id: 1,
  nom: 'Groupe Alpha',
  parc_eoliens: [],
  parc_solaires: [],
  central_hydroelectriques: [],
  central_thermique: [],
  central_nucleaire: [],
};

const MOCK_GROUP_B: InfrastructureGroup = {
  id: 2,
  nom: 'Groupe Beta',
  parc_eoliens: [],
  parc_solaires: [],
  central_hydroelectriques: [],
  central_thermique: [],
  central_nucleaire: [],
};

const selectedInfraGroup = signal<InfrastructureGroup | null>(null);

const mockInfrasService = {
  infraGroups: signal([MOCK_GROUP_A, MOCK_GROUP_B]),
  selectedInfraGroup,
  getInfrasSignalByType: vi.fn().mockReturnValue(signal([])),
};

const mockModalService = {
  open: vi.fn().mockReturnValue({ componentInstance: {}, result: Promise.resolve(null) }),
};

describe('InfrastructureSelector', () => {
  let component: InfrastructureSelector;
  let fixture: ComponentFixture<InfrastructureSelector>;

  beforeEach(async () => {
    selectedInfraGroup.set(null);

    await TestBed.configureTestingModule({
      imports: [InfrastructureSelector],
      providers: [
        { provide: InfrastruturesService, useValue: mockInfrasService },
        { provide: NgbModal, useValue: mockModalService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(InfrastructureSelector);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  it('should create the infrastructure selector component', () => {
    expect(component).toBeTruthy();
  });

  describe('infrastructureGroups getter', () => {
    it('should return the list of infra groups from the service', () => {
      expect(component.infrastructureGroups).toHaveLength(2);
    });

    it('should return the correct group names', () => {
      const names = component.infrastructureGroups.map((g) => g.nom);
      expect(names).toContain('Groupe Alpha');
      expect(names).toContain('Groupe Beta');
    });
  });

  describe('selectedInfrastructureGroup', () => {
    it('should return null initially', () => {
      expect(component.selectedInfrastructureGroup).toBeNull();
    });

    it('should update the signal when set', () => {
      component.selectedInfrastructureGroup = MOCK_GROUP_A;
      expect(mockInfrasService.selectedInfraGroup()).toEqual(MOCK_GROUP_A);
    });
  });

  describe('compareInfraGroups', () => {
    it('should return true when two groups have the same id', () => {
      expect(component.compareInfraGroups(MOCK_GROUP_A, { ...MOCK_GROUP_A })).toBe(true);
    });

    it('should return false when two groups have different ids', () => {
      expect(component.compareInfraGroups(MOCK_GROUP_A, MOCK_GROUP_B)).toBe(false);
    });
  });

  describe('openCreateModal', () => {
    it('should call modalService.open()', () => {
      component.openCreateModal();
      expect(mockModalService.open).toHaveBeenCalled();
    });
  });

  describe('getInfrasFromType', () => {
    it('should delegate to infrasService.getInfrasSignalByType', () => {
      component.getInfrasFromType('hydro');
      expect(mockInfrasService.getInfrasSignalByType).toHaveBeenCalledWith('hydro');
    });
  });
});
