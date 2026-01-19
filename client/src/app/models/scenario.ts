import { Optimism, optimismFromNumber, optimismToNumber } from "./optimism";
import { Weather, weatherFromNumber, weatherToNumber } from "./weather";
import { Consumption, consumptionFromNumber, consumptionToNumber } from "./consumption";

export interface Scenario {
    id: number;
    nom: string;
    description: string;
    date_de_debut: Date;
    date_de_fin: Date;
    pas_de_temps: string;
    weather: Weather;
    consomation: Consumption;
    optimisme_social: Optimism;
    optimisme_ecologique: Optimism;
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
        consomation: consumptionFromNumber(json.consomation),
        optimisme_social: optimismFromNumber(json.optimisme_social),
        optimisme_ecologique: optimismFromNumber(json.optimisme_ecologique)
    };
}

export function scenarioToJson(scenario: Scenario): any {
    return {
        nom: scenario.nom,
        description: scenario.description,
        date_de_debut: scenario.date_de_debut.toISOString().replace('Z', '+00:00'),
        date_de_fin: scenario.date_de_fin.toISOString().replace('Z', '+00:00'),
        pas_de_temps: scenario.pas_de_temps,
        weather: weatherToNumber(scenario.weather),
        consomation: consumptionToNumber(scenario.consomation),
        optimisme_social: optimismToNumber(scenario.optimisme_social),
        optimisme_ecologique: optimismToNumber(scenario.optimisme_ecologique)
    };
}

export function createEmptyScenario(): Scenario {
    return {
        id: 0, nom: '',
        description: '',
        date_de_debut: new Date(),
        date_de_fin: new Date(),
        pas_de_temps: 'PT1H',
        weather: Weather.Typical,
        consomation: Consumption.Normal,
        optimisme_social: Optimism.Moyen,
        optimisme_ecologique: Optimism.Moyen
    };
}