import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-infra-list-element',
  imports: [],
  templateUrl: './infra-list-element.html',
})
export class InfraListElement {
  @Input({ required: true }) nom!: string;
  @Input({ required: true }) id!: string;
  @Input({ required: true }) type!: string;

  constructor() { }

  add_infra() { }

  simulate_single() { }

  handleInfoClick() { }
}
