import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { NO_ERRORS_SCHEMA, signal, ChangeDetectorRef } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { InfraDetailModal } from './infra-detail-modal';
import { InfraDetailService } from '@app/services/infra-detail-service';
import { InfrastruturesService } from '@app/services/infrastrutures-service';
import { ProtectedAreasService } from '@app/services/protected-areas-service';
import { ScenariosService } from '@app/services/scenarios-service';

vi.mock('leaflet', () => ({
  default: { icon: vi.fn().mockReturnValue({}), divIcon: vi.fn().mockReturnValue({}) },
  icon: vi.fn().mockReturnValue({}),
  divIcon: vi.fn().mockReturnValue({}),
}));

const selectedInfra = signal<any>(null);
const selectedScenario = signal<any>(null);

const mockInfraDetailService = {
  isOpen: signal(false),
  selectedInfra,
  closeDetail: vi.fn(),
};

const mockInfrasService = {
  deleteLocalInfra: vi.fn(),
  overrideHydroPuissance: vi.fn(),
  editInfra: vi.fn(),
  hydroPuissanceOverrides: signal(new Map<string, number>()),
};

const mockModalService = {
  open: vi.fn().mockReturnValue({ componentInstance: {}, result: Promise.resolve(false) }),
};

const mockProtectedAreasService = {
  checkProtectedArea: vi.fn().mockResolvedValue(null),
  checkProtectedAreaWithDetails: vi.fn().mockResolvedValue(null),
};

const providers = [
  { provide: InfraDetailService, useValue: mockInfraDetailService },
  { provide: InfrastruturesService, useValue: mockInfrasService },
  { provide: NgbModal, useValue: mockModalService },
  { provide: ProtectedAreasService, useValue: mockProtectedAreasService },
  { provide: ScenariosService, useValue: { selectedScenario } },
  { provide: ChangeDetectorRef, useValue: { detectChanges: vi.fn(), markForCheck: vi.fn() } },
];

async function renderComponent() {
  return render(InfraDetailModal, { providers, schemas: [NO_ERRORS_SCHEMA] });
}

