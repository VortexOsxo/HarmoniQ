import { Infra, InfraFactory } from "./infra";

export class WindFarm extends Infra<WindFarm> {
    nombre_eoliennes!: number;
    capacite_total!: number;
    hauteur_moyenne!: number;
    modele_turbine!: string;
    puissance_nominal!: number;
}


export class WindFarmFactory extends InfraFactory<WindFarm> {
    override getType(): string {
        return 'eolienneparc';
    }

    override toJson(infra: WindFarm) {
        return {
            nom: infra.nom,
            latitude: infra.latitude,
            longitude: infra.longitude,
            nombre_eoliennes: infra.nombre_eoliennes,
            capacite_total: infra.capacite_total,
            hauteur_moyenne: infra.hauteur_moyenne,
            modele_turbine: infra.modele_turbine,
            puissance_nominal: infra.puissance_nominal
        };
    }

    override fromJson(json: any): WindFarm {
        return new WindFarm({
            id: json.id,
            nom: json.nom,
            latitude: json.latitude,
            longitude: json.longitude,
            nombre_eoliennes: json.nombre_eoliennes,
            capacite_total: json.capacite_total,
            hauteur_moyenne: json.hauteur_moyenne,
            modele_turbine: json.modele_turbine,
            puissance_nominal: json.puissance_nominal
        });
    }

    override createEmpty(): WindFarm {
        return new WindFarm({
            id: 0,
            nom: '',
            latitude: 0,
            longitude: 0,
            nombre_eoliennes: 0,
            capacite_total: 0,
            hauteur_moyenne: 0,
            modele_turbine: '',
            puissance_nominal: 0
        });
    }
}
