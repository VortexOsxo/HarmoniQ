import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { InfrastruturesService } from '@app/services/infrastrutures-service';
import { SimulationTemporalGraphService } from '@app/services/graph-services/simulation-temporal-graph-service';

@Component({
  selector: 'app-capacity-bar',
  standalone: true,
  imports: [CommonModule, NgbTooltipModule],
  templateUrl: './capacity-bar.html',
  styleUrl: './capacity-bar.css',
})
export class CapacityBar {

  private infrasService = inject(InfrastruturesService);
  private simService = inject(SimulationTemporalGraphService);


  guaranteedMW = computed(() => this.infrasService.guaranteedPowerMW());
  peakDemandMW = computed(() => this.simService.peakDemandMW());

  fillPercent = computed(() => {
    const peak = this.peakDemandMW();
    if (!peak || peak === 0) return 0;
    return Math.min(100, Math.round((this.guaranteedMW() / peak) * 100));
  });

  barColorClass = computed(() => {
    const pct = this.fillPercent();
    if (pct >= 100) return 'bg-success';
    if (pct >= 75)  return 'bg-warning';
    return 'bg-danger';
  });
}
