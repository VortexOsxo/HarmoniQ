import { TestBed, ComponentFixture } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BehaviorSubject } from 'rxjs';
import { SimulationResults } from './simulation-results';
import { ProtectedAreasService } from '@app/services/protected-areas-service';
import { ReseauService } from '@app/services/reseau-service';
import { TutorialService, TutorialState } from '@app/services/tutorial-service';
import { InfraDetailService } from '@app/services/infra-detail-service';

vi.mock('leaflet.markercluster', () => ({}));

vi.mock('leaflet', () => ({
  default: {
    icon: vi.fn().mockReturnValue({}),
    divIcon: vi.fn().mockReturnValue({}),
    map: vi.fn().mockReturnValue({ setView: vi.fn(), remove: vi.fn(), addLayer: vi.fn(), on: vi.fn(), invalidateSize: vi.fn() }),
    tileLayer: vi.fn().mockReturnValue({ addTo: vi.fn() }),
    layerGroup: vi.fn().mockReturnValue({ addTo: vi.fn(), clearLayers: vi.fn() }),
    geoJSON: vi.fn().mockReturnValue({ addTo: vi.fn() }),
    marker: vi.fn().mockReturnValue({ addTo: vi.fn(), remove: vi.fn() }),
  },
  icon: vi.fn().mockReturnValue({}),
  divIcon: vi.fn().mockReturnValue({}),
  map: vi.fn().mockReturnValue({ setView: vi.fn(), remove: vi.fn(), addLayer: vi.fn(), on: vi.fn(), invalidateSize: vi.fn() }),
  tileLayer: vi.fn().mockReturnValue({ addTo: vi.fn() }),
  layerGroup: vi.fn().mockReturnValue({ addTo: vi.fn(), clearLayers: vi.fn() }),
  geoJSON: vi.fn().mockReturnValue({ addTo: vi.fn() }),
  marker: vi.fn().mockReturnValue({ addTo: vi.fn(), remove: vi.fn() }),
}));

const isDetailOpen = signal(false);

const mockProtectedAreasService = {
  isVisible: signal(false),
  hide: vi.fn(),
  destroy: vi.fn(),
  initLayer: vi.fn(),
};

const mockReseauService = {
  isVisible: signal(false),
  destroy: vi.fn(),
  initLayer: vi.fn(),
};

const tutorialState$ = new BehaviorSubject<TutorialState>({ active: false, currentStep: 0, showWelcome: false });

const mockTutorialService = {
  tutorialState$,
  autoStart: vi.fn(),
};

const mockInfraDetailService = {
  isOpen: isDetailOpen,
  selectedInfra: signal(null),
  closeDetail: vi.fn(),
};

describe('SimulationResults', () => {
  let component: SimulationResults;
  let fixture: ComponentFixture<SimulationResults>;

  beforeEach(async () => {
    isDetailOpen.set(false);
    tutorialState$.next({ active: false, currentStep: 0, showWelcome: false });

    await TestBed.configureTestingModule({
      imports: [SimulationResults],
      providers: [
        { provide: ProtectedAreasService, useValue: mockProtectedAreasService },
        { provide: ReseauService, useValue: mockReseauService },
        { provide: TutorialService, useValue: mockTutorialService },
        { provide: InfraDetailService, useValue: mockInfraDetailService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(SimulationResults, { set: { template: '', imports: [CommonModule] } })
      .compileComponents();

    fixture = TestBed.createComponent(SimulationResults);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  it('should create the simulation results component', () => {
    expect(component).toBeTruthy();
  });

  describe('isDetailOpen', () => {
    it('should return false when no infra detail is open', () => {
      expect(component.isDetailOpen).toBe(false);
    });

    it('should return true when an infra detail is open', () => {
      isDetailOpen.set(true);
      expect(component.isDetailOpen).toBe(true);
    });
  });

  describe('ngOnInit', () => {
    it('should subscribe to tutorialService state', () => {
      expect(component).toBeTruthy();
    });

    it('should call protectedAreasService.hide() when tutorial is active with welcome', () => {
      tutorialState$.next({ active: true, currentStep: 0, showWelcome: true });
      expect(mockProtectedAreasService.hide).toHaveBeenCalled();
    });
  });

  describe('ngOnDestroy', () => {
    it('should unsubscribe without throwing', () => {
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });
});
