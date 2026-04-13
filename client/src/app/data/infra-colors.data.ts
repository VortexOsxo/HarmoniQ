export const INFRA_COLORS: Record<string, string> = {
    /** Barrage / hydro général (carte, réseau, Sankey placeholder agrégé) */
    'hydro': '#1d6799',
    'hydraulique': '#1d6799',
    /** Résultats simulation — fil de l'eau (inchangé vis-à-vis de la teinte claire existante) */
    'hydro_fil': '#7bbfe8',
    /** Résultats simulation — réservoir */
    'hydro_reservoir': '#1d6799',
    'eolien': '#70b2c1',
    'eolienneparc': '#70b2c1',
    'solaire': '#de8c28',
    'thermique': '#698c77',
    'nucleaire': '#703A70',
    'import': '#5f5f7a',
    
    // Demand colors from Sankey Placeholder
    'industrie': '#9c6bb5',
    'residentiel': '#5aaa6f',
    'commercial': '#5c9fd6',
    'pertes': '#e8a93c'
};

export const INFRA_LABELS: Record<string, string> = {
    'hydro': 'Hydraulique',
    'hydraulique': 'Hydraulique',
    'eolien': 'Éolien',
    'eolienneparc': 'Éolien',
    'solaire': 'Solaire',
    'thermique': 'Thermique',
    'nucleaire': 'Nucléaire',
    'import': 'Importation',
    
    // Demand labels
    'industrie': 'Industrie',
    'residentiel': 'Résidentiel',
    'commercial': 'Commercial',
    'pertes': 'Pertes'
};
