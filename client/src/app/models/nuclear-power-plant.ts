export interface NuclearPowerPlant {
    id: number;
    nom: string;
    latitude: number;
    longitude: number;
    puissance_nominal: number;
    semaine_maintenance: number;
    annee_commission: number | null;
    type_generateur: string | null;
    type_intrant: number | null;
}

export function getNuclearPowerPlantFromJson(json: any): NuclearPowerPlant {
    return {
        id: json.id,
        nom: json.nom,
        latitude: json.latitude,
        longitude: json.longitude,
        puissance_nominal: json.puissance_nominal,
        semaine_maintenance: json.semaine_maintenance,
        annee_commission: json.annee_commission,
        type_generateur: json.type_generateur,
        type_intrant: json.type_intrant
    };
}

export function nuclearPowerPlantToJson(plant: NuclearPowerPlant): any {
    return {
        nom: plant.nom,
        latitude: plant.latitude,
        longitude: plant.longitude,
        puissance_nominal: plant.puissance_nominal,
        semaine_maintenance: plant.semaine_maintenance,
        annee_commission: plant.annee_commission,
        type_generateur: plant.type_generateur,
        type_intrant: plant.type_intrant
    };
}

export function createEmptyNuclearPowerPlant(): NuclearPowerPlant {
    return {
        id: 0,
        nom: '',
        latitude: 0,
        longitude: 0,
        puissance_nominal: 1200,
        semaine_maintenance: 20,
        annee_commission: null,
        type_generateur: null,
        type_intrant: null
    };
}
