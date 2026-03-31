import { Infra, InfraFactory } from "./infra";

export class ThermalPowerPlant extends Infra<ThermalPowerPlant> {

    constructor(init?: Partial<ThermalPowerPlant>) {
        super();
        Object.assign(this, init);
    }

    type_intrant!: string;
    puissance_nominal!: number;
    semaine_maintenance!: number;
    annee_commission!: number | null;
    type_generateur!: string | null;
}

export class ThermalPowerPlantFactory extends InfraFactory<ThermalPowerPlant> {
    override getType(): string {
        return 'thermique';
    }

    override toJson(infra: ThermalPowerPlant) {
        return {
            nom: infra.nom,
            latitude: infra.latitude,
            longitude: infra.longitude,
            type_intrant: infra.type_intrant,
            puissance_nominal: infra.puissance_nominal,
            semaine_maintenance: infra.semaine_maintenance,
            annee_commission: infra.annee_commission,
            type_generateur: infra.type_generateur
        };
    }

    override fromJson(json: any): ThermalPowerPlant {
        return new ThermalPowerPlant({
            id: json.id,
            nom: json.nom,
            latitude: json.latitude,
            longitude: json.longitude,
            type_intrant: json.type_intrant,
            puissance_nominal: json.puissance_nominal,
            semaine_maintenance: json.semaine_maintenance,
            annee_commission: json.annee_commission,
            type_generateur: json.type_generateur
        });
    }

    override createEmpty(): ThermalPowerPlant {
        return new ThermalPowerPlant({
            id: 0,
            nom: '',
            latitude: 0,
            longitude: 0,
            type_intrant: '',
            puissance_nominal: 0,
            semaine_maintenance: 0,
            annee_commission: null,
            type_generateur: null
        });
    }
}
