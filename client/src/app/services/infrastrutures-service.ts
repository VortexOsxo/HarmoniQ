import { HttpClient } from '@angular/common/http';
import { EventEmitter, Injectable } from '@angular/core';
import { signal } from '@angular/core';
import { InfrastructureGroup } from '@app/models/infrastructure-group';
import { map, tap } from 'rxjs/operators';
import { environment } from 'environments/environment';
import { getInfrastructureGroupFromJson, infrastructureGroupToJson } from '@app/models/infrastructure-group';
import { OpenApiService } from './open-api-service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CreateInfraModal } from '@app/components/infrastructure/create-infra-modal/create-infra-modal';
import { Infra, InfraFactory } from '@app/models/infras/infra';
import { HydroelectricDamFactory } from '@app/models/infras/hydroelectric-dam';
import { WindFarmFactory } from '@app/models/infras/wind-farm';
import { SolarFarmFactory } from '@app/models/infras/solar-farm';
import { ThermalPowerPlantFactory } from '@app/models/infras/thermal-power-plant';
import { NuclearPowerPlantFactory } from '@app/models/infras/nuclear-power-plant';

// Hack pcq le code etait ass et j'ai la flemme
const typeKeyMap: Record<string, string> = {
  'hydro': 'central_hydroelectriques',
  'eolienneparc': 'parc_eoliens',
  'solaire': 'parc_solaires',
  'thermique': 'central_thermique',
  'nucleaire': 'central_nucleaire'
};

export class InfrasContainer<T extends Infra<T>> {

  infras = signal<T[]>([]);

  private get apiUrl() {
    return `${environment.apiUrl}/${this.factory.getType()}`;
  }

  constructor(private http: HttpClient, private factory: InfraFactory<T>) {
    this.refresh();
  }

  refresh() {
    this.http.get(this.apiUrl).subscribe((data: any) => {
      this.infras.set(data.map((i: any) => this.factory.fromJson(i)));
    })
  }
}

@Injectable({
  providedIn: 'root',
})
export class InfrastruturesService {
  infraGroups = signal<InfrastructureGroup[]>([]);
  selectedInfraGroup = signal<InfrastructureGroup | null>(null);

  infraToggled = new EventEmitter<{ type: string, id: string, isActive: boolean }>();

  infrasContainer = new Map<string, InfrasContainer<Infra<any>>>();

  constructor(
    private http: HttpClient,
    private modalService: NgbModal,
    private openApiService: OpenApiService,
  ) {
    this.refreshInfraGroups().subscribe();

    const factories = [HydroelectricDamFactory, WindFarmFactory, SolarFarmFactory, ThermalPowerPlantFactory, NuclearPowerPlantFactory];
    factories.forEach((Factory) => {
      const factory = new Factory();
      this.infrasContainer.set(factory.getType(), new InfrasContainer<Infra<any>>(http, factory));
    });
  }

  createInfra(className: string, type: string, lat: number, lon: number) {
    const schemas = this.openApiService.getOpenApiSchemas();

    const modalRef = this.modalService.open(CreateInfraModal, {});

    modalRef.componentInstance.schema = schemas[className];
    modalRef.componentInstance.type = type;
    modalRef.componentInstance.lat = lat;
    modalRef.componentInstance.lon = lon;

    modalRef.result.then(result => {
      if (!result) return;
      this.http.post(`${environment.apiUrl}/${type}`, result)
        .subscribe((res: any) => this.refreshService(type));
    });
  }

  getInfrasSignalByType(type: string) {
    const container = this.infrasContainer.get(type);
    return container?.infras ?? signal([]);
  }

  refreshService(type: string) {
    this.infrasContainer.get(type)?.refresh();
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
