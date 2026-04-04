import { render, screen, fireEvent } from '@testing-library/angular';
import { GranularitySelectorComponent } from './granularity-selector';

const GRANULARITIES = ['original', 'daily', 'weekly', 'monthly'];

describe('GranularitySelectorComponent', () => {
  afterEach(() => vi.clearAllMocks());

  it('should render the granularity selector component', async () => {
    await render(GranularitySelectorComponent);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  describe('@Input() selected', () => {
    it('should default to "weekly" as the selected option', async () => {
      await render(GranularitySelectorComponent);
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('weekly');
    });

    it('should reflect a custom selected value', async () => {
      await render(GranularitySelectorComponent, {
        componentInputs: { selected: 'monthly' },
      });
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('monthly');
    });
  });

  describe('@Output() granularityChange', () => {
    it('should emit the selected granularity when the select changes', async () => {
      const granularityChange = vi.fn();
      await render(GranularitySelectorComponent, {
        componentOutputs: { granularityChange: { emit: granularityChange } as any },
      });

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'daily' } });

      expect(granularityChange).toHaveBeenCalledWith('daily');
    });

    it('should emit correct value for each granularity option', async () => {
      const granularityChange = vi.fn();
      await render(GranularitySelectorComponent, {
        componentOutputs: { granularityChange: { emit: granularityChange } as any },
      });
      const select = screen.getByRole('combobox');

      for (const granularity of GRANULARITIES) {
        fireEvent.change(select, { target: { value: granularity } });
        expect(granularityChange).toHaveBeenCalledWith(granularity);
      }
    });
  });
});
