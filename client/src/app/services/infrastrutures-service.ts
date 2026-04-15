import { HttpClient } from '@angular/common/http';
import { computed, effect, EventEmitter, Injectable, signal, inject, Injector } from '@angular/core';
import { DEFAULT_INFRA_GROUP_ID, InfrastructureGroup } from '@app/models/infrastructure-group';
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
import { isFictionalHydro } from '@app/data/fictional-hydro-names';
import { firstValueFrom, Subject } from 'rxjs';
import { SnackbarService } from './snackbar-service';
import { InfraDetailService } from './infra-detail-service';

export interface PendingInfra {
  id: number;
  lat: number;
  lng: number;
  name: string;
  type: string;
}

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
const FICTIONAL_HYDRO_IDS_KEY = 'harmoniq_added_fictional_hydros';
const LAST_INFRA_GROUP_KEY = 'harmoniq_last_selected_infra_group_id';

const typeSchemaMap: Record<string, string> = {
  'eolienneparc': 'EolienneParcBase',
  'solaire': 'SolaireBase',
  'thermique': 'ThermiqueBase',
  'nucleaire': 'NucleaireBase',
};

export class InfrasContainer<T extends Infra<T>> {

  infras = signal<T[]>([]);
  /** Barrages fictifs provenant de la DB (hydro seulement). */
  fictionalInfras = signal<T[]>([]);
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
      const allDbInfras = data.map((i: any) => this.factory.fromJson(i));

      // Séparer les fictifs (hydro seulement)
      const isHydro = this.factory.getType() === 'hydro';
      const dbInfras = isHydro
        ? allDbInfras.filter((i: any) => !isFictionalHydro(i.nom))
        : allDbInfras;
      const fictional = isHydro
        ? allDbInfras.filter((i: any) => isFictionalHydro(i.nom))
        : [];

      this.fictionalInfras.set(fictional);

      // Charger les fictifs précédemment ajoutés par l'utilisateur
      const addedFictionalIds: number[] = this.storageService.loadObject(FICTIONAL_HYDRO_IDS_KEY) ?? [];
      const addedFictional = fictional
        .filter((i: any) => addedFictionalIds.includes(i.id))
        .map((i: any) => ({ ...i, isUserCreated: true }));

      const localInfras = this.storageService.loadElements(`${INFRA_KEY}_${this.factory.getType()}`)
        .map((i: any) => ({ ...this.factory.fromJson(i), isUserCreated: true }));

      this.infras.set([...dbInfras, ...addedFictional, ...localInfras]);
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

  updateLocal(raw: any): void {
    const infra = this.factory.fromJson(raw);
    infra.isUserCreated = true;
    this.infras.update(list => list.map(i => i.id === infra.id ? infra : i));
  }

  /** Ajoute un barrage fictif au signal infras (le marque comme userCreated). */
  addFictional(id: number): void {
    const fictional = this.fictionalInfras().find((i: any) => i.id === id);
    if (!fictional) return;
    // Éviter les doublons
    if (this.infras().some(i => i.id === id)) return;
    const copy = { ...fictional, isUserCreated: true } as T;
    this.infras.update(list => [...list, copy]);
  }

