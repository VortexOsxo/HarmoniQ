import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { SimulationLauncher } from './simulation-launcher';
import { SimulationService } from '@app/services/simulation-service';
import { ScenariosService } from '@app/services/scenarios-service';
import { InfrastruturesService } from '@app/services/infrastrutures-service';
import { InfrastructureGroup } from '@app/models/infrastructure-group';
import { Scenario } from '@app/models/scenario';
import { Weather } from '@app/models/weather';
import { Consumption } from '@app/models/consumption';

vi.mock('leaflet', () => ({
  default: { icon: vi.fn().mockReturnValue({}), divIcon: vi.fn().mockReturnValue({}) },
  icon: vi.fn().mockReturnValue({}),
  divIcon: vi.fn().mockReturnValue({}),
}));

const MOCK_SCENARIO: Scenario = {
  id: 1,
  nom: 'Scénario 2035',
  description: 'Base',
  date_de_debut: '2035-01-01T00:00:00',
  date_de_fin: '2035-12-31T00:00:00',
  pas_de_temps: 'PT1H',
  weather: Weather.Typical,
  consomation: Consumption.Normal,
};

const MOCK_GROUP: InfrastructureGroup = {
  id: 10,
  nom: 'Mon Groupe',
  parc_eoliens: [],
  parc_solaires: [],
  central_hydroelectriques: [],
  central_thermique: [],
  central_nucleaire: [],
};

const canLaunch = signal(false);
const selectedScenario = signal<Scenario | null>(null);
const selectedInfraGroup = signal<InfrastructureGroup | null>(null);

const mockSimulationService = {
  canLaunch,
  productionNodes: signal(null),
  openSourcesPanel$: new Subject<void>(),
  hasExportableData: signal(false),
  launchSimulation: vi.fn(),
};

const mockScenariosService = { selectedScenario };

const mockInfrastruturesService = {
  selectedInfraGroup,
  infraGroups: signal([] as InfrastructureGroup[]),
};

const mockRouter = { navigate: vi.fn() };

const defaultProviders = [
  { provide: SimulationService, useValue: mockSimulationService },
  { provide: ScenariosService, useValue: mockScenariosService },
  { provide: InfrastruturesService, useValue: mockInfrastruturesService },
  { provide: Router, useValue: mockRouter },
];

describe('SimulationLauncher', () => {
  beforeEach(() => {
    canLaunch.set(false);
    selectedScenario.set(null);
    selectedInfraGroup.set(null);
  });

  afterEach(() => vi.clearAllMocks());

  it('should render the CONFIGURATION ACTIVE label', async () => {
    await render(SimulationLauncher, {
      providers: defaultProviders,
      schemas: [NO_ERRORS_SCHEMA],
    });

    expect(screen.getByText(/CONFIGURATION ACTIVE/i)).toBeInTheDocument();
  });

  describe('launchSimulation', () => {
    it('should navigate to /simulation when the launch button is clicked', async () => {
      const user = userEvent.setup();
      canLaunch.set(true);

      await render(SimulationLauncher, {
        providers: defaultProviders,
        schemas: [NO_ERRORS_SCHEMA],
      });

      await user.click(screen.getByRole('button', { name: /Lancer Simulation/i }));

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/simulation']);
    });
  });

  describe('canLaunch signal', () => {
    it('should render the launch button as disabled when canLaunch is false', async () => {
      canLaunch.set(false);

      await render(SimulationLauncher, {
        providers: defaultProviders,
        schemas: [NO_ERRORS_SCHEMA],
      });

      expect(screen.getByRole('button', { name: /Lancer Simulation/i })).toBeDisabled();
    });

    it('should render the launch button as enabled when canLaunch is true', async () => {
      canLaunch.set(true);

      await render(SimulationLauncher, {
        providers: defaultProviders,
        schemas: [NO_ERRORS_SCHEMA],
      });

      expect(screen.getByRole('button', { name: /Lancer Simulation/i })).not.toBeDisabled();
    });
  });

  describe('selectedScenario display', () => {
    it('should show "Aucun" when no scenario is selected', async () => {
      selectedScenario.set(null);

      await render(SimulationLauncher, {
        providers: defaultProviders,
        schemas: [NO_ERRORS_SCHEMA],
      });

      const scenarioValues = screen.getAllByText('Aucun');
      expect(scenarioValues.length).toBeGreaterThanOrEqual(1);
    });

    it('should show the scenario name when a scenario is selected', async () => {
      selectedScenario.set(MOCK_SCENARIO);

      await render(SimulationLauncher, {
        providers: defaultProviders,
        schemas: [NO_ERRORS_SCHEMA],
      });

      expect(screen.getByText('Scénario 2035')).toBeInTheDocument();
    });
  });

  describe('selectedInfrastructure display', () => {
    it('should show "Aucun" for infra group when none is selected', async () => {
      selectedInfraGroup.set(null);

      await render(SimulationLauncher, {
        providers: defaultProviders,
        schemas: [NO_ERRORS_SCHEMA],
      });

      const aucunItems = screen.getAllByText('Aucun');
      expect(aucunItems.length).toBeGreaterThanOrEqual(1);
    });

    it('should show the group name when an infrastructure group is selected', async () => {
      selectedInfraGroup.set(MOCK_GROUP);

      await render(SimulationLauncher, {
        providers: defaultProviders,
        schemas: [NO_ERRORS_SCHEMA],
      });

      expect(screen.getByText('Mon Groupe')).toBeInTheDocument();
    });
  });
});
