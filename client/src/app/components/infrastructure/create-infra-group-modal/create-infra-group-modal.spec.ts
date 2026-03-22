import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CreateInfraGroupModal } from './create-infra-group-modal';
import { InfrastruturesService } from '@app/services/infrastrutures-service';
import { InfrastructureGroup } from '@app/models/infrastructure-group';

const MOCK_NEW_GROUP: InfrastructureGroup = {
  id: 0,
  nom: 'Nouveau Groupe',
  parc_eoliens: [],
  parc_solaires: [],
  central_hydroelectriques: [],
  central_thermique: [],
  central_nucleaire: [],
};

const mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };
const mockInfrastruturesService = {
  createInfraGroup: vi.fn().mockReturnValue(MOCK_NEW_GROUP),
  selectedInfraGroup: signal<any>(null),
};

describe('CreateInfraGroupModal', () => {
  let component: CreateInfraGroupModal;
  let fixture: ComponentFixture<CreateInfraGroupModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateInfraGroupModal],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: InfrastruturesService, useValue: mockInfrastruturesService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateInfraGroupModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  it('should create the create infra group modal component', () => {
    expect(component).toBeTruthy();
  });

  describe('initial state', () => {
    it('should have an empty name by default', () => {
      expect(component.name).toBe('');
    });

    it('should have currentGroup as null by default', () => {
      expect(component.currentGroup).toBeNull();
    });
  });

  describe('create', () => {
    it('should call infrastructuresService.createInfraGroup when name is provided', () => {
      component.name = 'Mon Groupe';

      component.create();

      expect(mockInfrastruturesService.createInfraGroup).toHaveBeenCalled();
    });

    it('should close the modal after creating the group', () => {
      component.name = 'Mon Groupe';

      component.create();

      expect(mockActiveModal.close).toHaveBeenCalled();
    });

    it('should not call createInfraGroup when name is empty', () => {
      component.name = '';

      component.create();

      expect(mockInfrastruturesService.createInfraGroup).not.toHaveBeenCalled();
    });
  });
});
