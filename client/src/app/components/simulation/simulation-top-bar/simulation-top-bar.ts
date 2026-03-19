import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { SimulationService } from '@app/services/simulation-service';
import { CommonModule } from '@angular/common';
import { TopBarLogo } from "@app/components/top-bar-logo/top-bar-logo";

@Component({
  selector: 'app-simulation-top-bar',
  standalone: true,
  imports: [CommonModule, RouterModule, TopBarLogo],
  templateUrl: './simulation-top-bar.html',
  styleUrl: './simulation-top-bar.css',
})
export class SimulationTopBar {
  simulationService = inject(SimulationService);
  private router = inject(Router);

  goBack() {
    this.router.navigate(['/map']);
  }
}
