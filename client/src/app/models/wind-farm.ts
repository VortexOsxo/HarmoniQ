export interface WindFarm {
    id: number;
    nom: string;
    latitude: number;
    longitude: number;
    nombre_eoliennes: number;
    capacite_total: number;
    hauteur_moyenne: number;
    modele_turbine: string;
    puissance_nominal: number;
}

export function getWindFarmFromJson(json: any): WindFarm {
    return {
        id: json.id,
        nom: json.nom,
        latitude: json.latitude,
        longitude: json.longitude,
        nombre_eoliennes: json.nombre_eoliennes,
        capacite_total: json.capacite_total,
        hauteur_moyenne: json.hauteur_moyenne,
        modele_turbine: json.modele_turbine,
        puissance_nominal: json.puissance_nominal
    };
}

export function windFarmToJson(windFarm: WindFarm): any {
    return {
        nom: windFarm.nom,
        latitude: windFarm.latitude,
        longitude: windFarm.longitude,
        nombre_eoliennes: windFarm.nombre_eoliennes,
        capacite_total: windFarm.capacite_total,
        hauteur_moyenne: windFarm.hauteur_moyenne,
        modele_turbine: windFarm.modele_turbine,
        puissance_nominal: windFarm.puissance_nominal
    };
}

export function createEmptyWindFarm(): WindFarm {
    return {
        id: 0,
        nom: '',
        latitude: 0,
        longitude: 0,
        nombre_eoliennes: 0,
        capacite_total: 0,
        hauteur_moyenne: 0,
        modele_turbine: '',
        puissance_nominal: 0
    };
}
