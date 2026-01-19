export interface InfrastructureGroup {
    id: number;
    nom: string;
    parc_eoliens: string[];
    parc_solaires: string[];
    central_hydroelectriques: string[];
    central_thermique: string[];
    central_nucleaire: string[];
}

function stringToArray(value: string | undefined | null): string[] {
    return value ? value.split(',').filter((s: string) => s.length > 0) : [];
}

export function getInfrastructureGroupFromJson(json: any): InfrastructureGroup {
    return {
        id: json.id,
        nom: json.nom,
        parc_eoliens: stringToArray(json.parc_eoliens),
        parc_solaires: stringToArray(json.parc_solaires),
        central_hydroelectriques: stringToArray(json.central_hydroelectriques),
        central_thermique: stringToArray(json.central_thermique),
        central_nucleaire: stringToArray(json.central_nucleaire)
    };
}

export function infrastructureGroupToJson(group: InfrastructureGroup): any {
    return {
        nom: group.nom,
        parc_eoliens: group.parc_eoliens.join(','),
        parc_solaires: group.parc_solaires.join(','),
        central_hydroelectriques: group.central_hydroelectriques.join(','),
        central_thermique: group.central_thermique.join(','),
        central_nucleaire: group.central_nucleaire.join(',')
    };
}

export function createEmptyInfrastructureGroup(): InfrastructureGroup {
    return {
        id: 0,
        nom: '',
        parc_eoliens: [],
        parc_solaires: [],
        central_hydroelectriques: [],
        central_thermique: [],
        central_nucleaire: []
    };
}
