export interface SolarFarm {
    id: number;
    nom: string;
    latitude: number;
    longitude: number;
    angle_panneau: number;
    orientation_panneau: number;
    puissance_nominal: number;
    nombre_panneau: number;
    annee_commission: number | null;
    panneau_type: string | null;
    materiau_panneau: string | null;
}

export function getSolarFarmFromJson(json: any): SolarFarm {
    return {
        id: json.id,
        nom: json.nom,
        latitude: json.latitude,
        longitude: json.longitude,
        angle_panneau: json.angle_panneau,
        orientation_panneau: json.orientation_panneau,
        puissance_nominal: json.puissance_nominal,
        nombre_panneau: json.nombre_panneau,
        annee_commission: json.annee_commission,
        panneau_type: json.panneau_type,
        materiau_panneau: json.materiau_panneau
    };
}

export function solarFarmToJson(solarFarm: SolarFarm): any {
    return {
        nom: solarFarm.nom,
        latitude: solarFarm.latitude,
        longitude: solarFarm.longitude,
        angle_panneau: solarFarm.angle_panneau,
        orientation_panneau: solarFarm.orientation_panneau,
        puissance_nominal: solarFarm.puissance_nominal,
        nombre_panneau: solarFarm.nombre_panneau,
        annee_commission: solarFarm.annee_commission,
        panneau_type: solarFarm.panneau_type,
        materiau_panneau: solarFarm.materiau_panneau
    };
}

export function createEmptySolarFarm(): SolarFarm {
    return {
        id: 0,
        nom: '',
        latitude: 0,
        longitude: 0,
        angle_panneau: 0,
        orientation_panneau: 0,
        puissance_nominal: 0,
        nombre_panneau: 0,
        annee_commission: null,
        panneau_type: null,
        materiau_panneau: null
    };
}
