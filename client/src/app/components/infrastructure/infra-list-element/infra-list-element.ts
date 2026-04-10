import { Component, Input } from '@angular/core';
import { InfrastruturesService } from '@app/services/infrastrutures-service';
import { CommonModule } from '@angular/common';
import { SimulationSingleInfraModal } from '../../simulation/simulation-single-infra-modal/simulation-single-infra-modal';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ScenariosService } from '@app/services/scenarios-service';
import { InfraDetailService } from '@app/services/infra-detail-service';
import { ConfirmationModal } from '@app/components/commons/confirmation-modal/confirmation-modal';

@Component({
  selector: 'app-infra-list-element',
  imports: [CommonModule],
  templateUrl: './infra-list-element.html',
})
export class InfraListElement {
  @Input({ required: true }) nom!: string;
  @Input({ required: true }) id!: string;
  @Input({ required: true }) type!: string;
  @Input() isUserCreated: boolean = false;

  get isSelected(): boolean {
    return this.infrastructuresService.isInfraSelected(this.type, this.id);
  }

  constructor(
    private infrastructuresService: InfrastruturesService,
    private scenarioService: ScenariosService,
    private modalService: NgbModal,
    private infraDetailService: InfraDetailService,
  ) { }

  toggleInfra() {
    this.infrastructuresService.toggleInfra(this.type, this.id);
  }

  simulate_single(event: any) {
    event.stopPropagation();
    if (!this.scenarioService.selectedScenario())
      return;

    const modalRef = this.modalService.open(SimulationSingleInfraModal, { size: 'xl' });

    modalRef.componentInstance.id = this.id;
    modalRef.componentInstance.name = this.nom;
    modalRef.componentInstance.type = this.type;
  }

  handleInfoClick(event: any) {
    event.stopPropagation();
    this.infraDetailService.openDetail(this.type, this.id);
  }

  deleteInfra(event: any) {
    event.stopPropagation();

    const modalRef = this.modalService.open(ConfirmationModal, { centered: true });
    modalRef.componentInstance.title = 'Supprimer l\'infrastructure';
    modalRef.componentInstance.message = 'Êtes-vous sûr de vouloir supprimer cette infrastructure? L\'action est irréversible.';
    modalRef.componentInstance.confirmText = 'Supprimer';

    modalRef.result.then((confirmed) => {
      if (confirmed) {
        this.infrastructuresService.deleteLocalInfra(this.type, parseInt(this.id));
      }
    }).catch(() => { });
  }
}
