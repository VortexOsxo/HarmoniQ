import { HttpClient } from '@angular/common/http';
import { computed, EventEmitter, Injectable, signal } from '@angular/core';
import { InfrastructureGroup } from '@app/models/infrastructure-group';
import { environment } from 'environments/environment';
import { OpenApiService } from './open-api-service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CreateInfraModal } from '@app/components/infrastructure/create-infra-modal/create-infra-modal';
import { Infra, InfraFactory } from '@app/models/infras/infra';
import { HydroelectricDamFactory } from '@app/models/infras/hydroelectric-dam';
import { WindFarmFactory } from '@app/models/infras/wind-farm';
import { SolarFarmFactory } from '@app/models/infras/solar-farm';
import { ThermalPowerPlantFactory } from '@app/models/infras/thermal-power-plant';
import { NuclearPowerPlantFactory } from '@app/models/infras/nuclear-power-plant';
import { LocalStorageService } from './local-storage-service';
import { Subject } from 'rxjs';

// Hack pcq le code etait ass et j'ai la flemme
const typeKeyMap: Record<string, string> = {
  'hydro': 'central_hydroelectriques',
  'eolienneparc': 'parc_eoliens',
  'solaire': 'parc_solaires',
  'thermique': 'central_thermique',
  'nucleaire': 'central_nucleaire'
};

const INFRA_KEY = 'harmoniq_local_infras';
const INFRA_GROUPS_KEY = 'harmoniq_local_infra_groups';

export class InfrasContainer<T extends Infra<T>> {

  infras = signal<T[]>([]);
  loaded = new Subject<void>();

  private get apiUrl() {
    return `${environment.apiUrl}/${this.factory.getType()}`;
  }

  constructor(
    private http: HttpClient,
    private factory: InfraFactory<T>,
    private storageService: LocalStorageService
  ) {
    this.refresh();
  }

  refresh() {
    this.http.get(this.apiUrl).subscribe((data: any) => {
      const dbInfras = data.map((i: any) => this.factory.fromJson(i));

      const localInfras = this.storageService.loadElements(`${INFRA_KEY}_${this.factory.getType()}`)
        .map((i: any) => ({ ...this.factory.fromJson(i), isUserCreated: true }));

      this.infras.set([...dbInfras, ...localInfras]);
      this.loaded.next();
    });
  }

  addLocal(raw: any): void {
    const infra = this.factory.fromJson(raw);
    infra.isUserCreated = true;
    this.infras.update(list => [...list, infra]);
  }

  removeLocal(id: number): void {
    this.infras.update(list => list.filter(i => i.id !== id));
  }
}

@Injectable({
  providedIn: 'root',
})
export class InfrastruturesService {

  selectedInfraGroup = signal<InfrastructureGroup | null>(null);

  private localInfraGroups = signal<InfrastructureGroup[]>([]);
  private defaultInfraGroup = computed(() => this.getDefaultInfraGroup());
  infraGroups = computed(() => [this.defaultInfraGroup(), ...this.localInfraGroups()])

  infraToggled = new EventEmitter<{ type: string, id: string, isActive: boolean }>();
  /**
 * Puissance garantie (MW) du groupe d'infrastructures actif.
 *
 * Seuls les types à production pilotable sont comptabilisés :
 *   - Hydro (fil de l'eau + réservoir)
 *   - Thermique
 *   - Nucléaire
 * L'éolien et le solaire sont exclus (production intermittente, non garantie).
 *
 * Se recalcule automatiquement dès qu'une infrastructure est cochée/décochée
 * ou qu'un groupe différent est sélectionné.
 */
  guaranteedPowerMW = computed(() => this._sumInstalledMW(['hydro', 'thermique', 'nucleaire']));
  windInstalledMW = computed(() => this._sumInstalledMW(['eolienneparc']));
  solarInstalledMW = computed(() => this._sumInstalledMW(['solaire']));

  private _sumInstalledMW(types: string[]): number {
    const group: any = this.selectedInfraGroup();
    if (!group) return 0;
    const overrides = this.hydroPuissanceOverrides();
    let total = 0;
    for (const type of types) {
      const key = typeKeyMap[type];
      const selectedIds: string[] = group[key] ?? [];
      const allInfras = this.infrasContainer.get(type)?.infras() ?? [];
      for (const id of selectedIds) {
        const infra = allInfras.find((i: any) => String(i.id) === id) as any;
        if (infra?.puissance_nominal) {
          const p = type === 'hydro' ? (overrides.get(Number(infra.id)) ?? Number(infra.puissance_nominal)) : Number(infra.puissance_nominal);
          total += p;
        }
      }
    }
    return Math.round(total);
  }
  infrasContainer = new Map<string, InfrasContainer<Infra<any>>>();
  hydroPuissanceOverrides = signal<Map<number, number>>(new Map());

  constructor(
    http: HttpClient,
    private modalService: NgbModal,
    private openApiService: OpenApiService,
    private storageService: LocalStorageService,
  ) {
    this.refreshInfraGroups();
    this.selectedInfraGroup.set(this.getDefaultInfraGroup());

    const factories = [HydroelectricDamFactory, WindFarmFactory, SolarFarmFactory, ThermalPowerPlantFactory, NuclearPowerPlantFactory];
    factories.forEach((Factory) => {
      const factory = new Factory();
      this.infrasContainer.set(factory.getType(), new InfrasContainer<Infra<any>>(http, factory, storageService));
    });

    this.infrasContainer.forEach((container) => {
      container.loaded.subscribe(() => {
        if (this.selectedInfraGroup() != null && this.selectedInfraGroup()?.id !== 1)
          return;
        this.selectedInfraGroup.set(this.getDefaultInfraGroup());
      });
    });
  }

