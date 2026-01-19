export interface HydroelectricDam {
    id: number;
    nom: string;
    longitude: number;
    latitude: number;
    type_barrage: string;
    puissance_nominal: number;
    hauteur_chute: number;
    nb_turbines: number;
    debits_nominal: number;
    modele_turbine: string;
    volume_reservoir: number;
    nb_turbines_maintenance: number;
    id_HQ: number;
    annee_commission: number | null;
    materiau_conduite: string | null;
}

export function getHydroelectricDamFromJson(json: any): HydroelectricDam {
    return {
        id: json.id,
        nom: json.nom,
        longitude: json.longitude,
        latitude: json.latitude,
        type_barrage: json.type_barrage,
        puissance_nominal: json.puissance_nominal,
        hauteur_chute: json.hauteur_chute,
        nb_turbines: json.nb_turbines,
        debits_nominal: json.debits_nominal,
        modele_turbine: json.modele_turbine,
        volume_reservoir: json.volume_reservoir,
        nb_turbines_maintenance: json.nb_turbines_maintenance,
        id_HQ: json.id_HQ,
        annee_commission: json.annee_commission,
        materiau_conduite: json.materiau_conduite
    };
}

export function hydroelectricDamToJson(dam: HydroelectricDam): any {
    return {
        nom: dam.nom,
        longitude: dam.longitude,
        latitude: dam.latitude,
        type_barrage: dam.type_barrage,
        puissance_nominal: dam.puissance_nominal,
        hauteur_chute: dam.hauteur_chute,
        nb_turbines: dam.nb_turbines,
        debits_nominal: dam.debits_nominal,
        modele_turbine: dam.modele_turbine,
        volume_reservoir: dam.volume_reservoir,
        nb_turbines_maintenance: dam.nb_turbines_maintenance,
        id_HQ: dam.id_HQ,
        annee_commission: dam.annee_commission,
        materiau_conduite: dam.materiau_conduite
    };
}

export function createEmptyHydroelectricDam(): HydroelectricDam {
    return {
        id: 0,
        nom: '',
        longitude: 0,
        latitude: 0,
        type_barrage: '',
        puissance_nominal: 0,
        hauteur_chute: 0,
        nb_turbines: 0,
        debits_nominal: 0,
        modele_turbine: '',
        volume_reservoir: 0,
        nb_turbines_maintenance: 0,
        id_HQ: 0,
        annee_commission: null,
        materiau_conduite: null
    };
}
