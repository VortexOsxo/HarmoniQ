import { Component, Input } from '@angular/core';
import { InfrastruturesService } from '@app/services/infrastrutures-service';
import { CommonModule } from '@angular/common';
import { SimulationSingleInfraModal } from '../../simulation/simulation-single-infra-modal/simulation-single-infra-modal';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ScenariosService } from '@app/services/scenarios-service';
import { InfraDetailService } from '@app/services/infra-detail-service';
import { DeleteConfirmButtonComponent } from '@app/components/commons/delete-confirm-button/delete-confirm-button';

@Component({
  selector: 'app-infra-list-element',
  imports: [CommonModule, DeleteConfirmButtonComponent],
  templateUrl: './infra-list-element.html',
  styleUrl: './infra-list-element.css',
})
export class InfraListElement {
  @Input({ required: true }) nom!: string;
  @Input({ required: true }) id!: string;
  @Input({ required: true }) type!: string;
  @Input() isUserCreated: boolean = false;
  @Input() typeBadgeColor: string = '';

  get isSelected(): boolean {
    return this.infrastructuresService.isInfraSelected(this.type, this.id);
  }

  get isToggleLocked(): boolean {
    return false;
  }

  get rowTitle(): string {
    const g = this.infrastructuresService.selectedInfraGroup();
    if (g && this.infrastructuresService.isDefaultInfraGroup(g)) {
      return 'Modifier cette infrastructure créera une copie modifiée du groupe québécois.';
    }
    return 'Cliquez pour sélectionner ou désélectionner cette infrastructure';
  }

  constructor(
    private infrastructuresService: InfrastruturesService,
    private scenarioService: ScenariosService,
    private modalService: NgbModal,
    private infraDetailService: InfraDetailService,
  ) { }

  onRowClick() {
    this.infrastructuresService.toggleInfra(this.type, this.id);
  }

  simulate_single(event: any) {
    event.stopPropagation();
    if (!this.scenarioService.selectedScenario())
      return;

    const modalRef = this.modalService.open(SimulationSingleInfraModal, { size: 'xl', windowClass: 'sim-infra-modal' });

    modalRef.componentInstance.id = this.id;
    modalRef.componentInstance.name = this.nom;
    modalRef.componentInstance.type = this.type;
  }

  handleInfoClick(event: any) {
    event.stopPropagation();
    this.infraDetailService.openDetail(this.type, this.id);
  }

  deleteInfra() {
    this.infrastructuresService.deleteLocalInfra(this.type, parseInt(this.id));
  }
}
