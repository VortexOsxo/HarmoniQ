import { Component, Input } from '@angular/core';
import { InfrastruturesService } from '@app/services/infrastrutures-service';
import { CommonModule } from '@angular/common';
import { SimulationSingleInfraModal } from '@app/components/simulation/simulation-single-infra-modal/simulation-single-infra-modal';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ScenariosService } from '@app/services/scenarios-service';

@Component({
  selector: 'app-infra-list-element',
  imports: [CommonModule],
  templateUrl: './infra-list-element.html',
})
export class InfraListElement {
  @Input({ required: true }) nom!: string;
  @Input({ required: true }) id!: string;
  @Input({ required: true }) type!: string;

  get isSelected(): boolean {
    return this.infrastructuresService.isInfraSelected(this.type, this.id);
  }

  constructor(
    private infrastructuresService: InfrastruturesService,
    private scenarioService: ScenariosService,
    private modalService: NgbModal,
  ) { }

  toggleInfra() {
    this.infrastructuresService.toggleInfra(this.type, this.id);
  }

  simulate_single() {
    if (!this.scenarioService.selectedScenario())
      return;

    const modalRef = this.modalService.open(SimulationSingleInfraModal, { size: 'xl' });

    modalRef.componentInstance.id = this.id;
    modalRef.componentInstance.name = this.nom;
    modalRef.componentInstance.type = this.type;
  }

  handleInfoClick() { }
}
