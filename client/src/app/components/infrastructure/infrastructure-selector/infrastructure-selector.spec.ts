import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
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

const providers = [
  { provide: InfrastruturesService, useValue: mockInfrasService },
  { provide: NgbModal, useValue: mockModalService },
];

async function renderComponent() {
  return render(InfrastructureSelector, { providers, schemas: [NO_ERRORS_SCHEMA] });
}

describe('InfrastructureSelector', () => {
  beforeEach(() => {
    selectedInfraGroup.set(null);
  });

  afterEach(() => vi.clearAllMocks());

  it('should render the infrastructure selector component', async () => {
    const { container } = await renderComponent();
    expect(container).toBeTruthy();
  });

  it('should render the group selector label', async () => {
    await renderComponent();
    expect(screen.getByText('Groupe infras actif')).toBeInTheDocument();
  });

  describe('infrastructureGroups getter', () => {
    it('should return the list of infra groups from the service', async () => {
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.infrastructureGroups).toHaveLength(2);
    });

    it('should return the correct group names', async () => {
      const { fixture } = await renderComponent();
      const names = fixture.componentInstance.infrastructureGroups.map((g) => g.nom);
      expect(names).toContain('Groupe Alpha');
      expect(names).toContain('Groupe Beta');
    });

    it('should render group names as options in the select', async () => {
      await renderComponent();
      expect(screen.getByText('Groupe Alpha')).toBeInTheDocument();
      expect(screen.getByText('Groupe Beta')).toBeInTheDocument();
    });
  });

  describe('selectedInfrastructureGroup', () => {
    it('should return null initially', async () => {
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.selectedInfrastructureGroup).toBeNull();
    });

    it('should update the signal when set', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.selectedInfrastructureGroup = MOCK_GROUP_A;
      expect(mockInfrasService.selectedInfraGroup()).toEqual(MOCK_GROUP_A);
    });
  });

  describe('compareInfraGroups', () => {
    it('should return true when two groups have the same id', async () => {
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.compareInfraGroups(MOCK_GROUP_A, { ...MOCK_GROUP_A })).toBe(true);
    });

    it('should return false when two groups have different ids', async () => {
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.compareInfraGroups(MOCK_GROUP_A, MOCK_GROUP_B)).toBe(false);
    });
  });

  describe('openCreateModal', () => {
    it('should call modalService.open() when the add button is clicked', async () => {
      const user = userEvent.setup();
      await renderComponent();
      const addBtn = screen.getByTitle("Créer un nouveau groupe d'infrastructure");
      await user.click(addBtn);
      expect(mockModalService.open).toHaveBeenCalled();
    });

    it('should call modalService.open() when called directly', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.openCreateModal();
      expect(mockModalService.open).toHaveBeenCalled();
    });
  });

  describe('getInfrasFromType', () => {
    it('should delegate to infrasService.getInfrasSignalByType', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.getInfrasFromType('hydro');
      expect(mockInfrasService.getInfrasSignalByType).toHaveBeenCalledWith('hydro');
    });
  });
});
