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
    expect(screen.getByText('Harmoni')).toBeInTheDocument();
  });

  describe('navigate', () => {
    it('should call router.navigate with /map when Lancez une simulation is clicked', async () => {
      const user = userEvent.setup();
      await renderComponent();

      await user.click(screen.getByRole('button', { name: 'Lancez une simulation !' }));

      expect(mockRouter.navigate).toHaveBeenCalledWith(['map']);
    });
  });
});
