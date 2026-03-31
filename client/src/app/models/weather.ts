
export enum Weather {
    Hot = 1,
    Typical = 2,
    Cold = 3,
}

export const WeatherLabels: Record<number, string> = {
    [Weather.Hot]: 'Chaud',
    [Weather.Typical]: 'Typique',
    [Weather.Cold]: 'Froid',
};
