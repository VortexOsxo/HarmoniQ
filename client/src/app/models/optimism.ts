export enum Optimism {
    Pessimiste = 1,
    Moyen = 2,
    Optimiste = 3,
}

export const OptimismLabels: Record<number, string> = {
    [Optimism.Pessimiste]: 'Pessimiste',
    [Optimism.Moyen]: 'Moyen',
    [Optimism.Optimiste]: 'Optimiste',
};