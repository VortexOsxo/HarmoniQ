import { TestBed } from '@angular/core/testing';
import { SimulationStepService } from './simulation-step-service';
import { SimulationStep } from '@app/models/interfaces/simulation-step';
import { Scenario } from '@app/models/scenario';
import { Weather } from '@app/models/weather';
import { Consumption } from '@app/models/consumption';

const MOCK_SCENARIO: Scenario = {
  id: 1,
  nom: 'Scénario Test',
  description: 'Test description',
  date_de_debut: '2035-01-01T00:00:00',
  date_de_fin: '2035-12-31T00:00:00',
  pas_de_temps: 'PT1H',
  weather: Weather.Typical,
  consomation: Consumption.Normal,
};

const createMockStep = (name: string): SimulationStep => ({
  getStepName: vi.fn().mockReturnValue(name),
  generate: vi.fn().mockResolvedValue(undefined),
});

describe('SimulationStepService', () => {
  let service: SimulationStepService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SimulationStepService],
    });
    service = TestBed.inject(SimulationStepService);
  });

  afterEach(() => vi.clearAllMocks());

  describe('currentStepName (computed)', () => {
    it('should return "Initialisation" when currentStepIndex is -1', () => {
      expect(service.currentStepName()).toBe('Initialisation');
    });

    it('should return the step name at currentStepIndex', () => {
      service.steps.set([{ name: 'Step Alpha', status: 'loading' }]);
      service.currentStepIndex.set(0);

      expect(service.currentStepName()).toBe('Step Alpha');
    });

    it('should return "Simulation terminée" when index equals steps length', () => {
      service.steps.set([{ name: 'Step A', status: 'completed' }]);
      service.currentStepIndex.set(1);

      expect(service.currentStepName()).toBe('Simulation terminée');
    });
  });

  describe('runSteps', () => {
    it('should initialize all steps as pending before execution', async () => {
      let statusesDuringExecution: string[] = [];

      const step1: SimulationStep = {
        getStepName: vi.fn().mockReturnValue('Step 1'),
        generate: vi.fn().mockImplementation(async () => {
          statusesDuringExecution = service.steps().map(s => s.status);
        }),
      };
      const step2 = createMockStep('Step 2');

      await service.runSteps([step1, step2], MOCK_SCENARIO);

      expect(statusesDuringExecution[0]).toBe('loading');
      expect(statusesDuringExecution[1]).toBe('pending');
    });

    it('should call generate() on each step with the provided scenario', async () => {
      const step1 = createMockStep('Step A');
      const step2 = createMockStep('Step B');

      await service.runSteps([step1, step2], MOCK_SCENARIO);

      expect(step1.generate).toHaveBeenCalledWith(MOCK_SCENARIO);
      expect(step2.generate).toHaveBeenCalledWith(MOCK_SCENARIO);
    });

    it('should call steps in sequential order', async () => {
      const order: string[] = [];
      const step1: SimulationStep = {
        getStepName: vi.fn().mockReturnValue('First'),
        generate: vi.fn().mockImplementation(async () => { order.push('First'); }),
      };
      const step2: SimulationStep = {
        getStepName: vi.fn().mockReturnValue('Second'),
        generate: vi.fn().mockImplementation(async () => { order.push('Second'); }),
      };

      await service.runSteps([step1, step2], MOCK_SCENARIO);

      expect(order).toEqual(['First', 'Second']);
    });

    it('should mark each step as completed after generate() resolves', async () => {
      const step1 = createMockStep('OnlyStep');

      await service.runSteps([step1], MOCK_SCENARIO);

      expect(service.steps()[0].status).toBe('completed');
    });

    it('should set currentStepIndex to steps.length after all steps complete', async () => {
      const steps = [createMockStep('S1'), createMockStep('S2')];

      await service.runSteps(steps, MOCK_SCENARIO);

      expect(service.currentStepIndex()).toBe(2);
    });
  });
});
