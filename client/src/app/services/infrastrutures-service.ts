import { HttpClient } from '@angular/common/http';
import { EventEmitter, Injectable } from '@angular/core';
import { signal } from '@angular/core';
import { InfrastructureGroup } from '@app/models/infrastructure-group';
import { map, tap } from 'rxjs/operators';
import { environment } from 'environments/environment';
import { getInfrastructureGroupFromJson, infrastructureGroupToJson } from '@app/models/infrastructure-group';

// Hack pcq le code etait ass et j'ai la flemme
const typeKeyMap: Record<string, string> = {
  'hydro': 'central_hydroelectriques',
  'eolienneparc': 'parc_eoliens',
  'solaire': 'parc_solaires',
  'thermique': 'central_thermique',
  'nucleaire': 'central_nucleaire'
};

@Injectable({
  providedIn: 'root',
})
export class InfrastruturesService {
  infraGroups = signal<InfrastructureGroup[]>([]);
  selectedInfraGroup = signal<InfrastructureGroup | null>(null);

  infraToggled = new EventEmitter<{ type: string, id: string, isActive: boolean }>();

  constructor(private http: HttpClient) {
    this.refreshInfraGroups().subscribe();
  }

  isInfraSelected(type: string, infraId: string) {
    const infraGroup: any = this.selectedInfraGroup();
    if (!infraGroup) return false;

    const key = typeKeyMap[type];
    if (!key) return false;
    return infraGroup[key].includes(infraId);
  }

  toggleInfra(type: string, infraId: string) {
    const infraGroup: any = this.selectedInfraGroup();
    if (!infraGroup) return;

    const key = typeKeyMap[type];

    let isActive = false;
    if (infraGroup[key].includes(infraId)) {
      infraGroup[key] = infraGroup[key].filter((id: string) => id !== infraId);
      isActive = false;
    } else {
      infraGroup[key].push(infraId);
      isActive = true;
    }

    this.selectedInfraGroup.set(infraGroup);
    this.infraToggled.emit({ type, id: infraId, isActive });
  }

  setInfrasForType(type: string, infrasIds: any[]) {
    const infraGroup: any = this.selectedInfraGroup();
    if (!infraGroup) return;

    const key = typeKeyMap[type];
    if (!key) return;
    infraGroup[key] = infrasIds;

    this.selectedInfraGroup.set(infraGroup);
  }

  refreshInfraGroups() {
    return this.http.get(environment.apiUrl + '/listeinfrastructures', { headers: { 'Content-Type': 'application/json' } })
      .pipe(
        map((data: any) => data.map((group: any) => getInfrastructureGroupFromJson(group))),
        tap((groups: InfrastructureGroup[]) => this.infraGroups.set(groups))
      );
  }

  createInfraGroup(group: InfrastructureGroup) {
    return this.http.post(environment.apiUrl + '/listeinfrastructures', infrastructureGroupToJson(group), { headers: { 'Content-Type': 'application/json' } })
      .pipe(
        map((data: any) => getInfrastructureGroupFromJson(data)),
        tap((newGroup) => {
          this.infraGroups.update(s => [...s, newGroup]);
          this.selectedInfraGroup.set(newGroup);
        })
      );
  }

  deleteInfraGroup(group: InfrastructureGroup) {
    return this.http.delete(environment.apiUrl + '/listeinfrastructures' + group.id, { headers: { 'Content-Type': 'application/json' } })
      .pipe(
        tap(() => {
          this.infraGroups.update(s => s.filter(item => item.id !== group.id));
          if (this.selectedInfraGroup()?.id === group.id) {
            this.selectedInfraGroup.set(null);
          }
        })
      );
  }
}
