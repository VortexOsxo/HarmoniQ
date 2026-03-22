import { TestBed, ComponentFixture } from '@angular/core/testing';
import { GranularitySelectorComponent } from './granularity-selector';

const GRANULARITIES = ['original', 'daily', 'weekly', 'monthly'];

describe('GranularitySelectorComponent', () => {
  let component: GranularitySelectorComponent;
  let fixture: ComponentFixture<GranularitySelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GranularitySelectorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GranularitySelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  it('should create the granularity selector component', () => {
    expect(component).toBeTruthy();
  });

  describe('@Input() selected', () => {
    it('should default to "original"', () => {
      expect(component.selected).toBe('original');
    });

    it('should accept a custom selected value', () => {
      component.selected = 'monthly';

      expect(component.selected).toBe('monthly');
    });
  });

  describe('@Output() granularityChange', () => {
    it('should emit the selected granularity on onChange()', () => {
      const emitted: string[] = [];
      component.granularityChange.subscribe((val: string) => emitted.push(val));

      component.onChange({ target: { value: 'daily' } });

      expect(emitted).toContain('daily');
    });

    it('should emit correct value for each granularity option', () => {
      GRANULARITIES.forEach(granularity => {
        const emitted: string[] = [];
        component.granularityChange.subscribe((val: string) => emitted.push(val));

        component.onChange({ target: { value: granularity } });

        expect(emitted).toContain(granularity);
      });
    });
  });
});
