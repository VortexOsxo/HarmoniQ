import { Injectable } from '@angular/core';
import { InfrastructureGroup } from '@app/models/infrastructure-group';

const INFRA_KEY = 'harmoniq_local_infras';
const GROUPS_KEY = 'harmoniq_local_infra_groups';

@Injectable({
    providedIn: 'root',
})
export class LocalInfraStorageService {

    getLocalInfras(type: string): any[] {
        const all = this.loadAllInfras();
        return all[type] ?? [];
    }

    saveLocalInfra(type: string, infra: any): void {
        const all = this.loadAllInfras();
        if (!all[type]) all[type] = [];
        all[type].push(infra);
        this.persistAllInfras(all);
    }

    deleteLocalInfra(type: string, id: number): void {
        const all = this.loadAllInfras();
        if (!all[type]) return;
        all[type] = all[type].filter((i: any) => i.id !== id);
        this.persistAllInfras(all);
    }

    private loadAllInfras(): Record<string, any[]> {
        try {
            const raw = localStorage.getItem(INFRA_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    }

    private persistAllInfras(data: Record<string, any[]>): void {
        localStorage.setItem(INFRA_KEY, JSON.stringify(data));
    }


    getLocalGroups(): InfrastructureGroup[] {
        try {
            const raw = localStorage.getItem(GROUPS_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    saveLocalGroup(group: InfrastructureGroup): InfrastructureGroup {
        const groups = this.getLocalGroups();
        const newId = groups.length > 0
            ? Math.min(...groups.map(g => g.id)) - 1
            : -1;
        const newGroup = { ...group, id: newId };
        groups.push(newGroup);
        this.persistGroups(groups);
        return newGroup;
    }

    updateLocalGroup(group: InfrastructureGroup): void {
        const groups = this.getLocalGroups();
        const idx = groups.findIndex(g => g.id === group.id);
        if (idx !== -1) groups[idx] = group;
        this.persistGroups(groups);
    }

    deleteLocalGroup(id: number): void {
        const groups = this.getLocalGroups().filter(g => g.id !== id);
        this.persistGroups(groups);
    }

    private persistGroups(groups: InfrastructureGroup[]): void {
        localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
    }
}
