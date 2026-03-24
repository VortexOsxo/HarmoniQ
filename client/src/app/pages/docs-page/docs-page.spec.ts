import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideRouter } from '@angular/router';
import { DocsPage } from './docs-page';

async function renderComponent() {
  return render(DocsPage, {
    providers: [provideRouter([])],
    schemas: [NO_ERRORS_SCHEMA],
  });
}

describe('DocsPage', () => {
  it('should render the docs page component', async () => {
    const { container } = await renderComponent();
    expect(container).toBeTruthy();
  });

  it('should render the production type selector', async () => {
    await renderComponent();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  describe('toggleDetail', () => {
    it('should expand a function detail section when its title is clicked', async () => {
      const user = userEvent.setup();
      await renderComponent();

      // Select a production type to make its section visible first
      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'eolienne');

      const adjustWindSpeedLink = screen.getByText(/adjust_wind_speed/i);
      await user.click(adjustWindSpeedLink);

      const detailSection = document.getElementById('adjust_wind_speed');
      expect(detailSection).toHaveClass('active');
    });

    it('should collapse a function detail section when its title is clicked twice', async () => {
      const user = userEvent.setup();
      await renderComponent();

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'eolienne');

      const adjustWindSpeedLink = screen.getByText(/adjust_wind_speed/i);
      await user.click(adjustWindSpeedLink);
      await user.click(adjustWindSpeedLink);

      const detailSection = document.getElementById('adjust_wind_speed');
      expect(detailSection).not.toHaveClass('active');
    });

    it('should handle multiple independent detail sections toggled simultaneously', async () => {
      const user = userEvent.setup();
      await renderComponent();

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'eolienne');

      await user.click(screen.getByText(/adjust_wind_speed/i));
      await user.click(screen.getByText(/air_density/i));

      expect(document.getElementById('adjust_wind_speed')).toHaveClass('active');
      expect(document.getElementById('air_density')).toHaveClass('active');
    });
  });

  describe('onSelectionChange', () => {
    it('should show the corresponding description section when a production type is selected', async () => {
      const user = userEvent.setup();
      await renderComponent();

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'hydro');

      const hydroSection = document.getElementById('hydro');
      expect(hydroSection).toHaveClass('active');
    });

    it('should hide other sections when a different production type is selected', async () => {
      const user = userEvent.setup();
      await renderComponent();

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'eolienne');

      const hydroSection = document.getElementById('hydro');
      expect(hydroSection).not.toHaveClass('active');
    });

    it('should hide all sections when the empty option is selected', async () => {
      const user = userEvent.setup();
      await renderComponent();

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'hydro');
      await user.selectOptions(select, '');

      const hydroSection = document.getElementById('hydro');
      expect(hydroSection).not.toHaveClass('active');
    });
  });

  describe('getHeroStyle', () => {
    it('should apply no inline background-image when no production type is selected', async () => {
      await renderComponent();
      const heroSection = document.querySelector('.hero-section') as HTMLElement;
      expect(heroSection?.style.backgroundImage).toBeFalsy();
    });

    it('should apply a background-image style when a valid production type is selected', async () => {
      const user = userEvent.setup();
      await renderComponent();

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'hydro');

      const heroSection = document.querySelector('.hero-section') as HTMLElement;
      expect(heroSection?.style.backgroundImage).toContain('url(');
    });
  });
});
