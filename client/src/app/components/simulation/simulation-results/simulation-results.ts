import { Component, AfterViewInit } from '@angular/core';
import { NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import * as L from 'leaflet';

@Component({
  selector: 'app-simulation-results',
  imports: [NgbNavModule],
  templateUrl: './simulation-results.html',
  styleUrl: './simulation-results.css',
})
export class SimulationResults implements AfterViewInit {
  activeTab = 'map';

  ngAfterViewInit(): void {
    // TODO: Initialize map
  }
}
