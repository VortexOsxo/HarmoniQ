import { Component, AfterViewInit, OnDestroy, OnInit } from '@angular/core';
import { MapService } from '@app/services/map-service';
import * as L from 'leaflet';

@Component({
  selector: 'app-quebec-map',
  imports: [],
  templateUrl: './quebec-map.html',
  styleUrl: './quebec-map.css',
})
export class QuebecMap implements AfterViewInit, OnDestroy, OnInit {
  private map!: L.Map;
  private sub: any;

  constructor(private mapService: MapService) { }

  ngOnInit(): void {
    this.sub = this.mapService.mapLoaded.subscribe(() => {
      setTimeout(() => {
        this.map.invalidateSize();
      }, 150);
    });
  }

  ngAfterViewInit(): void {
    this.createMap();

    setTimeout(() => {
      this.map.invalidateSize();
    }, 150);
  }

  private createMap() {
    this.map = L.map('map', {
      zoomControl: true,
      attributionControl: true,
      maxZoom: 12,
      minZoom: 5
    }).setView([52.9399, -67], 4);

    // Texture of the map, could be fun to add some more
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    }).addTo(this.map);

    var bounds: L.LatLngBoundsExpression = [
      [40.0, -90.0],
      [65.0, -50.0]
    ];
    this.map.setMaxBounds(bounds);

  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
