import { Component, Input } from '@angular/core';
import { InfraListElement } from '../infra-list-element/infra-list-element';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-infra-list-body',
  imports: [CommonModule, InfraListElement],
  templateUrl: './infra-list-body.html',
})
export class InfraListBody {
  @Input({ required: true }) infras!: any;
  @Input({ required: true }) type!: string;
}
