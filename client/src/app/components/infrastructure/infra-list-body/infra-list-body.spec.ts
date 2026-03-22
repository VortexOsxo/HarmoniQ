import { TestBed, ComponentFixture } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InfraListBody } from './infra-list-body';
import { InfrastruturesService } from '@app/services/infrastrutures-service';

const MOCK_INFRAS = [
  { id: 1, nom: 'Barrage A', isUserCreated: false },
  { id: 2, nom: 'Barrage B', isUserCreated: true },
];

const mockInfrastruturesService = {
  setInfrasForType: vi.fn(),
  isInfraSelected: vi.fn().mockReturnValue(false),
  toggleInfra: vi.fn(),
  deleteLocalInfra: vi.fn(),
  selectedInfraGroup: signal({ id: 1, nom: 'Groupe', parc_eoliens: [], parc_solaires: [], central_hydroelectriques: ['1'], central_thermique: [], central_nucleaire: [] }),
};

describe('InfraListBody', () => {
  let component: InfraListBody;
  let fixture: ComponentFixture<InfraListBody>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InfraListBody],
      providers: [
        { provide: InfrastruturesService, useValue: mockInfrastruturesService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(InfraListBody, { set: { template: '', imports: [CommonModule] } })
      .compileComponents();

    fixture = TestBed.createComponent(InfraListBody);
    component = fixture.componentInstance;
    component.infras = MOCK_INFRAS;
    component.type = 'hydro';
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  it('should create the infra list body component', () => {
    expect(component).toBeTruthy();
  });

  describe('selectAll', () => {
    it('should call setInfrasForType with all infra ids as strings', () => {
      component.selectAll();

      expect(mockInfrastruturesService.setInfrasForType).toHaveBeenCalledWith(
        'hydro',
        expect.arrayContaining(['1', '2']),
      );
    });
  });

  describe('selectNone', () => {
    it('should call setInfrasForType with an empty array', () => {
      component.selectNone();

      expect(mockInfrastruturesService.setInfrasForType).toHaveBeenCalledWith('hydro', []);
    });
  });
});
