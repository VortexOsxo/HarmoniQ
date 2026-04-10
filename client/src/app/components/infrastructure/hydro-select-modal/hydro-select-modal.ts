import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { InfrastruturesService } from '@app/services/infrastrutures-service';
import { MapService } from '@app/services/map-service';

@Component({
  selector: 'app-hydro-select-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './hydro-select-modal.html',
  styleUrls: ['./hydro-select-modal.css'],
})
export class HydroSelectModal implements OnInit {
  searchText = '';
  availableDams: any[] = [];

  constructor(
    public activeModal: NgbActiveModal,
    private infrasService: InfrastruturesService,
    private mapService: MapService,
  ) {}

  ngOnInit(): void {
    this.availableDams = this.infrasService.getAvailableFictionalHydros();
  }

  get filteredDams(): any[] {
    if (!this.searchText.trim()) return this.availableDams;
    const q = this.searchText.trim().toLowerCase();
    return this.availableDams.filter((d: any) =>
      d.nom?.toLowerCase().includes(q)
    );
  }

  getTypeLabel(type: string): string {
    if (!type) return '';
    const t = type.toLowerCase();
    if (t === 'reservoir' || t === 'réservoir') return 'Réservoir';
    if (t.includes('fil')) return "Fil de l'eau";
    return type;
  }

  getTypeIcon(type: string): string {
    const t = (type || '').toLowerCase();
    if (t === 'reservoir' || t === 'réservoir') return 'fa-solid fa-database';
    return 'fa-solid fa-water';
  }

  selectDam(dam: any): void {
    this.infrasService.addFictionalHydroToMap(dam.id);
    this.activeModal.close(dam);

    // Zoomer sur le barrage ajouté
    const map = this.mapService.map;
    if (map && dam.latitude && dam.longitude) {
      map.flyTo([dam.latitude, dam.longitude], 8, { duration: 1.2 });
    }
  }

  get hasNoDams(): boolean {
    return this.availableDams.length === 0;
  }
}
