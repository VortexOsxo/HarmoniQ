import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { NO_ERRORS_SCHEMA, signal, ChangeDetectorRef } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { InfraDetailModal } from './infra-detail-modal';
import { InfraDetailService } from '@app/services/infra-detail-service';
import { InfrastruturesService } from '@app/services/infrastrutures-service';
import { ProtectedAreasService } from '@app/services/protected-areas-service';

vi.mock('leaflet', () => ({
  default: { icon: vi.fn().mockReturnValue({}), divIcon: vi.fn().mockReturnValue({}) },
  icon: vi.fn().mockReturnValue({}),
  divIcon: vi.fn().mockReturnValue({}),
}));

const selectedInfra = signal<any>(null);

const mockInfraDetailService = {
  isOpen: signal(false),
  selectedInfra,
  closeDetail: vi.fn(),
};

const mockInfrasService = {
  deleteLocalInfra: vi.fn(),
};

const mockModalService = {
  open: vi.fn().mockReturnValue({ componentInstance: {}, result: Promise.resolve(false) }),
};

const mockProtectedAreasService = {
  checkProtectedArea: vi.fn().mockResolvedValue(null),
};

const mockCdr = { detectChanges: vi.fn(), markForCheck: vi.fn() };

const providers = [
  { provide: InfraDetailService, useValue: mockInfraDetailService },
  { provide: InfrastruturesService, useValue: mockInfrasService },
  { provide: NgbModal, useValue: mockModalService },
  { provide: ProtectedAreasService, useValue: mockProtectedAreasService },
  { provide: ChangeDetectorRef, useValue: mockCdr },
];

async function renderComponent() {
  return render(InfraDetailModal, { providers, schemas: [NO_ERRORS_SCHEMA] });
}

describe('InfraDetailModal', () => {
  beforeEach(() => {
    selectedInfra.set(null);
    mockInfraDetailService.isOpen.set(false);
  });

  afterEach(() => vi.clearAllMocks());

  it('should render the infra detail modal component', async () => {
    const { container } = await renderComponent();
    expect(container).toBeTruthy();
  });

  describe('isOpen computed', () => {
    it('should mirror infraDetailService.isOpen signal (false)', async () => {
      mockInfraDetailService.isOpen.set(false);
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.isOpen()).toBe(false);
    });

    it('should mirror infraDetailService.isOpen signal (true)', async () => {
      mockInfraDetailService.isOpen.set(true);
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.isOpen()).toBe(true);
    });
  });

  describe('close', () => {
    it('should call infraDetailService.closeDetail', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.close();
      expect(mockInfraDetailService.closeDetail).toHaveBeenCalled();
    });

    it('should reset showCycleVieModal to false', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.showCycleVieModal = true;
      fixture.componentInstance.close();
      expect(fixture.componentInstance.showCycleVieModal).toBe(false);
    });

    it('should reset showImageOverlay to false', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.showImageOverlay = true;
      fixture.componentInstance.close();
      expect(fixture.componentInstance.showImageOverlay).toBe(false);
    });

    it('should render the close button and clicking it calls closeDetail', async () => {
      mockInfraDetailService.isOpen.set(true);
      const user = userEvent.setup();
      await renderComponent();
      const closeBtn = screen.getByTitle('Fermer');
      await user.click(closeBtn);
      expect(mockInfraDetailService.closeDetail).toHaveBeenCalled();
    });
  });

  describe('getIconForType', () => {
    it('should return barrage icon for hydro', async () => {
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.getIconForType('hydro')).toBe('/icons/barrage.png');
    });

    it('should return eolienne icon for eolienneparc', async () => {
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.getIconForType('eolienneparc')).toBe('/icons/eolienne.png');
    });

    it('should return solaire icon for solaire', async () => {
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.getIconForType('solaire')).toBe('/icons/solaire.png');
    });

    it('should return thermique icon for thermique', async () => {
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.getIconForType('thermique')).toBe('/icons/thermique.png');
    });

    it('should return nucleaire icon for nucleaire', async () => {
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.getIconForType('nucleaire')).toBe('/icons/nucelaire.png');
    });

    it('should return empty string for unknown type', async () => {
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.getIconForType('unknown')).toBe('');
    });
  });

  describe('getPluralCategoryName', () => {
    it('should return empty string when no infra is selected', async () => {
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.getPluralCategoryName()).toBe('');
    });

    it('should return barrages hydroélectriques for hydro', async () => {
      selectedInfra.set({ type: 'hydro', categoryName: 'Barrage', data: {} });
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.getPluralCategoryName()).toBe('barrages hydroélectriques');
    });

    it('should return parcs éoliens for eolienneparc', async () => {
      selectedInfra.set({ type: 'eolienneparc', categoryName: 'Parc éolien', data: {} });
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.getPluralCategoryName()).toBe('parcs éoliens');
    });

    it('should return parcs solaires for solaire', async () => {
      selectedInfra.set({ type: 'solaire', categoryName: 'Parc solaire', data: {} });
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.getPluralCategoryName()).toBe('parcs solaires');
    });

    it('should return centrales thermiques for thermique', async () => {
      selectedInfra.set({ type: 'thermique', categoryName: 'Centrale thermique', data: {} });
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.getPluralCategoryName()).toBe('centrales thermiques');
    });

    it('should return centrales nucléaires for nucleaire', async () => {
      selectedInfra.set({ type: 'nucleaire', categoryName: 'Centrale nucléaire', data: {} });
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.getPluralCategoryName()).toBe('centrales nucléaires');
    });
  });

  describe('openCycleVie / closeCycleVie', () => {
    it('should set showCycleVieModal to true when openCycleVie is called', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.openCycleVie();
      expect(fixture.componentInstance.showCycleVieModal).toBe(true);
    });

    it('should set showCycleVieModal to false when closeCycleVie is called', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.showCycleVieModal = true;
      fixture.componentInstance.closeCycleVie();
      expect(fixture.componentInstance.showCycleVieModal).toBe(false);
    });
  });
});
