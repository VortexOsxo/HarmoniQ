import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { NO_ERRORS_SCHEMA, signal, ChangeDetectorRef } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { SimulationSingleInfraModal } from './simulation-single-infra-modal';
import { ScenariosService } from '@app/services/scenarios-service';
import { SimulationService } from '@app/services/simulation-service';
import { GraphService } from '@app/services/graph-service';
import { Scenario } from '@app/models/scenario';
import { Weather } from '@app/models/weather';
import { Consumption } from '@app/models/consumption';

vi.mock('leaflet', () => ({
  default: { icon: vi.fn().mockReturnValue({}), divIcon: vi.fn().mockReturnValue({}) },
  icon: vi.fn().mockReturnValue({}),
  divIcon: vi.fn().mockReturnValue({}),
}));

vi.mock('plotly.js-dist-min', () => ({
  newPlot: vi.fn(),
  purge: vi.fn(),
  downloadImage: vi.fn(),
}));

const MOCK_SCENARIO: Scenario = {
  id: 1,
  nom: 'Année 2035',
  description: 'Base',
  date_de_debut: '2035-01-01T00:00:00',
  date_de_fin: '2035-12-31T00:00:00',
  pas_de_temps: 'PT1H',
  weather: Weather.Typical,
  consomation: Consumption.Normal,
};

const MOCK_PRODUCTION_DATA = { x: ['2035-01-01'], y: [100] };

const mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };

const mockScenariosService = {
  selectedScenario: signal<Scenario | null>(MOCK_SCENARIO),
};

const mockSimulationService = {
  launchSimulationSingleInfra: vi.fn().mockReturnValue(of(MOCK_PRODUCTION_DATA)),
  getInfraCost: vi.fn().mockReturnValue(of({ fixed: 100, variable: 50 })),
  getInfraEmission: vi.fn().mockReturnValue(of({ co2: 0.004 })),
  canLaunch: signal(false),
  productionNodes: signal(null),
};

const mockGraphService = {
  generateProductionSingleInfraGraph: vi.fn(),
};

const mockCdr = { detectChanges: vi.fn(), markForCheck: vi.fn() };

const defaultProviders = [
  { provide: NgbActiveModal, useValue: mockActiveModal },
  { provide: ScenariosService, useValue: mockScenariosService },
  { provide: SimulationService, useValue: mockSimulationService },
  { provide: GraphService, useValue: mockGraphService },
  { provide: ChangeDetectorRef, useValue: mockCdr },
];

async function renderComponent(inputs: Record<string, unknown> = {}) {
  return render(SimulationSingleInfraModal, {
    componentInputs: {
      name: 'Barrage La Grande',
      type: 'hydro',
      id: '7',
      ...inputs,
    },
    providers: defaultProviders,
    schemas: [NO_ERRORS_SCHEMA],
  });
}

describe('SimulationSingleInfraModal', () => {
  afterEach(() => vi.clearAllMocks());

  it('should render the simulation single infra modal component', async () => {
    const { container } = await renderComponent();
    expect(container).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should call launchSimulationSingleInfra with type and id', async () => {
      await renderComponent({ type: 'eolienneparc' });
      expect(mockSimulationService.launchSimulationSingleInfra).toHaveBeenCalledWith('eolienneparc', '7');
    });

    it('should call getInfraCost with type and id', async () => {
      await renderComponent();
      expect(mockSimulationService.getInfraCost).toHaveBeenCalledWith('hydro', '7');
    });

    it('should call getInfraEmission with type and id', async () => {
      await renderComponent();
      expect(mockSimulationService.getInfraEmission).toHaveBeenCalledWith('hydro', '7');
    });

    it('should call generateProductionSingleInfraGraph after receiving data', async () => {
      await renderComponent({ type: 'eolienneparc' });
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(mockGraphService.generateProductionSingleInfraGraph).toHaveBeenCalledWith(
        'eolienneparc',
        MOCK_PRODUCTION_DATA,
        'original',
      );
    });

    it('should hide loading spinner after receiving production data', async () => {
      await renderComponent();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('should render the modal title including the infra name and scenario name', async () => {
      await renderComponent();
      const title = screen.getByRole('heading', { level: 5 });
      expect(title).toHaveTextContent('Barrage La Grande');
      expect(title).toHaveTextContent('Année 2035');
    });
  });

  describe('granularity selector', () => {
    it('should render the granularity selector after loading completes', async () => {
      const { container } = await renderComponent({ type: 'eolienneparc' });
      expect(container.querySelector('app-granularity-selector')).toBeTruthy();
    });
  });

  describe('close button', () => {
    it('should call activeModal.dismiss when the close button is clicked', async () => {
      const user = userEvent.setup();
      await renderComponent();
      const closeBtn = screen.getByRole('button', { name: /fermer/i });
      await user.click(closeBtn);
      expect(mockActiveModal.dismiss).toHaveBeenCalled();
    });
  });
});
