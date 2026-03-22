import { TestBed, ComponentFixture } from '@angular/core/testing';
import { DatePicker } from './date-picker';

const FIXED_START = '2035-01-01';
const FIXED_END = '2035-12-31';

describe('DatePicker', () => {
  let component: DatePicker;
  let fixture: ComponentFixture<DatePicker>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DatePicker],
    }).compileComponents();

    fixture = TestBed.createComponent(DatePicker);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  it('should create the date picker component', () => {
    expect(component).toBeTruthy();
  });

  describe('default values', () => {
    it('should have "date" as the default title', () => {
      expect(component.title).toBe('date');
    });

    it('should have minDate set to 2010-01-01', () => {
      expect(component.minDate).toBe('2010-01-01');
    });

    it('should have maxDate set to 2050-12-31', () => {
      expect(component.maxDate).toBe('2050-12-31');
    });
  });

  describe('@Input() startDate', () => {
    it('should accept an input start date', () => {
      component.startDate = FIXED_START;
      fixture.detectChanges();

      expect(component.startDate).toBe(FIXED_START);
    });
  });

  describe('@Input() endDate', () => {
    it('should accept an input end date', () => {
      component.endDate = FIXED_END;
      fixture.detectChanges();

      expect(component.endDate).toBe(FIXED_END);
    });
  });

  describe('@Output() startDateChange', () => {
    it('should emit when startDateStr setter is called', () => {
      const emitted: string[] = [];
      component.startDateChange.subscribe((val: string) => emitted.push(val));

      component.startDateStr = FIXED_START;

      expect(emitted.length).toBeGreaterThan(0);
    });

    it('should emit the new start date value', () => {
      const emitted: string[] = [];
      component.startDateChange.subscribe((val: string) => emitted.push(val));

      component.startDateStr = FIXED_START;

      expect(emitted[0]).toBe(FIXED_START);
    });
  });

  describe('@Output() endDateChange', () => {
    it('should emit when endDateStr setter is called', () => {
      const emitted: string[] = [];
      component.endDateChange.subscribe((val: string) => emitted.push(val));

      component.endDateStr = FIXED_END;

      expect(emitted.length).toBeGreaterThan(0);
    });

    it('should emit the new end date value', () => {
      const emitted: string[] = [];
      component.endDateChange.subscribe((val: string) => emitted.push(val));

      component.endDateStr = FIXED_END;

      expect(emitted[0]).toBe(FIXED_END);
    });
  });
});
