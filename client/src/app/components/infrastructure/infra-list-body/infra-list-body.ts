import { Component, Input } from '@angular/core';
import { InfraListElement } from '../infra-list-element/infra-list-element';
import { CommonModule } from '@angular/common';
import { InfrastruturesService } from '@app/services/infrastrutures-service';

@Component({
  selector: 'app-infra-list-body',
  imports: [CommonModule, InfraListElement],
  templateUrl: './infra-list-body.html',
})
export class InfraListBody {
  @Input({ required: true }) infras!: any;
  @Input({ required: true }) type!: string;

  constructor(private infrastructuresService: InfrastruturesService) { }

  selectAll() {
    this.infrastructuresService.setInfrasForType(this.type, this.infras.map((infra: any) => infra.id.toString()));
  }

  selectNone() {
    this.infrastructuresService.setInfrasForType(this.type, []);
  }
}
