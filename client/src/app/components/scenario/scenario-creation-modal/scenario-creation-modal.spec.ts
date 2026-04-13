import { render, screen } from '@testing-library/angular';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ScenarioCreationModal } from './scenario-creation-modal';
import { ScenariosService } from '@app/services/scenarios-service';
import { Scenario } from '@app/models/scenario';
import { Weather } from '@app/models/weather';
import { Consumption } from '@app/models/consumption';

const MOCK_CREATED_SCENARIO: Scenario = {
  id: 999,
  nom: 'Mon Scénario',
  description: 'Description test',
  date_de_debut: '2035-01-01T00:00:00',
  date_de_fin: '2035-12-31T00:00:00',
  pas_de_temps: 'PT1H',
  weather: Weather.Typical,
  consomation: Consumption.Normal,
};

const mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };
const mockScenariosService = { 
  createScenario: vi.fn(),
  scenarios: signal<any[]>([])
};

describe('ScenarioCreationModal', () => {
  afterEach(() => vi.clearAllMocks());

  async function renderComponent() {
    return render(ScenarioCreationModal, {
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ScenariosService, useValue: mockScenariosService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
  }

  it('should create the scenario creation modal component', async () => {
    const { fixture } = await renderComponent();
    expect(fixture.componentInstance).toBeTruthy();
  });

  describe('initial state', () => {
    it('should render the modal title', async () => {
      await renderComponent();
      expect(screen.getByText('Nouveau scénario')).toBeInTheDocument();
    });

    it('should expose Weather enum', async () => {
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.Weather).toBeDefined();
    });

    it('should expose Consumption enum', async () => {
      const { fixture } = await renderComponent();
      expect(fixture.componentInstance.Consumption).toBeDefined();
    });
  });

  describe('onSubmit', () => {
    it('should call scenariosService.createScenario with the current scenario', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.scenario = MOCK_CREATED_SCENARIO;

      fixture.componentInstance.onSubmit();

      expect(mockScenariosService.createScenario).toHaveBeenCalledWith(MOCK_CREATED_SCENARIO);
    });

    it('should close the modal after submitting', async () => {
      const { fixture } = await renderComponent();
      fixture.componentInstance.scenario = MOCK_CREATED_SCENARIO;

      fixture.componentInstance.onSubmit();

      expect(mockActiveModal.close).toHaveBeenCalled();
    });
  });

  describe('dismiss', () => {
    it('should call activeModal.dismiss()', async () => {
      const { fixture } = await renderComponent();

      fixture.componentInstance.dismiss();

      expect(mockActiveModal.dismiss).toHaveBeenCalled();
    });
  });
});
