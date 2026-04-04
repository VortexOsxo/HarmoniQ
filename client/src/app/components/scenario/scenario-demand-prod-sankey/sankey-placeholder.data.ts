import { Co2DetailsData, SankeyData } from './sankey-data.types';
import { INFRA_COLORS, INFRA_LABELS } from '@app/data/infra-colors.data';

// Placeholder data


export const PLACEHOLDER_SANKEY_DATA: SankeyData = {
  demandNodes: [
    { id: 'industrie',   label: INFRA_LABELS['industrie'],   value: 0, electricityValue: 0, gasValue: 0, color: INFRA_COLORS['industrie'],   icon: 'fa-industry' },
    { id: 'residentiel', label: INFRA_LABELS['residentiel'], value: 0, electricityValue: 0, gasValue: 0, color: INFRA_COLORS['residentiel'], icon: 'fa-house' },
    { id: 'commercial',  label: INFRA_LABELS['commercial'],  value: 0, electricityValue: 0, gasValue: 0, color: INFRA_COLORS['commercial'],  icon: 'fa-building' },
    { id: 'autres',      label: INFRA_LABELS['pertes'],      value: 0, electricityValue: 0, gasValue: 0, color: INFRA_COLORS['pertes'],      icon: 'fa-triangle-exclamation' },
  ],
  energyTypeNodes: [
    { id: 'electricity', label: 'Électricité',     value: 0, demandMW: 0, productionMW: 0, color: '#3a7abf', icon: 'fa-bolt' },
    { id: 'gas',         label: 'Énergie Fossile', value: 0, demandMW: 0,                  color: '#b05c1a', icon: 'fa-fire' },
  ],
  productionNodes: [
    { id: 'hydraulique', label: INFRA_LABELS['hydraulique'], value: 0, color: INFRA_COLORS['hydraulique'], icon: 'fa-droplet',          co2FactorKgMWh: 24,  energyType: 'electricity' },
    { id: 'eolien',      label: INFRA_LABELS['eolien'],      value: 0, color: INFRA_COLORS['eolien'],      icon: 'fa-wind',             co2FactorKgMWh: 12,  energyType: 'electricity' },
    { id: 'thermique',   label: INFRA_LABELS['thermique'],   value: 0, color: INFRA_COLORS['thermique'],   icon: 'fa-bolt',             co2FactorKgMWh: 820, energyType: 'electricity' },
    { id: 'solaire',     label: INFRA_LABELS['solaire'],     value: 0, color: INFRA_COLORS['solaire'],     icon: 'fa-sun',              co2FactorKgMWh: 48,  energyType: 'electricity' },
    { id: 'nucleaire',   label: INFRA_LABELS['nucleaire'],   value: 0, color: INFRA_COLORS['nucleaire'],   icon: 'fa-radiation',        co2FactorKgMWh: 12,  energyType: 'electricity' },
    { id: 'import',      label: INFRA_LABELS['import'],      value: 0, color: INFRA_COLORS['import'],      icon: 'fa-right-to-bracket', co2FactorKgMWh: 200, energyType: 'electricity' },
  ],
};

/** Derive Co2DetailsData from a SankeyData object. */
export function buildCo2Details(sankeyData: SankeyData): Co2DetailsData {
  const sources = sankeyData.productionNodes.map(p => ({
    name: p.label,
    color: p.color,
    productionMW: p.value,
    co2FactorKgMWh: p.co2FactorKgMWh,
    totalCo2Tph: p.co2Tph ?? (p.value * p.co2FactorKgMWh) / 1000,
    percentage: 0,
  }));

  const total = sources.reduce((s, src) => s + src.totalCo2Tph, 0);
  sources.forEach(src => (src.percentage = total > 0 ? (src.totalCo2Tph / total) * 100 : 0));

  return { totalEmissions: total, sources };
}
