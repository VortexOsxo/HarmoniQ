import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapService } from '@app/services/map-service';
import { ProtectedAreasService } from '@app/services/protected-areas-service';
import { ReseauService, BUS_CATEGORIES, LINE_CATEGORIES } from '@app/services/reseau-service';
import { InfraDetailService } from '@app/services/infra-detail-service';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';


@Component({
  selector: 'app-quebec-map',
  imports: [CommonModule, FormsModule, NgbTooltipModule],
  templateUrl: './quebec-map.html',
  styleUrl: './quebec-map.css',
})
export class QuebecMap implements AfterViewInit, OnDestroy {
  toolTipText = 'Glissez et déposez sur la carte pour ajouter une infrastructure';

  busCategories = BUS_CATEGORIES;
  lineCategories = LINE_CATEGORIES;

  get map() {
    return this.mapService.map;
  }

  constructor(
    private mapService: MapService,
    public protectedAreasService: ProtectedAreasService,
    public reseauService: ReseauService,
    public infraDetailService: InfraDetailService
  ) { }

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

    const draggableIcons = document.querySelectorAll(".icon-draggable");

    draggableIcons.forEach(iconEl => {
      iconEl.addEventListener("dragstart", function (e: any) {
        let type = e.target.getAttribute('type');
        let route = e.target.getAttribute('route');

        e.dataTransfer.setData("text/plain", `${type}Base,${route}`);
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
