import { Infra, InfraFactory } from "./infra";

export class NuclearPowerPlant extends Infra<NuclearPowerPlant> {

    constructor(init?: Partial<NuclearPowerPlant>) {
        super();
        Object.assign(this, init);
    }

    puissance_nominal!: number
    semaine_maintenance!: number
    annee_commission!: number | null
    type_generateur!: string | null
    type_intrant!: number | null
}

export class NuclearPowerPlantFactory extends InfraFactory<NuclearPowerPlant> {
    override getType(): string {
        return 'nucleaire';
    }

    override toJson(infra: NuclearPowerPlant) {
        return {
            nom: infra.nom,
            latitude: infra.latitude,
            longitude: infra.longitude,
            puissance_nominal: infra.puissance_nominal,
            semaine_maintenance: infra.semaine_maintenance,
            annee_commission: infra.annee_commission,
            type_generateur: infra.type_generateur,
            type_intrant: infra.type_intrant
        };
    }

    override fromJson(json: any): NuclearPowerPlant {
        return new NuclearPowerPlant({
            id: json.id,
            nom: json.nom,
            latitude: json.latitude,
            longitude: json.longitude,
            puissance_nominal: json.puissance_nominal,
            semaine_maintenance: json.semaine_maintenance,
            annee_commission: json.annee_commission,
            type_generateur: json.type_generateur,
            type_intrant: json.type_intrant
        });
    }

    override createEmpty(): NuclearPowerPlant {
        return new NuclearPowerPlant({
            id: 0,
            nom: '',
            latitude: 0,
            longitude: 0,
            puissance_nominal: 1200,
            semaine_maintenance: 20,
            annee_commission: null,
            type_generateur: null,
            type_intrant: null
        });
    }
}

