import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbAccordionModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule } from '@angular/common';
import { InfrastruturesService } from '@app/services/infrastrutures-service';
import { InfrastructureGroup } from '@app/models/infrastructure-group';
import { InfraListBody } from '../infra-list-body/infra-list-body';
import { CreateInfraGroupModal } from '../create-infra-group-modal/create-infra-group-modal';

@Component({
  selector: 'app-infrastructure-selector',
  imports: [CommonModule, FormsModule, NgbAccordionModule, InfraListBody],
  templateUrl: './infrastructure-selector.html',
  styleUrl: './infrastructure-selector.css',
})
export class InfrastructureSelector {

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

  compareInfraGroups(g1: InfrastructureGroup, g2: InfrastructureGroup): boolean {
    return g1 && g2 ? g1.id === g2.id : g1 === g2;
  }

  openCreateModal() {
    this.modalService.open(CreateInfraGroupModal);
  }

}
