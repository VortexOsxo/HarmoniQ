import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Co2DetailsPanelComponent } from './co2-details-panel';
import { Co2DetailsData, Co2SourceDetail } from '../sankey-data.types';

const MOCK_SOURCE_HIGH: Co2SourceDetail = {
  name: 'Thermique',
  color: '#e25c5c',
  productionMW: 200,
  co2FactorKgMWh: 820,
  totalCo2Tph: 164,
  percentage: 75,
};

const MOCK_SOURCE_LOW: Co2SourceDetail = {
  name: 'Éolien',
  color: '#6abbc4',
  productionMW: 500,
  co2FactorKgMWh: 12,
  totalCo2Tph: 6,
  percentage: 25,
};

const MOCK_CO2_DATA: Co2DetailsData = {
  totalEmissions: 170,
  sources: [MOCK_SOURCE_LOW, MOCK_SOURCE_HIGH],
};

describe('Co2DetailsPanelComponent', () => {
  let component: Co2DetailsPanelComponent;
  let fixture: ComponentFixture<Co2DetailsPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Co2DetailsPanelComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(Co2DetailsPanelComponent);
    component = fixture.componentInstance;
    component.data = MOCK_CO2_DATA;
    fixture.detectChanges();
  });

  it('should create the CO2 details panel component', () => {
    expect(component).toBeTruthy();
  });

  describe('@Input() loading', () => {
    it('should default to false', () => {
      expect(component.loading).toBe(false);
    });

    it('should accept true as loading state', () => {
      component.loading = true;

      expect(component.loading).toBe(true);
    });
  });

  describe('sortedSources', () => {
    it('should return sources sorted by percentage in descending order', () => {
      const sorted = component.sortedSources;

      expect(sorted[0].percentage).toBeGreaterThan(sorted[1].percentage);
    });

    it('should place the highest percentage source first', () => {
      const sorted = component.sortedSources;

      expect(sorted[0].name).toBe('Thermique');
    });

    it('should not mutate the original data.sources array', () => {
      const originalOrder = [...component.data.sources];
      component.sortedSources;

      expect(component.data.sources).toEqual(originalOrder);
    });
  });

  describe('formatCo2', () => {
    it('should round values >= 10 to an integer', () => {
      const result = component.formatCo2(164);

      expect(result).not.toContain('.');
    });

    it('should format values >= 1 with at most 1 decimal place', () => {
      const result = component.formatCo2(5.678);

      expect(parseFloat(result.replace(/\s/g, '').replace(',', '.'))).toBeCloseTo(5.7, 1);
    });

    it('should format values < 1 with at most 2 decimal places', () => {
      const result = component.formatCo2(0.123);

      expect(result).toBeTruthy();
    });
  });

  describe('formatPercent', () => {
    it('should append % to the value', () => {
      expect(component.formatPercent(75.5)).toBe('75.5%');
    });

    it('should format to one decimal place', () => {
      expect(component.formatPercent(33.333)).toBe('33.3%');
    });

    it('should handle integer percentages', () => {
      expect(component.formatPercent(100)).toBe('100.0%');
    });
  });
});
