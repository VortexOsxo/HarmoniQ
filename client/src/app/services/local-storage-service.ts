import { Injectable } from '@angular/core';

interface HasId {
    id: number;
}

@Injectable({
    providedIn: 'root',
})
export class LocalStorageService {

    loadElements<T>(key: string): T[] {
        return this.loadObject(key) ?? [];
    }

    createElement<T extends HasId>(key: string, element: T): T {
        element.id = this.randomLocalId();
        this.saveObject(key, [element, ...this.loadElements<T>(key)]);
        return element;
    }

    updateElement<T extends HasId>(key: string, element: T) {
        let elements = this.loadElements<T>(key);
        elements = elements.map((e: T) => e.id == element.id ? element : e);
        this.saveObject(key, elements);
    }

    deleteElement<T extends HasId>(key: string, id: number): void {
        const elements = this.loadElements<T>(key)
            .filter(e => e.id !== id);
        this.saveObject(key, elements);
    }

    loadObject(key: string) {
        const object = localStorage.getItem(key);
        try {
            return object ? JSON.parse(object) : undefined;
        } catch {
            return undefined;
        }
    }

    saveObject<T>(key: string, object: T) {
        localStorage.setItem(key, JSON.stringify(object));
    }

    private randomLocalId(): number {
        return Math.floor(Math.random() * 99_900_000) + 100_000;
    }
}