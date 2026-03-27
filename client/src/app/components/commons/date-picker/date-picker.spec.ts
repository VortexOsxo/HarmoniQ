import { render, screen, fireEvent } from '@testing-library/angular';
import { DatePicker } from './date-picker';

const FIXED_START = '2035-01-01';
const FIXED_END = '2035-12-31';

describe('DatePicker', () => {
  afterEach(() => vi.clearAllMocks());

  it('should render the date picker component', async () => {
    await render(DatePicker);
    expect(screen.getByLabelText('Début')).toBeInTheDocument();
  });

  describe('default values', () => {
    it('should render "date" as the default title label', async () => {
      await render(DatePicker);
      expect(screen.getByText('date')).toBeInTheDocument();
    });

    it('should render the start date input with min 2010-01-01', async () => {
      await render(DatePicker);
      const startInput = screen.getByLabelText('Début');
      expect(startInput).toHaveAttribute('min', '2010-01-01');
    });

    it('should render the end date input with max 2050-12-31', async () => {
      await render(DatePicker);
      const endInput = screen.getByLabelText('Fin');
      expect(endInput).toHaveAttribute('max', '2050-12-31');
    });
  });

  describe('@Input() startDate', () => {
    it('should render the provided start date in the input', async () => {
      await render(DatePicker, {
        componentInputs: { startDate: FIXED_START },
      });
      const startInput = screen.getByLabelText('Début') as HTMLInputElement;
      expect(startInput.value).toBe(FIXED_START);
    });
  });

  describe('@Input() endDate', () => {
    it('should render the provided end date in the input', async () => {
      await render(DatePicker, {
        componentInputs: { endDate: FIXED_END },
      });
      const endInput = screen.getByLabelText('Fin') as HTMLInputElement;
      expect(endInput.value).toBe(FIXED_END);
    });
  });

  describe('@Output() startDateChange', () => {
    it('should emit when the start date input changes', async () => {
      const startDateChange = vi.fn();
      await render(DatePicker, {
        componentOutputs: { startDateChange: { emit: startDateChange } as any },
      });

      const startInput = screen.getByLabelText('Début');
      fireEvent.input(startInput, { target: { value: FIXED_START } });

      expect(startDateChange).toHaveBeenCalled();
    });

    it('should emit the new start date value', async () => {
      const startDateChange = vi.fn();
      await render(DatePicker, {
        componentOutputs: { startDateChange: { emit: startDateChange } as any },
      });

      const startInput = screen.getByLabelText('Début');
      fireEvent.input(startInput, { target: { value: FIXED_START } });

      expect(startDateChange).toHaveBeenCalledWith(FIXED_START);
    });
  });

  describe('@Output() endDateChange', () => {
    it('should emit when the end date input changes', async () => {
      const endDateChange = vi.fn();
      await render(DatePicker, {
        componentOutputs: { endDateChange: { emit: endDateChange } as any },
      });

      const endInput = screen.getByLabelText('Fin');
      fireEvent.input(endInput, { target: { value: FIXED_END } });

      expect(endDateChange).toHaveBeenCalled();
    });

    it('should emit the new end date value', async () => {
      const endDateChange = vi.fn();
      await render(DatePicker, {
        componentOutputs: { endDateChange: { emit: endDateChange } as any },
      });

      const endInput = screen.getByLabelText('Fin');
      fireEvent.input(endInput, { target: { value: FIXED_END } });

      expect(endDateChange).toHaveBeenCalledWith(FIXED_END);
    });
  });
});
