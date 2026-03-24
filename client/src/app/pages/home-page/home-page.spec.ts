import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { HomePage } from './home-page';

const mockRouter = { navigate: vi.fn() };

describe('HomePage', () => {
  afterEach(() => vi.clearAllMocks());

  async function renderComponent() {
    return render(HomePage, {
      providers: [
        { provide: Router, useValue: mockRouter },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
  }

  it('should render the home page', async () => {
    await renderComponent();
    expect(screen.getByText('HarmoniQ')).toBeInTheDocument();
  });

  describe('navigate', () => {
    it('should call router.navigate with /map when Simulation is clicked', async () => {
      const user = userEvent.setup();
      await renderComponent();

      await user.click(screen.getByRole('button', { name: 'Simulation' }));

      expect(mockRouter.navigate).toHaveBeenCalledWith(['map']);
    });

    it('should call router.navigate with /à-propos when À Propos is clicked', async () => {
      const user = userEvent.setup();
      await renderComponent();

      await user.click(screen.getByRole('button', { name: 'À Propos' }));

      expect(mockRouter.navigate).toHaveBeenCalledWith(['à-propos']);
    });

    it('should call router.navigate with /documentation when Documentation is clicked', async () => {
      const user = userEvent.setup();
      await renderComponent();

      await user.click(screen.getByRole('button', { name: 'Documentation' }));

      expect(mockRouter.navigate).toHaveBeenCalledWith(['documentation']);
    });
  });
});
