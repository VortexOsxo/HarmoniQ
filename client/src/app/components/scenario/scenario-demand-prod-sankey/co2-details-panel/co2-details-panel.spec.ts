import { render, screen } from '@testing-library/angular';
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
  it('should render the CO2 panel header', async () => {
    await render(Co2DetailsPanelComponent, {
      componentInputs: { data: MOCK_CO2_DATA, loading: false },
    });

    expect(screen.getByText(/Détails CO/i)).toBeInTheDocument();
  });

  describe('@Input() loading', () => {
    it('should render source rows when loading is false', async () => {
      await render(Co2DetailsPanelComponent, {
        componentInputs: { data: MOCK_CO2_DATA, loading: false },
      });

      expect(screen.getByText('Thermique')).toBeInTheDocument();
      expect(screen.getByText('Éolien')).toBeInTheDocument();
    });

    it('should not render source rows when loading is true', async () => {
      await render(Co2DetailsPanelComponent, {
        componentInputs: { data: MOCK_CO2_DATA, loading: true },
      });

      expect(screen.queryByText('Thermique')).not.toBeInTheDocument();
      expect(screen.queryByText('Éolien')).not.toBeInTheDocument();
    });
  });

  describe('sortedSources rendered order', () => {
    it('should render Thermique (75%) before Éolien (25%)', async () => {
      await render(Co2DetailsPanelComponent, {
        componentInputs: { data: MOCK_CO2_DATA, loading: false },
      });

      const sourceNames = screen
        .getAllByText(/Thermique|Éolien/)
        .map((el) => el.textContent?.trim());

      expect(sourceNames[0]).toBe('Thermique');
      expect(sourceNames[1]).toBe('Éolien');
    });

    it('should not mutate the original data.sources order', async () => {
      const dataCopy: Co2DetailsData = {
        totalEmissions: 170,
        sources: [{ ...MOCK_SOURCE_LOW }, { ...MOCK_SOURCE_HIGH }],
      };

      await render(Co2DetailsPanelComponent, {
        componentInputs: { data: dataCopy, loading: false },
      });

      // Original array: LOW first, HIGH second — mutation would swap them
      expect(dataCopy.sources[0].name).toBe('Éolien');
      expect(dataCopy.sources[1].name).toBe('Thermique');
    });
  });

  describe('formatPercent rendered output', () => {
    it('should render the percentage label for each source', async () => {
      await render(Co2DetailsPanelComponent, {
        componentInputs: { data: MOCK_CO2_DATA, loading: false },
      });

      expect(screen.getByText('75.0%')).toBeInTheDocument();
      expect(screen.getByText('25.0%')).toBeInTheDocument();
    });

    it('should format 33.333 as 33.3%', async () => {
      const data: Co2DetailsData = {
        totalEmissions: 10,
        sources: [
          {
            name: 'Test',
            color: '#000',
            productionMW: 100,
            co2FactorKgMWh: 10,
            totalCo2Tph: 10,
            percentage: 33.333,
          },
        ],
      };

      await render(Co2DetailsPanelComponent, {
        componentInputs: { data, loading: false },
      });

      expect(screen.getByText('33.3%')).toBeInTheDocument();
    });
  });

  describe('formatCo2 rendered output', () => {
    it('should render the CO2 value for Thermique without decimal (164 rounds to integer)', async () => {
      await render(Co2DetailsPanelComponent, {
        componentInputs: { data: MOCK_CO2_DATA, loading: false },
      });

      // 164 t CO2/h — value >= 10, so rendered as integer
      const co2Items = screen.getAllByText(/t CO/i);
      const thermiqueEntry = co2Items.find((el) => /164/.test(el.textContent ?? ''));
      expect(thermiqueEntry).toBeInTheDocument();
    });
  });
});
