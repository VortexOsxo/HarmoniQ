import { Weather } from "./weather";
import { Consumption } from "./consumption";

export interface Scenario {
    id: number;
    nom: string;
    description: string;
    date_de_debut: string;
    date_de_fin: string;
    pas_de_temps: string;
    weather: Weather;
    consomation: Consumption;
}

export function createEmptyScenario(): Scenario {
    return {
        id: 0,
        nom: '',
        description: '',
        date_de_debut: new Date().toISOString().split('T')[0],
        date_de_fin: new Date().toISOString().split('T')[0],
        pas_de_temps: 'PT1H',
        weather: Weather.Typical,
        consomation: Consumption.Normal,
    };
}