  createInfra(className: string, type: string, lat: number, lon: number) {
    const schemas = this.openApiService.getOpenApiSchemas();

    const modalRef = this.modalService.open(CreateInfraModal, { centered: true, scrollable: true });

    modalRef.componentInstance.schema = schemas[className];
    modalRef.componentInstance.type = type;
    modalRef.componentInstance.lat = lat;
    modalRef.componentInstance.lon = lon;

    modalRef.result.then(result => {
      if (!result) return;

      const localInfra = this.storageService.createElement(`${INFRA_KEY}_${type}`, { ...result, isUserCreated: true });
      this.infrasContainer.get(type)?.addLocal(localInfra);
    });
  }

  deleteLocalInfra(type: string, id: number): void {
    this.storageService.deleteElement(`${INFRA_KEY}_${type}`, id);
    this.infrasContainer.get(type)?.removeLocal(id);

    const key = typeKeyMap[type];
    if (key) {
      let groupsChanged = false;
      const updatedGroups = this.localInfraGroups().map(group => {
        const anyGroup = group as any;
        if (anyGroup[key] && anyGroup[key].includes(id.toString())) {
          anyGroup[key] = anyGroup[key].filter((i: string) => i !== id.toString());
          this.storageService.updateElement(INFRA_GROUPS_KEY, anyGroup);
          groupsChanged = true;
        }
        return anyGroup as InfrastructureGroup;
      });

      if (groupsChanged) {
        this.localInfraGroups.set(updatedGroups);
        const selected = this.selectedInfraGroup();
        if (selected) {
          const selectedUpdated = updatedGroups.find(g => g.id === selected.id);
          if (selectedUpdated) {
            this.selectedInfraGroup.set({ ...selectedUpdated });
          }
        }
      }
    }
  }

  getInfrasSignalByType(type: string) {
    const container = this.infrasContainer.get(type);
    return container?.infras ?? signal([]);
  }

  getInfraByTypeAndId(type: string, id: number | string): any {
    const list = this.getInfrasSignalByType(type)();
    return list.find((i: any) => String(i.id) === String(id));
  }

  isNameTaken(name: string): boolean {
    const normalizedName = name.trim().toLowerCase();
    for (const container of this.infrasContainer.values()) {
      if (container.infras().some(i => i.nom?.trim().toLowerCase() === normalizedName)) {
        return true;
      }
    }
    return false;
  }

  refreshService(type: string) {
    this.infrasContainer.get(type)?.refresh();
  }

  overrideHydroPuissance(id: number, puissance: number): void {
    this.hydroPuissanceOverrides.update(map => {
      const next = new Map(map);
      next.set(id, puissance);
      return next;
    });
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

    this.selectedInfraGroup.set({ ...infraGroup });
    this._persistSelectedGroup();
    this.infraToggled.emit({ type, id: infraId, isActive });
  }

  setInfrasForType(type: string, infrasIds: any[]) {
    const infraGroup: any = this.selectedInfraGroup();
    if (!infraGroup) return;

    const key = typeKeyMap[type];
    if (!key) return;
    infraGroup[key] = infrasIds;

    this.selectedInfraGroup.set({ ...infraGroup });
    this._persistSelectedGroup();
  }

  refreshInfraGroups() {
    const groups = this.storageService.loadElements<InfrastructureGroup>(INFRA_GROUPS_KEY);
    this.localInfraGroups.set(groups);
  }

  createInfraGroup(group: InfrastructureGroup) {
    const newGroup = this.storageService.createElement(INFRA_GROUPS_KEY, group);
    this.localInfraGroups.update(s => [...s, newGroup]);
    this.selectedInfraGroup.set(newGroup);
    return newGroup;
  }

  deleteInfraGroup(group: InfrastructureGroup) {
    this.storageService.deleteElement(INFRA_GROUPS_KEY, group.id);
    this.localInfraGroups.update(s => s.filter(item => item.id !== group.id));
    if (this.selectedInfraGroup()?.id === group.id) {
      this.selectedInfraGroup.set(null);
    }
  }

  buildSimulationPayload(): any {
    const group: any = this.selectedInfraGroup();
    if (!group) return null;

    const payload: any = { nom: group.nom };

    for (const [type, groupKey] of Object.entries(typeKeyMap)) {
      const selectedIds: string[] = group[groupKey] ?? [];
      const allInfras = this.infrasContainer.get(type)?.infras() ?? [];

      const overrides = this.hydroPuissanceOverrides();
      const selectedInfras = selectedIds
        .map(id => allInfras.find((i: any) => String(i.id) === id))
        .filter(Boolean)
        .map((infra: any) => {
          const { isUserCreated, ...raw } = infra;
          if (type === 'hydro' && overrides.has(raw.id)) {
            raw.puissance_nominal = overrides.get(raw.id);
          }
          return raw;
        });

      payload[groupKey] = selectedInfras;
    }

    return payload;
  }

  private _persistSelectedGroup() {
    const group = this.selectedInfraGroup();
    if (group)
      this.storageService.updateElement(INFRA_GROUPS_KEY, group);
  }

  private getDefaultInfraGroup(): InfrastructureGroup {
    let get_default_infra = (type: string) => {
      const container = this.infrasContainer.get(type);
      if (!container) return [];
      return container.infras().filter((infra) => !infra.isUserCreated).map((infra) => infra.id.toString());
    };

    return {
      id: 1,
      nom: 'Infrastructures québécoises',
      parc_eoliens: get_default_infra('eolienneparc'),
      parc_solaires: get_default_infra('solaire'),
      central_hydroelectriques: get_default_infra('hydro'),
      central_thermique: get_default_infra('thermique'),
      central_nucleaire: get_default_infra('nucleaire'),
    };
  }
}
