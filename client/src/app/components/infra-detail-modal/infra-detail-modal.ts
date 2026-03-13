import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InfraDetailService } from '@app/services/infra-detail-service';
import { InfrastruturesService } from '@app/services/infrastrutures-service';

@Component({
  selector: 'app-infra-detail-modal',
  imports: [CommonModule],
  templateUrl: './infra-detail-modal.html',
  styleUrl: './infra-detail-modal.css',
})
export class InfraDetailModal {
  activeTab: 'informations' | 'impacts' = 'informations';

  isOpen = computed(() => this.infraDetailService.isOpen());
  infra = computed(() => this.infraDetailService.selectedInfra());

  constructor(
    public infraDetailService: InfraDetailService,
    private infrasService: InfrastruturesService
  ) {}

  deleteInfra() {
    const infra = this.infra();
    if (infra && infra.data.isUserCreated) {
      this.infrasService.deleteLocalInfra(infra.type, infra.data.id);
      this.close();
    }
  }

  close() {
    this.infraDetailService.closeDetail();
    this.activeTab = 'informations';
  }

  switchTab(tab: 'informations' | 'impacts') {
    this.activeTab = tab;
  }

  getIconForType(type: string): string {
    const icons: Record<string, string> = {
      hydro: '/icons/barrage.png',
      eolienneparc: '/icons/eolienne.png',
      solaire: '/icons/solaire.png',
      thermique: '/icons/thermique.png',
      nucleaire: '/icons/nucelaire.png',
    };
    return icons[type] || '';
  }

  getInfoFields(): { icon: string; label: string; value: string }[] {
    const infra = this.infra();
    if (!infra) return [];

    const d = infra.data;
    const fields: { icon: string; label: string; value: string }[] = [];

    fields.push({ icon: 'fa-solid fa-tag', label: 'Catégorie', value: infra.categoryName });

    if (infra.type === 'hydro') {
      fields.push({ icon: 'fa-solid fa-water', label: 'Type de barrage', value: d.type_barrage || 'N/A' });
      fields.push({ icon: 'fa-solid fa-gauge-high', label: 'Débit nominal', value: d.debits_nominal ? `${parseFloat(d.debits_nominal).toFixed(1)} m³/s` : 'N/A' });
      fields.push({ icon: 'fa-solid fa-bolt', label: 'Puissance nominale', value: d.puissance_nominal ? `${d.puissance_nominal} MW` : 'N/A' });
      fields.push({ icon: 'fa-solid fa-database', label: 'Volume du réservoir', value: this.formatVolume(d.volume_reservoir) });
    } else if (infra.type === 'eolienneparc') {
      fields.push({ icon: 'fa-solid fa-wind', label: "Nombre d'éoliennes", value: d.nombre_eoliennes || 'N/A' });
      fields.push({ icon: 'fa-solid fa-bolt', label: 'Puissance nominale', value: d.puissance_nominal ? `${d.puissance_nominal} MW` : 'N/A' });
      fields.push({ icon: 'fa-solid fa-battery-full', label: 'Capacité totale', value: d.capacite_total ? `${d.capacite_total} MW` : 'N/A' });
    } else if (infra.type === 'solaire') {
      fields.push({ icon: 'fa-solid fa-solar-panel', label: 'Nombre de panneaux', value: d.nombre_panneau || 'N/A' });
      fields.push({ icon: 'fa-solid fa-compass', label: 'Orientation des panneaux', value: d.orientation_panneau ? `${d.orientation_panneau}° S` : 'N/A' });
      fields.push({ icon: 'fa-solid fa-bolt', label: 'Puissance nominale', value: d.puissance_nominal ? `${d.puissance_nominal} MW` : 'N/A' });
    } else if (infra.type === 'thermique' || infra.type === 'nucleaire') {
      fields.push({ icon: 'fa-solid fa-bolt', label: 'Puissance nominale', value: d.puissance_nominal ? `${d.puissance_nominal} MW` : 'N/A' });
      fields.push({ icon: 'fa-solid fa-fire', label: "Type d'intrant", value: d.type_intrant || 'N/A' });
    }

    return fields;
  }

  private formatVolume(vol: number | null | undefined): string {
    if (!vol) return 'N/A';
    if (vol >= 1e9) return `${(vol / 1e9).toFixed(1)} Gm³`;
    if (vol >= 1e6) return `${(vol / 1e6).toFixed(1)} Mm³`;
    return `${(vol / 1e3).toFixed(1)} km³`;
  }
}
