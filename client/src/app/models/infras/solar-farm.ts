import { Infra, InfraFactory } from "./infra";

export class SolarFarm extends Infra<SolarFarm> {
    angle_panneau!: number;
    orientation_panneau!: number;
    puissance_nominal!: number;
    nombre_panneau!: number;
    annee_commission!: number | null;
    panneau_type!: string | null;
    materiau_panneau!: string | null;
}

export class SolarFarmFactory extends InfraFactory<SolarFarm> {
    override getType(): string {
        return 'solaire';
    }

    override toJson(infra: SolarFarm) {
        return {
            nom: infra.nom,
            latitude: infra.latitude,
            longitude: infra.longitude,
            angle_panneau: infra.angle_panneau,
            orientation_panneau: infra.orientation_panneau,
            puissance_nominal: infra.puissance_nominal,
            nombre_panneau: infra.nombre_panneau,
            annee_commission: infra.annee_commission,
            panneau_type: infra.panneau_type,
            materiau_panneau: infra.materiau_panneau
        };
    }

    override fromJson(json: any): SolarFarm {
        return new SolarFarm({
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
        });
    }

    override createEmpty(): SolarFarm {
        return new SolarFarm({
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
        });
    }
}