describe('InfraDetailModal', () => {
  beforeEach(() => {
    selectedInfra.set(null);
    selectedScenario.set(null);
    mockInfraDetailService.isOpen.set(false);
    mockInfrasService.hydroPuissanceOverrides.set(new Map());
  });

  afterEach(() => vi.clearAllMocks());

  it('should render', async () => {
    const { container } = await renderComponent();
    expect(container).toBeTruthy();
  });

  describe('close', () => {
    it('should call closeDetail and reset overlay flags', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.showCycleVieModal = true;
      fixture.componentInstance.showImageOverlay = true;
      fixture.componentInstance.close();
      expect(mockInfraDetailService.closeDetail).toHaveBeenCalled();
      expect(fixture.componentInstance.showCycleVieModal).toBe(false);
      expect(fixture.componentInstance.showImageOverlay).toBe(false);
    });

    it('should close via button click', async () => {
      mockInfraDetailService.isOpen.set(true);
      await renderComponent();
      await userEvent.setup().click(screen.getByTitle('Fermer'));
      expect(mockInfraDetailService.closeDetail).toHaveBeenCalled();
    });
  });

  describe('showExplanationFromTooltip / closeExplanation', () => {
    it('should parse title and text from colon-separated tooltip', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.showExplanationFromTooltip('Mégawatt (MW) : Unité de mesure');
      expect(fixture.componentInstance.selectedExplanationTitle).toBe('Mégawatt (MW)');
      expect(fixture.componentInstance.selectedExplanationText).toBe('Unité de mesure');
    });

    it('should use Information as title for plain tooltip and clear on close', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.showExplanationFromTooltip('Simple tooltip');
      expect(fixture.componentInstance.selectedExplanationTitle).toBe('Information');
      fixture.componentInstance.closeExplanation();
      expect(fixture.componentInstance.selectedExplanationTitle).toBeNull();
    });
  });

  describe('hasSelectedScenario', () => {
    it('should return false without scenario and true with one', async () => {
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.hasSelectedScenario()).toBe(false);
      selectedScenario.set({ id: 1 });
      expect(fixture.componentInstance.hasSelectedScenario()).toBe(true);
    });
  });

  describe('simulateSingle', () => {
    it('should not open modal without infra or scenario', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.simulateSingle();
      expect(mockModalService.open).not.toHaveBeenCalled();
    });

    it('should open modal when both infra and scenario are set', async () => {
      selectedInfra.set({ type: 'hydro', data: { id: '1', nom: 'Test', type_barrage: 'Réservoir' } });
      selectedScenario.set({ id: 1 });
      const { fixture } = await renderComponent();
      fixture.componentInstance.simulateSingle();
      expect(mockModalService.open).toHaveBeenCalled();
    });
  });

  describe('editInfra', () => {
    it('should not call editInfra for hydro or non-user-created', async () => {
      selectedInfra.set({ type: 'hydro', data: { id: '1', isUserCreated: true } });
      const { fixture } = await renderComponent();
      fixture.componentInstance.editInfra();
      expect(mockInfrasService.editInfra).not.toHaveBeenCalled();
    });

    it('should call editInfra for user-created non-hydro', async () => {
      selectedInfra.set({ type: 'eolienneparc', data: { id: '1', isUserCreated: true } });
      const { fixture } = await renderComponent();
      fixture.componentInstance.editInfra();
      expect(mockInfrasService.editInfra).toHaveBeenCalledWith('eolienneparc', expect.any(Object));
    });
  });

  describe('deleteInfra', () => {
    it('should not open modal when infra is not user-created', async () => {
      selectedInfra.set({ type: 'eolienneparc', data: { id: '1', isUserCreated: false } });
      const { fixture } = await renderComponent();
      fixture.componentInstance.deleteInfra();
      expect(mockModalService.open).not.toHaveBeenCalled();
    });

    it('should call deleteLocalInfra when confirmed', async () => {
      mockModalService.open.mockReturnValue({ componentInstance: {}, result: Promise.resolve(true) });
      selectedInfra.set({ type: 'eolienneparc', data: { id: '1', isUserCreated: true } });
      const { fixture } = await renderComponent();
      fixture.componentInstance.deleteInfra();
      await Promise.resolve(); await Promise.resolve();
      expect(mockInfrasService.deleteLocalInfra).toHaveBeenCalledWith('eolienneparc', '1');
    });
  });

  describe('onPuissanceSliderInput', () => {
    it('should update slider and call override for hydro', async () => {
      selectedInfra.set({ type: 'hydro', data: { id: '1' } });
      const { fixture } = await renderComponent();
      fixture.componentInstance.onPuissanceSliderInput({ target: { value: '500' } } as any);
      expect(fixture.componentInstance.sliderValue()).toBe(500);
      expect(mockInfrasService.overrideHydroPuissance).toHaveBeenCalledWith('1', 500);
    });
  });

  describe('getPluralCategoryName', () => {
    it('should return empty string when no infra', async () => {
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.getPluralCategoryName()).toBe('');
    });

    it('should return correct label per type', async () => {
      const { fixture } = await renderComponent();
      const cases: [string, string][] = [
        ['hydro', 'barrages hydroélectriques'],
        ['eolienneparc', 'parcs éoliens'],
        ['solaire', 'parcs solaires'],
        ['thermique', 'centrales thermiques'],
        ['nucleaire', 'centrales nucléaires'],
      ];
      for (const [type, expected] of cases) {
        selectedInfra.set({ type, categoryName: 'X', data: {} });
        expect(fixture.componentInstance.getPluralCategoryName()).toBe(expected);
      }
    });

    it('should fallback to lowercased categoryName + s', async () => {
      selectedInfra.set({ type: 'autre', categoryName: 'Biomasse', data: {} });
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.getPluralCategoryName()).toBe('biomasses');
    });
  });

  describe('getImpactsData', () => {
    it('should return empty array without infra', async () => {
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.getImpactsData()).toEqual([]);
    });

    it('should return arrays for hydro and eolienneparc', async () => {
      const { fixture } = await renderComponent();
      selectedInfra.set({ type: 'hydro', data: { type_barrage: "Fil de l'eau" } });
      expect(Array.isArray(fixture.componentInstance.getImpactsData())).toBe(true);
      selectedInfra.set({ type: 'hydro', data: { type_barrage: 'Réservoir' } });
      expect(Array.isArray(fixture.componentInstance.getImpactsData())).toBe(true);
    });
  });

  describe('getInfoFields', () => {
    it('should return empty array without infra', async () => {
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.getInfoFields()).toEqual([]);
    });

    it('should include hydro-specific fields and exclude volume for fil-de-l\'eau', async () => {
      const { fixture } = await renderComponent();
      selectedInfra.set({ type: 'hydro', data: { type_barrage: "Fil de l'eau", puissance_nominal: '500', debits_nominal: '100' } });
      const labels = fixture.componentInstance.getInfoFields().map((f) => f.label);
      expect(labels).toContain('Type de barrage');
      expect(labels).not.toContain('Volume du réservoir');

      selectedInfra.set({ type: 'hydro', data: { type_barrage: 'Réservoir', volume_reservoir: 5000000, puissance_nominal: '500' } });
      const labels2 = fixture.componentInstance.getInfoFields().map((f) => f.label);
      expect(labels2).toContain('Volume du réservoir');
      const volField = fixture.componentInstance.getInfoFields().find((f) => f.label === 'Volume du réservoir');
      expect(volField?.value).toContain('Mm³');
    });

    it('should return eolienneparc fields with offshore detection', async () => {
      selectedInfra.set({ type: 'eolienneparc', data: { is_offshore: true, nombre_eoliennes: 5, puissance_nominal: '100', capacite_total: '500' } });
      const { fixture } = await renderComponent();
      const fields = fixture.componentInstance.getInfoFields();
      expect(fields.find((f) => f.label === "Type d'implantation")?.value).toBe('Offshore');
    });

    it('should return solaire fields', async () => {
      selectedInfra.set({ type: 'solaire', data: { nombre_panneau: 1000, orientation_panneau: 180, angle_panneau: 45, puissance_nominal: '25' } });
      const { fixture } = await renderComponent();
      const labels = fixture.componentInstance.getInfoFields().map((f) => f.label);
      expect(labels).toContain('Nombre de panneaux');
      expect(labels).toContain("Angle d'inclinaison");
    });

    it('should return thermique fields and not nucleaire type_intrant', async () => {
      const { fixture } = await renderComponent();
      selectedInfra.set({ type: 'thermique', data: { puissance_nominal: '300', type_intrant: 'Gaz' } });
      expect(fixture.componentInstance.getInfoFields().map((f) => f.label)).toContain("Type d'intrant");

      selectedInfra.set({ type: 'nucleaire', data: { puissance_nominal: '900' } });
      expect(fixture.componentInstance.getInfoFields().map((f) => f.label)).not.toContain("Type d'intrant");
    });

    it('should include vulgarisation fields when puissance_nominal is set', async () => {
      selectedInfra.set({ type: 'hydro', data: { type_barrage: 'Réservoir', puissance_nominal: '1000' } });
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.getInfoFields().some((f) => f.isVulgarisation)).toBe(true);
    });
  });

  describe('getHQImageUrl', () => {
    it('should return null without infra or nom', async () => {
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.getHQImageUrl()).toBeNull();
      selectedInfra.set({ type: 'hydro', data: {} });
      expect(fixture.componentInstance.getHQImageUrl()).toBeNull();
    });

    it('should return null for unknown dam name', async () => {
      selectedInfra.set({ type: 'hydro', data: { nom: 'XYZ_NOMATCH_12345' } });
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.getHQImageUrl()).toBeNull();
    });
  });

  describe('isNewDam / pMin / pMax', () => {
    it('should return false for isNewDam and 0 for pMin/pMax without infra', async () => {
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.isNewDam()).toBe(false);
      expect(fixture.componentInstance.pMin()).toBe(0);
      expect(fixture.componentInstance.pMax()).toBe(0);
    });

    it('isNewDam should be true for hydro ending in _new', async () => {
      selectedInfra.set({ type: 'hydro', data: { nom: 'barrage_new' } });
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.isNewDam()).toBe(true);
    });
  });

  describe('openCycleVie / closeCycleVie / getCycleVieData / getIconForType', () => {
    it('should toggle showCycleVieModal', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.openCycleVie();
      expect(fixture.componentInstance.showCycleVieModal).toBe(true);
      fixture.componentInstance.closeCycleVie();
      expect(fixture.componentInstance.showCycleVieModal).toBe(false);
    });

    it('getCycleVieData returns null without infra and data with hydro', async () => {
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.getCycleVieData()).toBeNull();
      selectedInfra.set({ type: 'hydro', data: {} });
      expect(fixture.componentInstance.getCycleVieData()).toBeTruthy();
    });

    it('getIconForType returns correct icon or empty string', async () => {
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.getIconForType('hydro')).toBe('/icons/barrage.png');
      expect(fixture.componentInstance.getIconForType('unknown')).toBe('');
    });
  });
});
