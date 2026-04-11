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
  deleteInfraGroup: vi.fn(),
  isInfraSelected: vi.fn().mockReturnValue(false),
  isDefaultInfraGroup: vi.fn().mockReturnValue(false),
  guaranteedPowerMW: signal(0),
  windInstalledMW: signal(0),
  solarInstalledMW: signal(0),
  hydroPuissanceOverrides: signal(new Map()),
};

const mockModalService = {
  open: vi.fn().mockReturnValue({ componentInstance: {}, result: Promise.resolve(null) }),
};

import { SimulationTemporalGraphService } from '@app/services/graph-services/simulation-temporal-graph-service';
import { ScenariosService } from '@app/services/scenarios-service';

const mockSimService = {
  peakDemandMW: signal<number | null>(null),
  totalDemandEnergyTWh: signal<number | null>(null),
  energySummaryTWh: signal(null),
};

const mockScenariosService = {
  selectedScenario: signal(null),
};

const providers = [
  { provide: InfrastruturesService, useValue: mockInfrasService },
  { provide: NgbModal, useValue: mockModalService },
  { provide: SimulationTemporalGraphService, useValue: mockSimService },
  { provide: ScenariosService, useValue: mockScenariosService },
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

  describe('deleteInfraGroup', () => {
    it('should not do anything if default group (id: 1) is selected', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.selectedInfrastructureGroup = MOCK_GROUP_A; // id: 1
      fixture.componentInstance.deleteInfraGroup();
      expect(mockModalService.open).not.toHaveBeenCalled();
    });

    it('should call deleteInfraGroup on service when method is called', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.selectedInfrastructureGroup = MOCK_GROUP_B; // id: 2
      fixture.componentInstance.deleteInfraGroup();
      expect(mockInfrasService.deleteInfraGroup).toHaveBeenCalledWith(MOCK_GROUP_B);
    });

    it('should call deleteInfraGroup on service if confirmed via UI button', async () => {
      const user = userEvent.setup();
      const { fixture } = await renderComponent();
      mockInfrasService.deleteInfraGroup = vi.fn();
      
      // Mock modal to return true
      mockModalService.open.mockReturnValueOnce({ 
        componentInstance: {}, 
        result: Promise.resolve(true) 
      });

      selectedInfraGroup.set(MOCK_GROUP_B); // id: 2
      fixture.detectChanges();

      await user.click(screen.getByRole('button', { name: /Supprimer ce groupe d'infrastructure/i }));
      
      // Wait for promise resolution
      await Promise.resolve();
      
      expect(mockInfrasService.deleteInfraGroup).toHaveBeenCalledWith(MOCK_GROUP_B);
    });
  });

  describe('getInfrasFromType', () => {
    it('should delegate to infrasService.getInfrasSignalByType', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.getInfrasFromType('hydro');
      expect(mockInfrasService.getInfrasSignalByType).toHaveBeenCalledWith('hydro');
    });
  });

  describe('visibleCategories & getFilteredAndSortedInfras', () => {
    const mockHydroInfras = [
      { id: 101, nom: 'Barrage Robert-Bourassa' },
      { id: 102, nom: 'Centrale La Grande-1' },
      { id: 103, nom: 'Barrage Manic-5' }
    ];

    beforeEach(() => {
      mockInfrasService.getInfrasSignalByType.mockImplementation((type: string) => {
        if (type === 'hydro') return signal(mockHydroInfras);
        return signal([]);
      });
    });

    it('should return all categories when filter is empty', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.filterText = '';
      expect(fixture.componentInstance.visibleCategories).toEqual(fixture.componentInstance.infras);
    });

    it('should only show categories with matching infras when filtered', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.filterText = 'manic';
      
      const visible = fixture.componentInstance.visibleCategories;
      expect(visible.length).toBe(1);
      expect(visible[0].type).toBe('hydro');
    });

    it('should hide all categories when no infras match', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.filterText = 'introuvable';
      expect(fixture.componentInstance.visibleCategories.length).toBe(0);
    });

    it('should filter infras by name within a category', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.filterText = 'barrage';
      
      const filtered = fixture.componentInstance.getFilteredAndSortedInfras('hydro');
      expect(filtered.length).toBe(2);
      expect(filtered.map((i: any) => i.nom)).toContain('Barrage Robert-Bourassa');
      expect(filtered.map((i: any) => i.nom)).toContain('Barrage Manic-5');
    });

    it('should sort infras A-Z by default', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.filterText = '';
      
      const sorted = fixture.componentInstance.getFilteredAndSortedInfras('hydro');
      expect(sorted[0].nom).toBe('Barrage Manic-5');
      expect(sorted[1].nom).toBe('Barrage Robert-Bourassa');
      expect(sorted[2].nom).toBe('Centrale La Grande-1');
    });

    it('should sort infras Z-A when sortAsc is false', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.filterText = '';
      fixture.componentInstance.sortAsc = false;
      
      const sorted = fixture.componentInstance.getFilteredAndSortedInfras('hydro');
      expect(sorted[0].nom).toBe('Centrale La Grande-1');
      expect(sorted[1].nom).toBe('Barrage Robert-Bourassa');
      expect(sorted[2].nom).toBe('Barrage Manic-5');
    });
  });

  describe('toggleSort', () => {
    it('should flip sortAsc', async () => {
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.sortAsc).toBe(true);
      fixture.componentInstance.toggleSort();
      expect(fixture.componentInstance.sortAsc).toBe(false);
    });
  });
});
