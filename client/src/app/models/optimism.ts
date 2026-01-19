export enum Optimism {
    Pessimiste = "Pessimiste",
    Moyen = "Moyen",
    Optimiste = "Optimiste",
}

export function optimismFromNumber(value: number): Optimism {
    switch (value) {
        case 1: return Optimism.Pessimiste;
        case 2: return Optimism.Moyen;
        case 3: return Optimism.Optimiste;
        default: return Optimism.Moyen; // fallback
    }
}

export function optimismToNumber(value: Optimism): number {
    switch (value) {
        case Optimism.Pessimiste: return 1;
        case Optimism.Moyen: return 2;
        case Optimism.Optimiste: return 3;
        default: return 2; // fallback
    }
}