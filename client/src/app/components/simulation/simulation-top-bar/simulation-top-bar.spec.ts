import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { SimulationTopBar } from './simulation-top-bar';
import { SimulationService } from '@app/services/simulation-service';
import { ScenariosService } from '@app/services/scenarios-service';

vi.mock('leaflet', () => ({
  default: { icon: vi.fn().mockReturnValue({}), divIcon: vi.fn().mockReturnValue({}) },
  icon: vi.fn().mockReturnValue({}),
  divIcon: vi.fn().mockReturnValue({}),
}));

const mockSimulationService = {
  canLaunch: signal(false),
  productionNodes: signal(null),
  openSourcesPanel$: new Subject<void>(),
  hasExportableData: signal(false),
  launchSimulation: vi.fn(),
  exportSimulationToCSV: vi.fn(),
};

const mockScenariosService = {
  selectedScenario: signal<{ nom: string } | null>(null),
};

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

const mockNgbModal = {
  open: vi.fn(),
};

describe('SimulationTopBar', () => {
  afterEach(() => vi.clearAllMocks());

  async function renderComponent(scenariosService = mockScenariosService) {
    return render(SimulationTopBar, {
      providers: [
        provideRouter([]),
        { provide: SimulationService, useValue: mockSimulationService },
        { provide: ScenariosService, useValue: scenariosService },
        { provide: NgbModal, useValue: mockNgbModal },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
  }

  it('should render the simulation top bar', async () => {
    await renderComponent();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  describe('goBack', () => {
    it('should open confirmation modal and navigate to /map when confirmed', async () => {
      const user = userEvent.setup();
      mockNgbModal.open.mockReturnValue({
        componentInstance: {},
        result: Promise.resolve(true),
      });

      const { fixture } = await renderComponent();
      const router = fixture.debugElement.injector.get(Router);
      const navigateSpy = vi.spyOn(router, 'navigate');

      const backButton = screen.getByTitle('Retour au planificateur');
      await user.click(backButton);

      // wait for promise
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockNgbModal.open).toHaveBeenCalled();
      expect(navigateSpy).toHaveBeenCalledWith(['/map']);
    });
  });

  describe('scenario name display', () => {
    it('should display the scenario name when a scenario is selected', async () => {
      const service = { selectedScenario: signal<{ nom: string } | null>({ nom: 'Scénario Test' }) };
      await renderComponent(service);
      expect(screen.getByText(/Scénario Test/)).toBeInTheDocument();
    });
  });
});
