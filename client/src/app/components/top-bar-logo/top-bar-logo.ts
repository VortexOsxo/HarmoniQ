import { Component, EventEmitter, Output, Input } from '@angular/core';
import { RouterModule, Router } from '@angular/router';

@Component({
  selector: 'app-top-bar-logo',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './top-bar-logo.html',
  styleUrl: './top-bar-logo.css',
})
export class TopBarLogo {
  @Input() disableDefaultRouting = false;
  @Output() logoClick = new EventEmitter<Event>();

  constructor(public router: Router) {}

  onBrandClick(event: Event) {
    if (this.disableDefaultRouting) {
      event.preventDefault();
      this.logoClick.emit(event);
    } else {
      this.logoClick.emit(event);
    }
  }
}
