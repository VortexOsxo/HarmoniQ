import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InfrastruturesService } from '@app/services/infrastrutures-service';
import { DemandeTemporalGraphService } from '@app/services/graph-services/demande-temporal-graph-service';

@Component({
  selector: 'app-capacity-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './capacity-bar.html',
  styleUrl: './capacity-bar.css',
})
export class CapacityBar {

  private infrasService = inject(InfrastruturesService);
  private demandeService = inject(DemandeTemporalGraphService);

  /** Puissance garantie (MW) du groupe actif — mise à jour en temps réel. */
  guaranteedMW = computed(() => this.infrasService.guaranteedPowerMW());

  /**
   * Demande de POINTE (MW) — heure la plus chargée de toute la période de simulation.
   * C'est la valeur pertinente pour le dimensionnement : si la puissance garantie
   * est inférieure à ce pic, le réseau ne peut pas tenir seul lors d'une vague de froid.
   * Disponible après qu'une simulation a été lancée (étape 2 du pipeline).
   */
  peakDemandMW = computed(() => this.demandeService.peakDemandMW());

  /** Pourcentage de couverture du pic de demande par la puissance garantie [0–100+]. */
  fillPercent = computed(() => {
    const peak = this.peakDemandMW();
    if (!peak || peak === 0) return 0;
    return Math.min(100, Math.round((this.guaranteedMW() / peak) * 100));
  });

  /** Classe Bootstrap bg-* selon le niveau de couverture. */
  barColorClass = computed(() => {
    const pct = this.fillPercent();
    if (pct >= 100) return 'bg-success';
    if (pct >= 75)  return 'bg-warning';
    return 'bg-danger';
  });
}
