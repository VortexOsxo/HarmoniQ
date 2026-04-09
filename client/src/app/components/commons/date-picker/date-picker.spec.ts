import { render, screen, fireEvent } from '@testing-library/angular';
import { DatePicker } from './date-picker';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

const FIXED_START = '2035-02-15';
const FIXED_END = '2050-11-20';

describe('DatePicker', () => {
  it('should render the component with correct labels', async () => {
    await render(DatePicker, {
      imports: [FormsModule, CommonModule],
    });
    expect(screen.getByText('Début')).toBeInTheDocument();
    expect(screen.getByText('Fin')).toBeInTheDocument();
  });

  it('should render the provided start and end dates', async () => {
    await render(DatePicker, {
      imports: [FormsModule, CommonModule],
      componentInputs: {
        startDate: FIXED_START,
        endDate: FIXED_END,
      },
    });

    // Check Start Date values
    const yearSelects = screen.getAllByRole('combobox');
    // Order: [startYear, startMonth, endYear, endMonth]
    expect(yearSelects[0]).toHaveValue('2035');
    expect(yearSelects[1]).toHaveValue('2'); // Fevrier

    const dayInputs = screen.getAllByPlaceholderText(/[0-9]+/);
    expect(dayInputs[0]).toHaveValue(15);

    // Check End Date values
    expect(yearSelects[2]).toHaveValue('2050');
    expect(yearSelects[3]).toHaveValue('11'); // Novembre
    expect(dayInputs[1]).toHaveValue(20);
  });

  it('should emit startDateChange when start values change', async () => {
    const startDateChange = vi.fn();
    await render(DatePicker, {
      imports: [FormsModule, CommonModule],
      componentInputs: { startDate: FIXED_START },
      componentOutputs: { startDateChange: { emit: startDateChange } as any }
    });

    const dayInputs = screen.getAllByPlaceholderText(/[0-9]+/);
    fireEvent.input(dayInputs[0], { target: { value: '16' } });
    
    // The component uses ngModel, might need a small delay or fireEvent.blur/change
    expect(startDateChange).toHaveBeenCalledWith('2035-02-16');
  });

  it('should emit endDateChange when end values change', async () => {
    const endDateChange = vi.fn();
    await render(DatePicker, {
      imports: [FormsModule, CommonModule],
      componentInputs: { endDate: FIXED_END },
      componentOutputs: { endDateChange: { emit: endDateChange } as any }
    });

    const dayInputs = screen.getAllByPlaceholderText(/[0-9]+/);
    fireEvent.input(dayInputs[1], { target: { value: '25' } });
    
    expect(endDateChange).toHaveBeenCalledWith('2050-11-25');
  });

  it('should clamp days to maximum for the month', async () => {
    const startDateChange = vi.fn();
    await render(DatePicker, {
      imports: [FormsModule, CommonModule],
      componentInputs: { startDate: '2035-02-20' },
      componentOutputs: { startDateChange: { emit: startDateChange } as any }
    });

    const dayInputs = screen.getAllByPlaceholderText(/[0-9]+/);
    // 2035-02 has 28 days. Let's try to input 31.
    fireEvent.input(dayInputs[0], { target: { value: '31' } });
    
    expect(startDateChange).toHaveBeenCalledWith('2035-02-28');
  });
});
