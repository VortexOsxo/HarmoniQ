
export enum Weather {
    Hot = 'Chaude',
    Typical = 'Typique',
    Cold = 'Froide',
}

export function weatherFromNumber(value: number): Weather {
    return value == 1 ? Weather.Hot : value == 2 ? Weather.Typical : Weather.Cold;
}

export function weatherToNumber(value: Weather): number {
    return value == Weather.Hot ? 1 : value == Weather.Typical ? 2 : 3;
}
