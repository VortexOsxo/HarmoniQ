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

  describe('filter chips (activeFilters, toggleFilter, isFilterActive)', () => {
    it('should have all types active by default', async () => {
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.isFilterActive('hydro')).toBe(true);
      expect(fixture.componentInstance.isFilterActive('eolienneparc')).toBe(true);
      expect(fixture.componentInstance.isFilterActive('solaire')).toBe(true);
      expect(fixture.componentInstance.isFilterActive('thermique')).toBe(true);
      expect(fixture.componentInstance.isFilterActive('nucleaire')).toBe(true);
    });

    it('should deactivate a type when toggled off', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.toggleFilter('hydro');
      expect(fixture.componentInstance.isFilterActive('hydro')).toBe(false);
    });

    it('should reactivate a type when toggled back on', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.toggleFilter('hydro');
      fixture.componentInstance.toggleFilter('hydro');
      expect(fixture.componentInstance.isFilterActive('hydro')).toBe(true);
    });
  });

  describe('flatFilteredInfras & getFilteredAndSortedInfras', () => {
    const mockHydroInfras = [
      { id: 101, nom: 'Barrage Robert-Bourassa' },
      { id: 102, nom: 'Centrale La Grande-1' },
      { id: 103, nom: 'Barrage Manic-5' }
    ];

    const mockEolienInfras = [
      { id: 201, nom: 'Parc Rivière-du-Moulin' },
    ];

    beforeEach(() => {
      mockInfrasService.getInfrasSignalByType.mockImplementation((type: string) => {
        if (type === 'hydro') return signal(mockHydroInfras);
        if (type === 'eolienneparc') return signal(mockEolienInfras);
        return signal([]);
      });
    });

    it('should return infras from all active types in a flat sorted list', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.filterText = '';

      const flat = fixture.componentInstance.flatFilteredInfras;
      const names = flat.map(i => i.infra.nom);
      expect(names).toEqual([
        'Barrage Manic-5',
        'Barrage Robert-Bourassa',
        'Centrale La Grande-1',
        'Parc Rivière-du-Moulin',
      ]);
    });

    it('should exclude infras from deactivated types', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.toggleFilter('eolienneparc');

      const flat = fixture.componentInstance.flatFilteredInfras;
      expect(flat.every(i => i.type !== 'eolienneparc')).toBe(true);
      expect(flat.length).toBe(3);
    });

    it('should return empty list when all types are deactivated', async () => {
      const { fixture } = await renderComponent();
      for (const cat of fixture.componentInstance.infras) {
        fixture.componentInstance.toggleFilter(cat.type);
      }
      expect(fixture.componentInstance.flatFilteredInfras.length).toBe(0);
    });

    it('should filter infras by name across types', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.filterText = 'barrage';

      const flat = fixture.componentInstance.flatFilteredInfras;
      expect(flat.length).toBe(2);
      expect(flat.map(i => i.infra.nom)).toContain('Barrage Robert-Bourassa');
      expect(flat.map(i => i.infra.nom)).toContain('Barrage Manic-5');
    });

    it('should return empty when no infras match the text filter', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.filterText = 'introuvable';
      expect(fixture.componentInstance.flatFilteredInfras.length).toBe(0);
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

    it('should attach the correct type to each item in flatFilteredInfras', async () => {
      const { fixture } = await renderComponent();
      const flat = fixture.componentInstance.flatFilteredInfras;
      const hydroItems = flat.filter(i => i.type === 'hydro');
      const eolienItems = flat.filter(i => i.type === 'eolienneparc');
      expect(hydroItems.length).toBe(3);
      expect(eolienItems.length).toBe(1);
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
