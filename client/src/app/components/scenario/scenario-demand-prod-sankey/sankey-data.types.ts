export interface DemandNode {
  id: string;
  label: string;
  value: number; // MW
  color: string;
  icon: string; // Font Awesome class (e.g. 'fa-industry')
  img?: string; // PNG image path (takes priority over icon)
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
}

export interface SankeyData {
  demandNodes: DemandNode[];
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
