export interface DemandNode {
  id: string;
  label: string;
  value: number; // MW
  color: string;
  icon: string; // Font Awesome class (e.g. 'fa-industry')
}

export interface ProductionNode {
  id: string;
  label: string;
  value: number; // MW
  color: string;
  icon: string; // Font Awesome class
  co2FactorKgMWh: number; // kg CO₂ / MWh
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
