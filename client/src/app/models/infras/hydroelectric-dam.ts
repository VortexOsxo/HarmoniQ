import { Infra, InfraFactory } from "./infra";

export class HydroelectricDam extends Infra<HydroelectricDam> {

    constructor(init?: Partial<HydroelectricDam>) {
        super();
        Object.assign(this, init);
    }

    type_barrage!: string
    puissance_nominal!: number
    hauteur_chute!: number
    nb_turbines!: number
    debits_nominal!: number
    modele_turbine!: string
    volume_reservoir!: number
    nb_turbines_maintenance!: number
    id_HQ!: number
    annee_commission!: number | null
    materiau_conduite!: string | null
}

export class HydroelectricDamFactory extends InfraFactory<HydroelectricDam> {
    getType() {
        return 'hydro';
    }

    override toJson(infra: HydroelectricDam) {
        return {
            nom: infra.nom,
            longitude: infra.longitude,
            latitude: infra.latitude,
            type_barrage: infra.type_barrage,
            puissance_nominal: infra.puissance_nominal,
            hauteur_chute: infra.hauteur_chute,
            nb_turbines: infra.nb_turbines,
            debits_nominal: infra.debits_nominal,
            modele_turbine: infra.modele_turbine,
            volume_reservoir: infra.volume_reservoir,
            nb_turbines_maintenance: infra.nb_turbines_maintenance,
            id_HQ: infra.id_HQ,
            annee_commission: infra.annee_commission,
            materiau_conduite: infra.materiau_conduite
        };
    }

    override fromJson(json: any): HydroelectricDam {
        return new HydroelectricDam({
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
        });
    }

    override createEmpty(): HydroelectricDam {
        return new HydroelectricDam({
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
        });
    }
}