  /** Retire un barrage fictif du signal infras. */
  removeFictional(id: number): void {
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

  readonly activeGroup = computed(() => {
    const selected = this.selectedInfraGroup();
    if (!selected) return null;
    if (selected.id === DEFAULT_INFRA_GROUP_ID) return this.defaultInfraGroup();
    return selected;
  });

  private injector = inject(Injector);

  infraToggled = new EventEmitter<{ type: string, id: string, isActive: boolean }>();

  /** Émis quand l'utilisateur crée une nouvelle infrastructure locale. */
  newUserInfra$ = new Subject<PendingInfra>();
  /** Émis quand l'utilisateur supprime une infrastructure locale (par id). */
  deletedUserInfraId$ = new Subject<number>();

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
  guaranteedPowerMW = computed(() =>
    this._sumInstalledMW(['hydro', 'thermique', 'nucleaire']) +
    Math.round(this._sumInstalledMW(['eolienneparc']) * 0.3) +
    Math.round(this._sumInstalledMW(['solaire']) * 0.3)
  );
  windInstalledMW = computed(() => this._sumInstalledMW(['eolienneparc']));
  solarInstalledMW = computed(() => this._sumInstalledMW(['solaire']));

  private _sumInstalledMW(types: string[]): number {
    const group: any = this.activeGroup();
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
    private http: HttpClient,
    private modalService: NgbModal,
    private openApiService: OpenApiService,
    private storageService: LocalStorageService,
    private snackbarService: SnackbarService,
  ) {
    this.refreshInfraGroups();

    const factories = [HydroelectricDamFactory, WindFarmFactory, SolarFarmFactory, ThermalPowerPlantFactory, NuclearPowerPlantFactory];
    factories.forEach((Factory) => {
      const factory = new Factory();
      this.infrasContainer.set(factory.getType(), new InfrasContainer<Infra<any>>(http, factory, storageService));
    });

    const lastId = this.storageService.loadObject(LAST_INFRA_GROUP_KEY);
    const lastGroup = lastId != null ? this.infraGroups().find(g => g.id === lastId) : null;
    this.selectedInfraGroup.set(lastGroup ?? this.getDefaultInfraGroup());

    this.infrasContainer.forEach((container) => {
      container.loaded.subscribe(() => {
        if (this.selectedInfraGroup() != null && this.selectedInfraGroup()?.id !== DEFAULT_INFRA_GROUP_ID)
          return;
        this.selectedInfraGroup.set(this.getDefaultInfraGroup());
      });
    });

    effect(() => {
      const selected = this.selectedInfraGroup();
      if (selected) {
        this.storageService.saveObject(LAST_INFRA_GROUP_KEY, selected.id);
      }
    });
  }

  createInfra(className: string, type: string, lat: number, lon: number, isOffshore: boolean = false) {
    const schemas = this.openApiService.getOpenApiSchemas();

    const modalRef = this.modalService.open(CreateInfraModal, { centered: true, scrollable: true });

    modalRef.componentInstance.schema = schemas[className];
    modalRef.componentInstance.type = type;
    modalRef.componentInstance.lat = lat;
    modalRef.componentInstance.lon = lon;
    modalRef.componentInstance.isOffshore = isOffshore;


    modalRef.result.then(result => {
      if (!result) return;

      const localInfra = this.storageService.createElement(`${INFRA_KEY}_${type}`, { ...result, isUserCreated: true });
      const idStr = localInfra.id.toString();
      this.infrasContainer.get(type)?.addLocal(localInfra);

      this.toggleInfra(type, idStr);

      this.newUserInfra$.next({
        id: localInfra.id,
        lat: result.latitude,
        lng: result.longitude,
        name: result.nom,
        type,
      });

      const detailService = this.injector.get(InfraDetailService);
      detailService.openDetail(type, idStr);
    }).catch(() => { });
  }

  editInfra(type: string, infraData: any) {
    const schemaName = typeSchemaMap[type];
    if (!schemaName) return;

    const schemas = this.openApiService.getOpenApiSchemas();
    const modalRef = this.modalService.open(CreateInfraModal, { centered: true, scrollable: true });

    modalRef.componentInstance.schema = schemas[schemaName];
    modalRef.componentInstance.type = type;
    modalRef.componentInstance.lat = parseFloat(infraData.latitude || infraData.lat);
    modalRef.componentInstance.lon = parseFloat(infraData.longitude || infraData.lng);
    modalRef.componentInstance.editData = infraData;

    modalRef.result.then(result => {
      if (!result) return;

      const updated = { ...result, id: infraData.id, isUserCreated: true };
      this.storageService.updateElement(`${INFRA_KEY}_${type}`, updated);
      this.infrasContainer.get(type)?.updateLocal(updated);

      const group = this.selectedInfraGroup();
      if (group) {
        this.selectedInfraGroup.set({ ...group });
      }

      const detailService = this.injector.get(InfraDetailService);
      detailService.openDetail(type, String(infraData.id));
    }).catch(() => { });
  }

  deleteLocalInfra(type: string, id: number): void {
    // Vérifier si c'est un barrage fictif ajouté
    if (type === 'hydro') {
      const container = this.infrasContainer.get('hydro');
      const isFictional = container?.fictionalInfras().some(i => i.id === id);
      if (isFictional) {
        this.removeFictionalHydroFromMap(id);
        return;
      }
    }

    this.storageService.deleteElement(`${INFRA_KEY}_${type}`, id);
    this.infrasContainer.get(type)?.removeLocal(id);
    this.deletedUserInfraId$.next(id);

    const key = typeKeyMap[type];
    if (key) {
      const updatedGroups = this.localInfraGroups().map(group => {
        const anyGroup = group as any;
        if (anyGroup[key] && anyGroup[key].includes(id.toString())) {
          anyGroup[key] = anyGroup[key].filter((i: string) => i !== id.toString());
          this.storageService.updateElement(INFRA_GROUPS_KEY, anyGroup);
        }
        return anyGroup as InfrastructureGroup;
      });

      this.localInfraGroups.set(updatedGroups);
    }

    const group: any = this.selectedInfraGroup();
    if (group) {
      const updated = { ...group };
      if (key && updated[key]) {
        updated[key] = updated[key].filter((i: string) => i !== id.toString());
      }
      this.selectedInfraGroup.set(updated);
      this._persistSelectedGroup();
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

  async checkOffshore(lat: number, lon: number): Promise<boolean> {
    try {
      const res: any = await firstValueFrom(
        this.http.get(`${environment.apiUrl}/meteo/offshore-check`, {
          params: { latitude: lat, longitude: lon }
        })
      );
      return res.is_offshore || false;
    } catch (e) {
      console.error('Offshore check failed', e);
      return false;
    }
  }

  overrideHydroPuissance(id: number, puissance: number): void {
    this.hydroPuissanceOverrides.update(map => {
      const next = new Map(map);
      next.set(id, puissance);
      return next;
    });
  }

  // ── Gestion des barrages fictifs ──────────────────────────────────────────

  /** Retourne la liste des barrages fictifs pas encore ajoutés à la carte. */
  getAvailableFictionalHydros(): any[] {
    const container = this.infrasContainer.get('hydro');
    if (!container) return [];
    const allFictional = container.fictionalInfras();
    const currentIds = new Set(container.infras().map(i => i.id));
    return allFictional.filter(i => !currentIds.has(i.id));
  }

  /** Ajoute un barrage fictif à la carte et au groupe d'infras sélectionné. */
  addFictionalHydroToMap(id: number): void {
    const container = this.infrasContainer.get('hydro');
    if (!container) return;

    container.addFictional(id);

    // Persister l'ID
    const addedIds: number[] = this.storageService.loadObject(FICTIONAL_HYDRO_IDS_KEY) ?? [];
    if (!addedIds.includes(id)) {
      addedIds.push(id);
      this.storageService.saveObject(FICTIONAL_HYDRO_IDS_KEY, addedIds);
    }

    // Ajouter au groupe sélectionné (utilise toggleInfra pour gérer le branching)
    this.toggleInfra('hydro', id.toString());
  }

  /** Retire un barrage fictif de la carte et du groupe d'infras. */
  removeFictionalHydroFromMap(id: number): void {
    const container = this.infrasContainer.get('hydro');
    if (!container) return;

    container.removeFictional(id);

    // Retirer de la persistance
    const addedIds: number[] = this.storageService.loadObject(FICTIONAL_HYDRO_IDS_KEY) ?? [];
    const filtered = addedIds.filter(i => i !== id);
    this.storageService.saveObject(FICTIONAL_HYDRO_IDS_KEY, filtered);

    // Retirer du groupe sélectionné et des groupes locaux
    const idStr = id.toString();
    const key = 'central_hydroelectriques';

    const group: any = this.selectedInfraGroup();
    if (group && group[key]?.includes(idStr)) {
      group[key] = group[key].filter((i: string) => i !== idStr);
      this.selectedInfraGroup.set({ ...group });
      this._persistSelectedGroup();
    }

    // Aussi retirer des groupes locaux
    const updatedGroups = this.localInfraGroups().map(g => {
      const anyG = g as any;
      if (anyG[key]?.includes(idStr)) {
        anyG[key] = anyG[key].filter((i: string) => i !== idStr);
        this.storageService.updateElement(INFRA_GROUPS_KEY, anyG);
      }
      return anyG as InfrastructureGroup;
    });
    this.localInfraGroups.set(updatedGroups);
  }

  isInfraSelected(type: string, infraId: string) {
    const infraGroup: any = this.activeGroup();
    if (!infraGroup) return false;

    const key = typeKeyMap[type];
    if (!key) return false;
    return infraGroup[key].includes(infraId);
  }

  isDefaultInfraGroup(group: InfrastructureGroup | null | undefined): boolean {
    return group != null && group.id === DEFAULT_INFRA_GROUP_ID;
  }

  toggleInfra(type: string, infraId: string) {
    const currentGroup: any = this.selectedInfraGroup();
    if (!currentGroup) return;

    const isDefault = this.isDefaultInfraGroup(currentGroup);
    const infraGroup = isDefault
      ? { ...currentGroup, id: 0, nom: this._getNextDefaultGroupName() }
      : { ...currentGroup };

    const key = typeKeyMap[type];
    if (!key) return;

    let isActive = false;
    if (infraGroup[key].includes(infraId)) {
      infraGroup[key] = infraGroup[key].filter((id: string) => id !== infraId);
      isActive = false;
    } else {
      infraGroup[key] = [...infraGroup[key], infraId];
      isActive = true;
    }

    if (isDefault) {
      this.createInfraGroup(infraGroup);
      this.snackbarService.show(
        "Nouveau groupe d'infrastructures",
        `Le groupe « ${infraGroup.nom} » a été créé car le groupe Infrastructures québécoises ne peut pas être modifié.`,
        'info'
      );
    } else {
      this.selectedInfraGroup.set(infraGroup);
      this._persistSelectedGroup();
      this.localInfraGroups.update(s => s.map(g => g.id === infraGroup.id ? infraGroup : g));
    }

    this.infraToggled.emit({ type, id: infraId, isActive });
  }

  setInfrasForType(type: string, infrasIds: any[]) {
    this.setInfrasForTypes({ [type]: infrasIds });
  }

  setInfrasForTypes(infrasByType: Record<string, any[]>) {
    const currentGroup: any = this.selectedInfraGroup();
    if (!currentGroup) return;

    const isDefault = this.isDefaultInfraGroup(currentGroup);
    const infraGroup = isDefault
      ? { ...currentGroup, id: 0, nom: this._getNextDefaultGroupName() }
      : { ...currentGroup };

    for (const [type, infrasIds] of Object.entries(infrasByType)) {
      const key = typeKeyMap[type];
      if (!key) continue;
      infraGroup[key] = infrasIds;
    }

    if (isDefault) {
      this.createInfraGroup(infraGroup);
      this.snackbarService.show(
        "Nouveau groupe d'infrastructures",
        `Le groupe « ${infraGroup.nom} » a été créé car le groupe Infrastructures québécoises ne peut pas être modifié.`,
        'info'
      );
    } else {
      this.selectedInfraGroup.set(infraGroup);
      this._persistSelectedGroup();
      this.localInfraGroups.update(s => s.map(g => g.id === infraGroup.id ? infraGroup : g));
    }
  }

  refreshInfraGroups() {
    const groups = this.storageService.loadElements<InfrastructureGroup>(INFRA_GROUPS_KEY);
    this.localInfraGroups.set(groups);

    const selected = this.selectedInfraGroup();
    if (selected && selected.id !== DEFAULT_INFRA_GROUP_ID) {
      const updated = groups.find((g) => g.id === selected.id);
      if (updated) {
        this.selectedInfraGroup.set({ ...updated });
      }
    }
  }

  renameInfraGroup(group: InfrastructureGroup, newName: string) {
    if (!newName.trim() || group.id === DEFAULT_INFRA_GROUP_ID) return;
    const updated = { ...group, nom: newName.trim() };
    this.storageService.updateElement(INFRA_GROUPS_KEY, updated);
    this.localInfraGroups.update(s => s.map(g => g.id === group.id ? updated : g));
    if (this.selectedInfraGroup()?.id === group.id) {
      this.selectedInfraGroup.set(updated);
    }
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
      this.selectedInfraGroup.set(this.getDefaultInfraGroup());
    }
  }

  buildSimulationPayload(): any {
    const group: any = this.activeGroup();
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

      // Infras user-created : toujours incluses avec is_user_created=true
      const userInfras = allInfras
        .filter((i: any) => i.isUserCreated)
        .map((infra: any) => {
          const { isUserCreated, ...raw } = infra;
          return { ...raw, is_user_created: true };
        });

      payload[groupKey] = [...selectedInfras, ...userInfras];
    }

    return payload;
  }

  private _persistSelectedGroup() {
    const group = this.selectedInfraGroup();
    if (group && group.id !== DEFAULT_INFRA_GROUP_ID)
      this.storageService.updateElement(INFRA_GROUPS_KEY, group);
  }

  private _getNextDefaultGroupName(): string {
    const baseName = "Groupe d'infrastructure";
    const groups = this.infraGroups();
    let index = 1;
    let name = `${baseName} ${index}`;
    while (groups.some(g => g.nom === name)) {
      index++;
      name = `${baseName} ${index}`;
    }
    return name;
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
