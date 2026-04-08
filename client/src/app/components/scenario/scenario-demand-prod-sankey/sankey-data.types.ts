export interface DemandNode {
  id: string;
  label: string;
  value: number; // MW total (electricity + gas)
  electricityValue: number; // MW electricity portion
  gasValue: number; // MW gas portion
  color: string;
  icon: string; // Font Awesome class (e.g. 'fa-industry')
  img?: string; // PNG image path (takes priority over icon)
}

export interface EnergyTypeNode {
  id: 'electricity' | 'gas';
  label: string;
  value: number; // MW (used for ribbon sizing — max of demandMW/productionMW)
  color: string;
  icon: string;
  demandMW?: number;    // total demand flowing in (set from demand service)
  productionMW?: number; // total production flowing out (set after simulation)
}

export interface ProductionNode {
  id: string;
  label: string;
  value: number; // MW
  color: string;
  icon: string; // Font Awesome class (fallback when no img)
  img?: string; // PNG image path (takes priority over icon)
  co2FactorKgMWh: number; // kg CO₂ / MWh (fallback)
  co2Tph?: number; // real t CO₂/h from backend (takes priority over factor)
  energyType: 'electricity' | 'gas';
}

export interface SankeyData {
  demandNodes: DemandNode[];
  energyTypeNodes: EnergyTypeNode[];
  productionNodes: ProductionNode[];
}

export interface Co2SourceDetail {
  name: string;
  color: string;
  productionMW: number;
  co2FactorKgMWh: number;
  totalCo2Tph: number; // tonnes CO₂ / h
  percentage: number;
}

export interface Co2DetailsData {
  totalEmissions: number; // tonnes CO₂ / h
  sources: Co2SourceDetail[];
}
