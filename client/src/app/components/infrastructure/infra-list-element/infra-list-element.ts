import { Component, Input } from '@angular/core';
import { InfrastruturesService } from '@app/services/infrastrutures-service';
import { CommonModule } from '@angular/common';

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

  constructor(private infrastructuresService: InfrastruturesService) { }

  toggleInfra() {
    this.infrastructuresService.toggleInfra(this.type, this.id);
  }

  simulate_single() { }

  handleInfoClick() { }
}
