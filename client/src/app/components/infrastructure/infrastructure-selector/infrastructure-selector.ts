import { Component, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule } from '@angular/common';
import { InfrastruturesService } from '@app/services/infrastrutures-service';
import { DEFAULT_INFRA_GROUP_ID, InfrastructureGroup } from '@app/models/infrastructure-group';
import { InfraListElement } from '../infra-list-element/infra-list-element';
import { CreateInfraGroupModal } from '../create-infra-group-modal/create-infra-group-modal';
import { INFRA_COLORS } from '@app/data/infra-colors.data';
import { DeleteConfirmButtonComponent } from '@app/components/commons/delete-confirm-button/delete-confirm-button';

interface InfraCategory {
  name: string;
  type: string;
  shortName: string;
}

@Component({
  selector: 'app-infrastructure-selector',
  imports: [CommonModule, FormsModule, InfraListElement, DeleteConfirmButtonComponent],
  templateUrl: './infrastructure-selector.html',
  styleUrl: './infrastructure-selector.css',
})
export class InfrastructureSelector {
  readonly defaultInfraGroupId = DEFAULT_INFRA_GROUP_ID;
  readonly infraColors = INFRA_COLORS;

  filterText = '';
  sortAsc = true;
  isRenaming = false;
  renameValue = '';
  @ViewChild('renameInput') renameInput?: ElementRef<HTMLInputElement>;

  /** Set of currently visible type filters. All enabled by default. */
  activeFilters = new Set<string>();

  get infrastructureGroups(): InfrastructureGroup[] {
    return this.infrasService.infraGroups();
  }

  get selectedInfrastructureGroup(): InfrastructureGroup | null {
    return this.infrasService.selectedInfraGroup();
  }

  set selectedInfrastructureGroup(infrastructureGroup: InfrastructureGroup | null) {
    this.infrasService.selectedInfraGroup.set(infrastructureGroup);
  }

  infras: InfraCategory[] = [];

  /** Returns a flat list of all infras from active type filters, with type attached. */
  get flatFilteredInfras(): { infra: any; type: string }[] {
    const result: { infra: any; type: string }[] = [];
    for (const cat of this.infras) {
      if (!this.activeFilters.has(cat.type)) continue;
      for (const infra of this.getFilteredAndSortedInfras(cat.type)) {
        result.push({ infra, type: cat.type });
      }
    }
    // Sort the combined list
    result.sort((a, b) => {
      const cmp = (a.infra.nom || '').localeCompare(b.infra.nom || '', 'fr', { sensitivity: 'base' });
      return this.sortAsc ? cmp : -cmp;
    });
    return result;
  }

  getFilteredAndSortedInfras(type: string) {
    let infrasList = this.infrasService.getInfrasSignalByType(type)();

    if (this.filterText.trim()) {
      const query = this.filterText.trim().toLowerCase();
      infrasList = infrasList.filter((i: any) => i.nom && i.nom.toLowerCase().includes(query));
    }

    return [...infrasList].sort((a: any, b: any) => {
      const cmp = (a.nom || '').localeCompare(b.nom || '', 'fr', { sensitivity: 'base' });
      return this.sortAsc ? cmp : -cmp;
    });
  }

  constructor(
    public infrasService: InfrastruturesService,
    private modalService: NgbModal,
  ) {
    this.infras = [
      { name: 'Barrage Hydro-Électrique', type: 'hydro', shortName: 'Hyd' },
      { name: 'Parc Éolien', type: 'eolienneparc', shortName: 'Éol' },
      { name: 'Parc Solaire', type: 'solaire', shortName: 'Sol' },
      { name: 'Centrale Thermique', type: 'thermique', shortName: 'Therm' },
      { name: 'Centrale Nucléaire', type: 'nucleaire', shortName: 'Nuc' },
    ];
    // All types active by default
    this.activeFilters = new Set(this.infras.map(i => i.type));
  }

  toggleFilter(type: string): void {
    if (this.activeFilters.has(type)) {
      this.activeFilters.delete(type);
    } else {
      this.activeFilters.add(type);
    }
  }

  isFilterActive(type: string): boolean {
    return this.activeFilters.has(type);
  }

  toggleSort(): void {
    this.sortAsc = !this.sortAsc;
  }

  compareInfraGroups(g1: InfrastructureGroup, g2: InfrastructureGroup): boolean {
    return g1 && g2 ? g1.id === g2.id : g1 === g2;
  }

  openCreateModal() {
    this.modalService.open(CreateInfraGroupModal);
  }

  deleteInfraGroup() {
    const group = this.selectedInfrastructureGroup;
    if (group && group.id !== DEFAULT_INFRA_GROUP_ID) {
      this.infrasService.deleteInfraGroup(group);
    }
  }

  startRenaming() {
    const group = this.selectedInfrastructureGroup;
    if (!group || group.id === DEFAULT_INFRA_GROUP_ID) return;
    this.renameValue = group.nom;
    this.isRenaming = true;
    setTimeout(() => {
      this.renameInput?.nativeElement.select();
    });
  }

  confirmRename() {
    const group = this.selectedInfrastructureGroup;
    if (group && this.renameValue.trim()) {
      this.infrasService.renameInfraGroup(group, this.renameValue);
    }
    this.isRenaming = false;
  }

  cancelRename() {
    this.isRenaming = false;
  }

  selectAllVisible() {
    const byType: Record<string, any[]> = {};
    for (const cat of this.infras) {
      if (!this.activeFilters.has(cat.type)) continue;
      byType[cat.type] = this.getFilteredAndSortedInfras(cat.type).map((i: any) => i.id.toString());
    }
    this.infrasService.setInfrasForTypes(byType);
  }

  deselectAllVisible() {
    const visibleByType = new Map<string, Set<string>>();
    for (const item of this.flatFilteredInfras) {
      const ids = visibleByType.get(item.type) ?? new Set();
      ids.add(item.infra.id.toString());
      visibleByType.set(item.type, ids);
    }
    const byType: Record<string, any[]> = {};
    for (const [type, visibleIds] of visibleByType) {
      const allInfras = this.infrasService.getInfrasSignalByType(type)();
      byType[type] = allInfras
        .filter((i: any) => !visibleIds.has(i.id.toString()) && this.infrasService.isInfraSelected(type, i.id.toString()))
        .map((i: any) => i.id.toString());
    }
    this.infrasService.setInfrasForTypes(byType);
  }
}
