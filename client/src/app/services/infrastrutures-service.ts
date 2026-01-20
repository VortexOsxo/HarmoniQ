import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { signal } from '@angular/core';
import { InfrastructureGroup } from '@app/models/infrastructure-group';
import { map, tap } from 'rxjs/operators';
import { environment } from 'environments/environment';
import { getInfrastructureGroupFromJson, infrastructureGroupToJson } from '@app/models/infrastructure-group';


@Injectable({
  providedIn: 'root',
})
export class InfrastruturesService {
  infraGroups = signal<InfrastructureGroup[]>([]);
  selectedInfraGroup = signal<InfrastructureGroup | null>(null);

  constructor(private http: HttpClient) {
    this.refreshInfraGroups().subscribe();
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
