import { TestBed, ComponentFixture } from '@angular/core/testing';
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

describe('InfraDetailModal', () => {
  let component: InfraDetailModal;
  let fixture: ComponentFixture<InfraDetailModal>;

  beforeEach(async () => {
    selectedInfra.set(null);

    await TestBed.configureTestingModule({
      imports: [InfraDetailModal],
      providers: [
        { provide: InfraDetailService, useValue: mockInfraDetailService },
        { provide: InfrastruturesService, useValue: mockInfrasService },
        { provide: NgbModal, useValue: mockModalService },
        { provide: ProtectedAreasService, useValue: mockProtectedAreasService },
        { provide: ChangeDetectorRef, useValue: mockCdr },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(InfraDetailModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  it('should create the infra detail modal component', () => {
    expect(component).toBeTruthy();
  });

  describe('isOpen computed', () => {
    it('should mirror infraDetailService.isOpen', () => {
      expect(component.isOpen()).toBe(false);
    });
  });

  describe('close', () => {
    it('should call infraDetailService.closeDetail', () => {
      component.close();
      expect(mockInfraDetailService.closeDetail).toHaveBeenCalled();
    });

    it('should reset showCycleVieModal to false', () => {
      component.showCycleVieModal = true;
      component.close();
      expect(component.showCycleVieModal).toBe(false);
    });

    it('should reset showImageOverlay to false', () => {
      component.showImageOverlay = true;
      component.close();
      expect(component.showImageOverlay).toBe(false);
    });
  });

  describe('getIconForType', () => {
    it('should return barrage icon for hydro', () => {
      expect(component.getIconForType('hydro')).toBe('/icons/barrage.png');
    });

    it('should return eolienne icon for eolienneparc', () => {
      expect(component.getIconForType('eolienneparc')).toBe('/icons/eolienne.png');
    });

    it('should return solaire icon for solaire', () => {
      expect(component.getIconForType('solaire')).toBe('/icons/solaire.png');
    });

    it('should return thermique icon for thermique', () => {
      expect(component.getIconForType('thermique')).toBe('/icons/thermique.png');
    });

    it('should return nucleaire icon for nucleaire', () => {
      expect(component.getIconForType('nucleaire')).toBe('/icons/nucelaire.png');
    });

    it('should return empty string for unknown type', () => {
      expect(component.getIconForType('unknown')).toBe('');
    });
  });

  describe('getPluralCategoryName', () => {
    it('should return empty string when no infra is selected', () => {
      expect(component.getPluralCategoryName()).toBe('');
    });

    it('should return barrages hydroélectriques for hydro', () => {
      selectedInfra.set({ type: 'hydro', categoryName: 'Barrage', data: {} });
      expect(component.getPluralCategoryName()).toBe('barrages hydroélectriques');
    });

    it('should return parcs éoliens for eolienneparc', () => {
      selectedInfra.set({ type: 'eolienneparc', categoryName: 'Parc éolien', data: {} });
      expect(component.getPluralCategoryName()).toBe('parcs éoliens');
    });

    it('should return parcs solaires for solaire', () => {
      selectedInfra.set({ type: 'solaire', categoryName: 'Parc solaire', data: {} });
      expect(component.getPluralCategoryName()).toBe('parcs solaires');
    });

    it('should return centrales thermiques for thermique', () => {
      selectedInfra.set({ type: 'thermique', categoryName: 'Centrale thermique', data: {} });
      expect(component.getPluralCategoryName()).toBe('centrales thermiques');
    });

    it('should return centrales nucléaires for nucleaire', () => {
      selectedInfra.set({ type: 'nucleaire', categoryName: 'Centrale nucléaire', data: {} });
      expect(component.getPluralCategoryName()).toBe('centrales nucléaires');
    });
  });

  describe('openCycleVie / closeCycleVie', () => {
    it('should set showCycleVieModal to true when openCycleVie is called', () => {
      component.openCycleVie();
      expect(component.showCycleVieModal).toBe(true);
    });

    it('should set showCycleVieModal to false when closeCycleVie is called', () => {
      component.showCycleVieModal = true;
      component.closeCycleVie();
      expect(component.showCycleVieModal).toBe(false);
    });
  });
});
