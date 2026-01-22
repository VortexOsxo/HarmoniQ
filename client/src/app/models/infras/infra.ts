export abstract class Infra<T extends Infra<T>> {
    id!: number;
    nom!: string;
    longitude!: number;
    latitude!: number;

    constructor(init?: Partial<T>) {
        Object.assign(this, init);
    }
}

export abstract class InfraFactory<T extends Infra<T>> {
    abstract getType(): string;

    abstract createEmpty(): T;
    abstract fromJson(json: any): T;
    abstract toJson(infra: T): any;
}