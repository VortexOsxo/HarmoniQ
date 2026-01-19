import { Optimism, optimismFromNumber } from "./optimisim";

export enum Consommation {
    Normal = 'Normal',
    Conservative = 'Conservateur',
}

export enum Weather {
    Hot = 'Chaude',
    Typical = 'Typique',
    Cold = 'Froide',
}

export interface Scenario {
    id: number;
    nom: string;
    description: string;
    date_de_debut: Date;
    date_de_fin: Date;
    pas_de_temps: string;
    weather: Weather;
    consomation: Consommation;
    optimisme_social: Optimism;
    optimisme_ecologique: Optimism;
}


export function consommationFromNumber(value: number): Consommation {
    return value == 1 ? Consommation.Normal : Consommation.Conservative;
}

export function weatherFromNumber(value: number): Weather {
    return value == 1 ? Weather.Hot : value == 2 ? Weather.Typical : Weather.Cold;
}

export function getScenarioFromJson(json: any): Scenario {
    return {
        id: json.id,
        nom: json.nom,
        description: json.description,
        date_de_debut: new Date(json.date_de_debut),
        date_de_fin: new Date(json.date_de_fin),
        pas_de_temps: json.pas_de_temps,
        weather: weatherFromNumber(json.weather),
        consomation: consommationFromNumber(json.consomation),
        optimisme_social: optimismFromNumber(json.optimisme_social),
        optimisme_ecologique: optimismFromNumber(json.optimisme_ecologique)
    };
}