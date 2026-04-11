import { Component, AfterViewInit, OnDestroy, signal, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapService } from '@app/services/map-service';
import { ProtectedAreasService } from '@app/services/protected-areas-service';
import { ReseauService, BUS_CATEGORIES, LINE_CATEGORIES } from '@app/services/reseau-service';
import { INFRA_COLORS } from '@app/data/infra-colors.data';
import { InfraDetailService } from '@app/services/infra-detail-service';
import { WindMapService } from '@app/services/wind-map-service';
import { NgbModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { HydroSelectModal } from '@app/components/infrastructure/hydro-select-modal/hydro-select-modal';
import { InfrastruturesService } from '@app/services/infrastrutures-service';

@Component({
  selector: 'app-quebec-map',
  imports: [CommonModule, FormsModule, NgbTooltipModule],
  templateUrl: './quebec-map.html',
  styleUrl: './quebec-map.css',
})
export class QuebecMap implements AfterViewInit, OnDestroy {
  toolTipText = 'Glissez et déposez sur la carte pour ajouter une infrastructure';

  /** Couleurs des pastilles résultats — teinte des icônes « Ajouter une infrastructure » */
  readonly infraColors = INFRA_COLORS;

  busCategories = BUS_CATEGORIES;
  lineCategories = LINE_CATEGORIES;
  infraFiltersOpen = signal(false);

  infraTypes = [
    { key: 'hydro', label: 'Barrage Hydro-Électrique', color: INFRA_COLORS['hydro'] },
    { key: 'eolienneparc', label: 'Parc Éolien', color: INFRA_COLORS['eolienneparc'] },
    { key: 'solaire', label: 'Parc Solaire', color: INFRA_COLORS['solaire'] },
    { key: 'thermique', label: 'Centrale Thermique', color: INFRA_COLORS['thermique'] },
    { key: 'nucleaire', label: 'Centrale Nucléaire', color: INFRA_COLORS['nucleaire'] },
  ];

  get map() {
    return this.mapService.map;
  }





  constructor(
    private mapService: MapService,
    public protectedAreasService: ProtectedAreasService,
    public reseauService: ReseauService,
    public infraDetailService: InfraDetailService,
    public windMapService: WindMapService,
    private modalService: NgbModal,
    private infrasService: InfrastruturesService,
  ) { }

  openHydroSelectModal(): void {
    this.modalService.open(HydroSelectModal, {
      centered: true,
      scrollable: true,
      size: 'md',
    });
  }

  ngAfterViewInit(): void {
    this.initMapAndIcons();
    this.mapService.onMapLoaded();
  }

  private initMapAndIcons() {
    this.mapService.createMap();
    this.mapService.initMarkers();

    if (this.mapService.map) {
      this.protectedAreasService.initLayer(this.mapService.map);
      this.reseauService.initLayer(this.mapService.map);
    }

    const draggableIcons = document.querySelectorAll('.icon-draggable');

    draggableIcons.forEach((iconEl) => {
      iconEl.addEventListener('dragstart', function (e: any) {
        let type = e.target.getAttribute('type');
        let route = e.target.getAttribute('route');

        e.dataTransfer.setData('text/plain', `${type}Base,${route}`);
      });
    });
  }

  ngOnDestroy(): void {
    this.reseauService.destroy();
    this.protectedAreasService.destroy();
    this.mapService.destroyMap();
    this.mapService.destroyMarkers();
  }
}
