import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbAccordionModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SolarFarmsService } from '@app/services/solar-farms-service';
import { CommonModule } from '@angular/common';
import { InfrastruturesService } from '@app/services/infrastrutures-service';
import { InfrastructureGroup } from '@app/models/infrastructure-group';
import { InfraListElement } from '../infra-list-element/infra-list-element';
import { HydroelectricDamsService } from '@app/services/hydroelectric-dams-service';
import { NuclearPowerPlantsService } from '@app/services/nuclear-power-plants-service';
import { ThermalPowerPlantsService } from '@app/services/thermal-power-plants-service';
import { WindFarmsService } from '@app/services/wind-farms-service';
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
    return this.infrastructuresService.infraGroups();
  }

  get selectedInfrastructureGroup(): InfrastructureGroup | null {
    return this.infrastructuresService.selectedInfraGroup();
  }

  set selectedInfrastructureGroup(infrastructureGroup: InfrastructureGroup | null) {
    this.infrastructuresService.selectedInfraGroup.set(infrastructureGroup);
  }

  infras: any[] = []

  constructor(
    private infrastructuresService: InfrastruturesService,
    private modalService: NgbModal,
    public solarFarmsService: SolarFarmsService,
    public hydroelectricDamsService: HydroelectricDamsService,
    public nuclearPowerPlantsService: NuclearPowerPlantsService,
    public thermalPowerPlantsService: ThermalPowerPlantsService,
    public windFarmsService: WindFarmsService
  ) {
    this.infras = [
      { name: 'Barrage Hydro-Électrique', type: 'hydro', infras: this.hydroelectricDamsService.infras },
      { name: 'Parc Éolien', type: 'eolienneparc', infras: this.windFarmsService.infras },
      { name: 'Parc Solaire', type: 'solaire', infras: this.solarFarmsService.infras },
      { name: 'Centrale Thermique', type: 'thermique', infras: this.thermalPowerPlantsService.infras },
      { name: 'Centrale Nucléaire', type: 'nucleaire', infras: this.nuclearPowerPlantsService.infras }
    ]
  }

  compareInfraGroups(g1: InfrastructureGroup, g2: InfrastructureGroup): boolean {
    return g1 && g2 ? g1.id === g2.id : g1 === g2;
  }

  openCreateModal() {
    this.modalService.open(CreateInfraGroupModal);
  }

}
