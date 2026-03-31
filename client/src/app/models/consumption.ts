export enum Consumption {
    Normal = 1,
    Conservative = 2,
}

export const ConsumptionLabels: Record<number, string> = {
    [Consumption.Normal]: 'Normal',
    [Consumption.Conservative]: 'Conservateur',
};