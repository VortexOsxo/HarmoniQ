import { TestBed, ComponentFixture } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, ChangeDetectorRef } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { TutorialOverlay } from './tutorial-overlay';
import { TutorialService, TutorialState, TutorialStep } from '@app/services/tutorial-service';

const MOCK_STEPS: TutorialStep[] = [
  { title: 'Bienvenue', icon: 'fa-hand', description: 'Intro', targetSelector: null, position: 'center' },
  { title: 'Étape 1', icon: 'fa-map', description: 'La carte', targetSelector: '#map', position: 'right' },
  { title: 'Étape 2', icon: 'fa-chart-bar', description: 'Graphes', targetSelector: '#graph', position: 'bottom' },
];

const tutorialState$ = new BehaviorSubject<TutorialState>({ active: false, currentStep: 0, showWelcome: false });

const mockTutorialService = {
  tutorialState$,
  steps: MOCK_STEPS,
  totalSteps: MOCK_STEPS.length,
  startTutorial: vi.fn(),
  nextStep: vi.fn(),
  previousStep: vi.fn(),
  skipTutorial: vi.fn(),
  autoStart: vi.fn(),
};

const mockCdr = { markForCheck: vi.fn(), detectChanges: vi.fn() };

describe('TutorialOverlay', () => {
  let component: TutorialOverlay;
  let fixture: ComponentFixture<TutorialOverlay>;

  beforeEach(async () => {
    tutorialState$.next({ active: false, currentStep: 0, showWelcome: false });

    await TestBed.configureTestingModule({
      imports: [TutorialOverlay],
      providers: [
        { provide: TutorialService, useValue: mockTutorialService },
        { provide: ChangeDetectorRef, useValue: mockCdr },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TutorialOverlay);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  it('should create the tutorial overlay component', () => {
    expect(component).toBeTruthy();
  });

  describe('onStart', () => {
    it('should call tutorialService.startTutorial()', () => {
      component.onStart();
      expect(mockTutorialService.startTutorial).toHaveBeenCalled();
    });
  });

  describe('onNext', () => {
    it('should call tutorialService.nextStep()', () => {
      component.onNext();
      expect(mockTutorialService.nextStep).toHaveBeenCalled();
    });
  });

  describe('onPrevious', () => {
    it('should call tutorialService.previousStep()', () => {
      component.onPrevious();
      expect(mockTutorialService.previousStep).toHaveBeenCalled();
    });
  });

  describe('onSkip', () => {
    it('should call tutorialService.skipTutorial()', () => {
      component.onSkip();
      expect(mockTutorialService.skipTutorial).toHaveBeenCalled();
    });
  });

  describe('progressPercent', () => {
    it('should return (currentStep + 1) / totalSteps * 100', () => {
      component.state = { active: true, currentStep: 0, showWelcome: false };
      expect(component.progressPercent).toBeCloseTo((1 / 3) * 100);
    });

    it('should return 100 at last step', () => {
      component.state = { active: true, currentStep: 2, showWelcome: false };
      expect(component.progressPercent).toBe(100);
    });
  });

  describe('isLastStep', () => {
    it('should be false when not at last step', () => {
      component.state = { active: true, currentStep: 0, showWelcome: false };
      expect(component.isLastStep).toBe(false);
    });

    it('should be true at the last step', () => {
      component.state = { active: true, currentStep: 2, showWelcome: false };
      expect(component.isLastStep).toBe(true);
    });
  });

  describe('totalSteps', () => {
    it('should return the total number of steps from the service', () => {
      expect(component.totalSteps).toBe(MOCK_STEPS.length);
    });
  });

  describe('ngOnDestroy', () => {
    it('should unsubscribe without throwing', () => {
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });
});
