export enum Consumption {
    Normal = 'Normal',
    Conservative = 'Conservateur',
}

export function consumptionFromNumber(value: number): Consumption {
    return value == 1 ? Consumption.Normal : Consumption.Conservative;
}

export function consumptionToNumber(value: Consumption): number {
    return value == Consumption.Normal ? 1 : 2;
}