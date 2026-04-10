import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbAccordionModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule } from '@angular/common';
import { InfrastruturesService } from '@app/services/infrastrutures-service';
import { DEFAULT_INFRA_GROUP_ID, InfrastructureGroup } from '@app/models/infrastructure-group';
import { InfraListBody } from '../infra-list-body/infra-list-body';
import { CreateInfraGroupModal } from '../create-infra-group-modal/create-infra-group-modal';
import { ConfirmationModal } from '@app/components/commons/confirmation-modal/confirmation-modal';
import { CapacityBar } from '../capacity-bar/capacity-bar';
import { EnergyBar } from '../energy-bar/energy-bar';
import { INFRA_COLORS } from '@app/data/infra-colors.data';

@Component({
  selector: 'app-infrastructure-selector',
  imports: [CommonModule, FormsModule, NgbAccordionModule, InfraListBody, CapacityBar, EnergyBar],
  templateUrl: './infrastructure-selector.html',
  styleUrl: './infrastructure-selector.css',
})
export class InfrastructureSelector {
  readonly defaultInfraGroupId = DEFAULT_INFRA_GROUP_ID;
  /** Mêmes teintes que le panneau « Ajouter une infrastructure » sur la carte. */
  readonly infraColors = INFRA_COLORS;

  filterText = '';
  sortAsc = true;

  get infrastructureGroups(): InfrastructureGroup[] {
    return this.infrasService.infraGroups();
  }

  get selectedInfrastructureGroup(): InfrastructureGroup | null {
    return this.infrasService.selectedInfraGroup();
  }

  set selectedInfrastructureGroup(infrastructureGroup: InfrastructureGroup | null) {
    this.infrasService.selectedInfraGroup.set(infrastructureGroup);
  }

  infras: any[] = []

  get visibleCategories() {
    if (!this.filterText.trim()) {
      return this.infras;
    }
    // Only show categories that have matches when searching
    return this.infras.filter(cat => this.getFilteredAndSortedInfras(cat.type).length > 0);
  }

  getFilteredAndSortedInfras(type: string) {
    let infrasList = this.infrasService.getInfrasSignalByType(type)();
    
    // Filter by name (case-insensitive)
    if (this.filterText.trim()) {
      const query = this.filterText.trim().toLowerCase();
      infrasList = infrasList.filter((i: any) => i.nom && i.nom.toLowerCase().includes(query));
    }
    
    // Sort by name (A-Z or Z-A)
    return [...infrasList].sort((a: any, b: any) => {
      const cmp = (a.nom || '').localeCompare(b.nom || '', 'fr', { sensitivity: 'base' });
      return this.sortAsc ? cmp : -cmp;
    });
  }

  getInfrasFromType(type: string) {
    return this.infrasService.getInfrasSignalByType(type);
  }

  constructor(
    public infrasService: InfrastruturesService,
    private modalService: NgbModal,
  ) {
    this.infras = [
      { name: 'Barrage Hydro-Électrique', type: 'hydro' },
      { name: 'Parc Éolien', type: 'eolienneparc' },
      { name: 'Parc Solaire', type: 'solaire' },
      { name: 'Centrale Thermique', type: 'thermique', },
      { name: 'Centrale Nucléaire', type: 'nucleaire', }
    ]
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
    if (!group || group.id === DEFAULT_INFRA_GROUP_ID) return;

    const modalRef = this.modalService.open(ConfirmationModal, { centered: true });
    modalRef.componentInstance.title = 'Supprimer le groupe d\'infrastructures';
    modalRef.componentInstance.message = `Êtes-vous sûr de vouloir supprimer le groupe "${group.nom}" ? Cette action est irréversible.`;
    modalRef.componentInstance.confirmText = 'Supprimer';

    modalRef.result.then((confirmed) => {
      if (confirmed) {
        this.infrasService.deleteInfraGroup(group);
      }
    }).catch(() => { });
  }

}
