import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { MapService } from '@app/services/map-service';
import { INFRA_COLORS } from '@app/data/infra-colors.data';

@Component({
  selector: 'app-infrastructures-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './infrastructures-modal.html',
  styleUrls: ['./infrastructures-modal.css'],
})
export class InfrastructuresModal {
  infraTypes = [
    { key: 'hydro', label: 'Barrage Hydro-Électrique', color: INFRA_COLORS['hydro'] },
    { key: 'eolienneparc', label: 'Parc Éolien', color: INFRA_COLORS['eolienneparc'] },
    { key: 'solaire', label: 'Parc Solaire', color: INFRA_COLORS['solaire'] },
    { key: 'thermique', label: 'Centrale Thermique', color: INFRA_COLORS['thermique'] },
    { key: 'nucleaire', label: 'Centrale Nucléaire', color: INFRA_COLORS['nucleaire'] },
  ];

  constructor(
    public activeModal: NgbActiveModal,
    public mapService: MapService
  ) {}

  get mapFilterName() { return this.mapService.mapFilterName(); }
  set mapFilterName(val: string) { this.mapService.mapFilterName.set(val); }

  get mapFilterMinPower() { return this.mapService.mapFilterMinPower(); }
  set mapFilterMinPower(val: number | null) { this.mapService.mapFilterMinPower.set(val); }

  get mapFilterMaxPower() { return this.mapService.mapFilterMaxPower(); }
  set mapFilterMaxPower(val: number | null) { this.mapService.mapFilterMaxPower.set(val); }

  get showRealInfra() { return this.mapService.showRealInfra(); }
  set showRealInfra(val: boolean) { this.mapService.showRealInfra.set(val); }

  get showUserInfra() { return this.mapService.showUserInfra(); }
  set showUserInfra(val: boolean) { this.mapService.showUserInfra.set(val); }

  isInfraTypeSelected(type: string): boolean {
    return this.mapService.mapFilterTypes().has(type);
  }

  toggleInfraType(type: string) {
    const current = new Set(this.mapService.mapFilterTypes());
    if (current.has(type)) {
      current.delete(type);
    } else {
      current.add(type);
    }
    this.mapService.mapFilterTypes.set(current);
  }

  selectAll() {
    this.mapService.mapFilterTypes.set(new Set(this.infraTypes.map((t) => t.key)));
  }

  deselectAll() {
    this.mapService.mapFilterTypes.set(new Set());
  }
}
