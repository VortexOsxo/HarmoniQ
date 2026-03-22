import { TestBed, ComponentFixture } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BehaviorSubject } from 'rxjs';
import { MapPage } from './map-page';
import { TutorialService, TutorialState } from '@app/services/tutorial-service';
import { InfraDetailService } from '@app/services/infra-detail-service';

vi.mock('leaflet.markercluster', () => ({}));

vi.mock('leaflet', () => ({
  default: { icon: vi.fn().mockReturnValue({}), divIcon: vi.fn().mockReturnValue({}) },
  icon: vi.fn().mockReturnValue({}),
  divIcon: vi.fn().mockReturnValue({}),
}));

const INACTIVE_STATE: TutorialState = { active: false, currentStep: 0, showWelcome: false };

const tutorialState$ = new BehaviorSubject<TutorialState>(INACTIVE_STATE);

const mockTutorialService = {
  tutorialState$,
  autoStart: vi.fn(),
};

const mockInfraDetailService = {
  closeDetail: vi.fn(),
};

describe('MapPage', () => {
  let component: MapPage;
  let fixture: ComponentFixture<MapPage>;

  beforeEach(async () => {
    tutorialState$.next(INACTIVE_STATE);

    await TestBed.configureTestingModule({
      imports: [MapPage],
      providers: [
        { provide: TutorialService, useValue: mockTutorialService },
        { provide: InfraDetailService, useValue: mockInfraDetailService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(MapPage, { set: { template: '', imports: [CommonModule] } })
      .compileComponents();

    fixture = TestBed.createComponent(MapPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  it('should create the map page component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize showSourcesPanel to false', () => {
    expect(component.showSourcesPanel).toBe(false);
  });

  describe('toggleSourcesPanel', () => {
    it('should set showSourcesPanel to true when it was false', () => {
      component.showSourcesPanel = false;
      component.toggleSourcesPanel();
      expect(component.showSourcesPanel).toBe(true);
    });

    it('should set showSourcesPanel to false when it was true', () => {
      component.showSourcesPanel = true;
      component.toggleSourcesPanel();
      expect(component.showSourcesPanel).toBe(false);
    });
  });

  describe('closeSourcesPanel', () => {
    it('should set showSourcesPanel to false', () => {
      component.showSourcesPanel = true;
      component.closeSourcesPanel();
      expect(component.showSourcesPanel).toBe(false);
    });
  });

  describe('ngOnDestroy', () => {
    it('should call infraDetailService.closeDetail on destroy', () => {
      component.ngOnDestroy();
      expect(mockInfraDetailService.closeDetail).toHaveBeenCalled();
    });
  });

  describe('tutorial subscription', () => {
    it('should close sources panel when tutorial becomes active with welcome screen', () => {
      component.showSourcesPanel = true;
      tutorialState$.next({ active: true, currentStep: 0, showWelcome: true });
      expect(component.showSourcesPanel).toBe(false);
    });

    it('should not close sources panel when tutorial is not active', () => {
      component.showSourcesPanel = true;
      tutorialState$.next({ active: false, currentStep: 0, showWelcome: false });
      expect(component.showSourcesPanel).toBe(true);
    });
  });
});
