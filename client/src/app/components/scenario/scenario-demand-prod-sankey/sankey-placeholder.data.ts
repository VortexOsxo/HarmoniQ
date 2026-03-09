import { Co2DetailsData, SankeyData } from './sankey-data.types';

// Placeholder data


export const PLACEHOLDER_SANKEY_DATA: SankeyData = {
  demandNodes: [
    { id: 'industrie',   label: 'Industrie',   value: 16800, color: '#9c6bb5', icon: 'fa-industry' },
    { id: 'residentiel', label: 'Résidentiel', value: 14700, color: '#5aaa6f', icon: 'fa-house' },
    { id: 'commercial',  label: 'Commercial',  value: 8400,  color: '#5c9fd6', icon: 'fa-building' },
    { id: 'pertes',      label: 'Pertes',      value: 2100,  color: '#e8a93c', icon: 'fa-triangle-exclamation' },
  ],
  productionNodes: [
    { id: 'hydraulique', label: 'Hydraulique',  value: 37000, color: '#4a9dd4', icon: 'fa-droplet',              co2FactorKgMWh: 24  },
    { id: 'eolien',      label: 'Éolien',       value: 4200,  color: '#6abbc4', icon: 'fa-wind',                 co2FactorKgMWh: 12  },
    { id: 'gaz',         label: 'Gaz naturel',  value: 300,   color: '#E8924A', icon: 'fa-fire-flame-curved',    co2FactorKgMWh: 490 },
    { id: 'thermique',   label: 'Thermique',    value: 200,   color: '#e25c5c', icon: 'fa-bolt',                 co2FactorKgMWh: 820 },
    { id: 'solaire',     label: 'Solaire',      value: 250,   color: '#e8c53c', icon: 'fa-sun',                  co2FactorKgMWh: 48  },
    { id: 'biomasse',    label: 'Biomasse',     value: 50,    color: '#5db85d', icon: 'fa-seedling',             co2FactorKgMWh: 230 },
  ],
};

/** Derive Co2DetailsData from a SankeyData object. */
export function buildCo2Details(sankeyData: SankeyData): Co2DetailsData {
  const sources = sankeyData.productionNodes.map(p => ({
    name: p.label,
    color: p.color,
    productionMW: p.value,
    co2FactorKgMWh: p.co2FactorKgMWh,
    totalCo2Tph: (p.value * p.co2FactorKgMWh) / 1000,
    percentage: 0,
  }));

  const total = sources.reduce((s, src) => s + src.totalCo2Tph, 0);
  sources.forEach(src => (src.percentage = total > 0 ? (src.totalCo2Tph / total) * 100 : 0));

  return { totalEmissions: total, sources };
}
