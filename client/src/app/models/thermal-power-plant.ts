export interface ThermalPowerPlant {
    id: number;
    nom: string;
    latitude: number;
    longitude: number;
    type_intrant: string;
    puissance_nominal: number;
    semaine_maintenance: number;
    annee_commission: number | null;
    type_generateur: string | null;
}

export function getPowerPlantFromJson(json: any): ThermalPowerPlant {
    return {
        id: json.id,
        nom: json.nom,
        latitude: json.latitude,
        longitude: json.longitude,
        type_intrant: json.type_intrant,
        puissance_nominal: json.puissance_nominal,
        semaine_maintenance: json.semaine_maintenance,
        annee_commission: json.annee_commission,
        type_generateur: json.type_generateur
    };
}

export function powerPlantToJson(powerPlant: ThermalPowerPlant): any {
    return {
        nom: powerPlant.nom,
        latitude: powerPlant.latitude,
        longitude: powerPlant.longitude,
        type_intrant: powerPlant.type_intrant,
        puissance_nominal: powerPlant.puissance_nominal,
        semaine_maintenance: powerPlant.semaine_maintenance,
        annee_commission: powerPlant.annee_commission,
        type_generateur: powerPlant.type_generateur
    };
}

export function createEmptyPowerPlant(): ThermalPowerPlant {
    return {
        id: 0,
        nom: '',
        latitude: 0,
        longitude: 0,
        type_intrant: '',
        puissance_nominal: 0,
        semaine_maintenance: 0,
        annee_commission: null,
        type_generateur: null
    };
}
