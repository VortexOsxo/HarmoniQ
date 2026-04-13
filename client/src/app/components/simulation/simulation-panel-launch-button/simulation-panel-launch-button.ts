import { Component, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SimulationService } from '@app/services/simulation-service';

@Component({
  selector: 'app-simulation-panel-launch-button',
  imports: [CommonModule],
  templateUrl: './simulation-panel-launch-button.html',
  styleUrl: './simulation-panel-launch-button.css',
})
export class SimulationPanelLaunchButton {
  canLaunch!: Signal<boolean>;

  constructor(public simulationService: SimulationService) {
    this.canLaunch = this.simulationService.canLaunch;
  }

  onLaunchClick(): void {
    this.simulationService.requestLaunchFromMap();
  }
}
