import { Component } from '@angular/core';
import { RouterModule, Router } from '@angular/router';

@Component({
  selector: 'app-top-bar-logo',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './top-bar-logo.html',
  styleUrl: './top-bar-logo.css',
})
export class TopBarLogo {
  constructor(public router: Router) {}
}
