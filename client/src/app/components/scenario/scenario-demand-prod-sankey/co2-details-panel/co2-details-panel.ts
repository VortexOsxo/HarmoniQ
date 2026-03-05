import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Co2DetailsData } from '../sankey-data.types';

@Component({
  selector: 'app-co2-details-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './co2-details-panel.html',
  styleUrl: './co2-details-panel.css',
})
export class Co2DetailsPanelComponent {
  @Input() data!: Co2DetailsData;

  formatCo2(value: number): string {
    return Math.round(value).toLocaleString('fr-FR');
  }

  formatPercent(value: number): string {
    return value.toFixed(1) + '%';
  }
}
