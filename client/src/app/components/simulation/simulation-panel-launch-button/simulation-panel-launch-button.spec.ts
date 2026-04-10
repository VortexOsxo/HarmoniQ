import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { SimulationPanelLaunchButton } from './simulation-panel-launch-button';
import { SimulationService } from '@app/services/simulation-service';

const canLaunch = signal(false);

const mockSimulationService = {
  canLaunch,
  requestLaunchFromMap: vi.fn(),
  showLaunchConfigHints: signal(false),
  productionNodes: signal(null),
  openSourcesPanel$: new Subject<void>(),
};

describe('SimulationPanelLaunchButton', () => {
  beforeEach(() => {
    canLaunch.set(false);
    vi.clearAllMocks();
  });

  it('should call requestLaunchFromMap when clicked', async () => {
    const user = userEvent.setup();
    await render(SimulationPanelLaunchButton, {
      providers: [{ provide: SimulationService, useValue: mockSimulationService }],
      schemas: [NO_ERRORS_SCHEMA],
    });

    await user.click(screen.getByRole('button', { name: /Lancer Simulation/i }));

    expect(mockSimulationService.requestLaunchFromMap).toHaveBeenCalled();
  });

  it('should render the launch button with inactive class when canLaunch is false', async () => {
    canLaunch.set(false);

    await render(SimulationPanelLaunchButton, {
      providers: [{ provide: SimulationService, useValue: mockSimulationService }],
      schemas: [NO_ERRORS_SCHEMA],
    });

    const btn = screen.getByRole('button', { name: /Lancer Simulation/i });
    expect(btn.classList.contains('hq-btn-green-inactive')).toBe(true);
  });

  it('should render the launch button without inactive class when canLaunch is true', async () => {
    canLaunch.set(true);

    await render(SimulationPanelLaunchButton, {
      providers: [{ provide: SimulationService, useValue: mockSimulationService }],
      schemas: [NO_ERRORS_SCHEMA],
    });

    const btn = screen.getByRole('button', { name: /Lancer Simulation/i });
    expect(btn.classList.contains('hq-btn-green-inactive')).toBe(false);
  });
});
