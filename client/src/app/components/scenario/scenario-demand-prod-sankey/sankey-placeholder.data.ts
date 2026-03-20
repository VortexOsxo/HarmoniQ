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
    { id: 'hydraulique', label: 'Hydraulique',  value: 0, color: '#4a9dd4', icon: 'fa-droplet',              co2FactorKgMWh: 24  },
    { id: 'eolien',      label: 'Éolien',       value: 0, color: '#6abbc4', icon: 'fa-wind',                 co2FactorKgMWh: 12  },
    { id: 'thermique',   label: 'Thermique',    value: 0, color: '#e25c5c', icon: 'fa-bolt',                 co2FactorKgMWh: 820 },
    { id: 'solaire',     label: 'Solaire',      value: 0, color: '#e8c53c', icon: 'fa-sun',                  co2FactorKgMWh: 48  },
    { id: 'nucleaire',   label: 'Nucléaire',    value: 0, color: '#e8754a', icon: 'fa-radiation',            co2FactorKgMWh: 12  },
    { id: 'import',      label: 'Importation',  value: 0, color: '#a0a0c8', icon: 'fa-right-to-bracket',     co2FactorKgMWh: 200 },
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
