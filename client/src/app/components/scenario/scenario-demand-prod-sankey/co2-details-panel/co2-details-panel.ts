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
  @Input() loading = false;

  get sortedSources() {
    return [...this.data.sources].sort((a, b) => b.percentage - a.percentage);
  }

  formatCo2(value: number): string {
    if (value >= 10)  return Math.round(value).toLocaleString('fr-FR');
    if (value >= 1)   return value.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
    return value.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  }

  formatPercent(value: number): string {
    return value.toFixed(1) + '%';
  }
}
