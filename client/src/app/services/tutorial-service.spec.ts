import { TutorialService } from './tutorial-service';

const STORAGE_KEY = 'harmoniq_tutorial_completed';

const createLocalStorageMock = () => {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { store.set(key, value); }),
    removeItem: vi.fn((key: string) => { store.delete(key); }),
    clear: vi.fn(() => { store.clear(); }),
    _store: store,
  };
};

describe('TutorialService', () => {
  let service: TutorialService;
  let mockStorage: ReturnType<typeof createLocalStorageMock>;

  beforeEach(() => {
    mockStorage = createLocalStorageMock();
    vi.stubGlobal('localStorage', mockStorage);
    service = new TutorialService();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('totalSteps', () => {
    it('should return the total number of tutorial steps', () => {
      expect(service.totalSteps).toBe(service.steps.length);
      expect(service.totalSteps).toBeGreaterThan(0);
    });
  });

  describe('currentState', () => {
    it('should be inactive with step 0 by default', () => {
      expect(service.currentState).toEqual({ active: false, currentStep: 0, showWelcome: false });
    });
  });

  describe('autoStart', () => {
    it('should start tutorial with showWelcome:true when key is absent from localStorage', () => {
      service.autoStart();

      expect(service.currentState).toEqual({ active: true, currentStep: 0, showWelcome: true });
    });

    it('should not start tutorial when key is present in localStorage', () => {
      mockStorage._store.set(STORAGE_KEY, 'true');

      service.autoStart();

      expect(service.currentState.active).toBe(false);
    });
  });

  describe('startTutorial', () => {
    it('should set active:true, currentStep:0, showWelcome:false', () => {
      service.startTutorial();

      expect(service.currentState).toEqual({ active: true, currentStep: 0, showWelcome: false });
    });
  });

  describe('nextStep', () => {
    it('should increment currentStep by 1', () => {
      service.startTutorial();
      service.nextStep();

      expect(service.currentState.currentStep).toBe(1);
    });

    it('should complete the tutorial when called on the last step', () => {
      service.startTutorial();
      const lastIndex = service.steps.length - 1;
      for (let i = 0; i < lastIndex; i++) {
        service.nextStep();
      }
      expect(service.currentState.currentStep).toBe(lastIndex);

      service.nextStep();

      expect(service.currentState.active).toBe(false);
      expect(mockStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'true');
    });
  });

  describe('previousStep', () => {
    it('should decrement currentStep by 1 when not at step 0', () => {
      service.startTutorial();
      service.nextStep();
      service.previousStep();

      expect(service.currentState.currentStep).toBe(0);
    });

    it('should not go below step 0', () => {
      service.startTutorial();
      service.previousStep();

      expect(service.currentState.currentStep).toBe(0);
    });
  });

  describe('skipTutorial', () => {
    it('should set active:false', () => {
      service.startTutorial();
      service.skipTutorial();

      expect(service.currentState.active).toBe(false);
    });

    it('should save the completed key to localStorage', () => {
      service.skipTutorial();

      expect(mockStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'true');
    });
  });

  describe('resetTutorial', () => {
    it('should remove the completed key from localStorage', () => {
      mockStorage._store.set(STORAGE_KEY, 'true');

      service.resetTutorial();

      expect(mockStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it('should restart tutorial with showWelcome:true', () => {
      service.resetTutorial();

      expect(service.currentState).toEqual({ active: true, currentStep: 0, showWelcome: true });
    });
  });

  describe('tutorialState$', () => {
    it('should emit current state changes as an observable', () => {
      const emissions: any[] = [];
      service.tutorialState$.subscribe(s => emissions.push(s));

      service.startTutorial();

      const lastEmission = emissions[emissions.length - 1];
      expect(lastEmission.active).toBe(true);
    });
  });
});
