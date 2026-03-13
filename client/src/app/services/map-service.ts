import { Injectable, effect } from '@angular/core';
import * as L from 'leaflet';
import 'leaflet.markercluster';
import { map_icons, prettyNames } from '@app/utils/map-utils';
import { createClusterIcon } from '@app/utils/cluster-icon';
import { InfrastruturesService } from './infrastrutures-service';
import { MapLineService } from './map-line-service';
import { ProtectedAreasService } from './protected-areas-service';
import { InfraDetailService } from './infra-detail-service';

const types = ['hydro', 'eolienneparc', 'solaire', 'thermique', 'nucleaire'];

@Injectable({
  providedIn: 'root',
})
export class MapService {
  get map() { return this._map; }

  private _map?: L.Map;
  private clusterGroup?: L.MarkerClusterGroup;

  private markers: any = {
    eolienneparc: {},
    solaire: {},
    thermique: {},
    hydro: {},
    nucleaire: {},
  }

  constructor(
    private infrasService: InfrastruturesService,
    private mapLineService: MapLineService,
    private protectedAreasService: ProtectedAreasService,
    private infraDetailService: InfraDetailService
  ) {
    effect(() => {
      // reload markers when selected infra group changes
      infrasService.selectedInfraGroup();
      this.reloadMarkers();
    });

    this.infrasService.infraToggled.subscribe(({ type, id, isActive }: { type: string, id: string, isActive: boolean }) => {
      this.updateMarker(type, id, isActive);
    });

    types.forEach(type => {
      effect(() => {
        this.infrasService.getInfrasSignalByType(type)();
        this.reloadMarkers();
      });
    });
  }


  onMapLoaded() { setTimeout(() => this.map?.invalidateSize(), 250); }

  createMap() {
    if (this.map)
      throw new Error('Map already created');

    const map = L.map('map', {
      zoomControl: true,
      attributionControl: false,
      maxZoom: 12,
      minZoom: 5
    }).setView([52.9399, -67], 4);

    // Texture of the map, could be fun to add some more
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    }).addTo(map);

    var bounds: L.LatLngBoundsExpression = [
      [40.0, -90.0],
      [65.0, -50.0]
    ];
    map.setMaxBounds(bounds);

    map.getContainer().addEventListener("dragover", function (e) {
      e.preventDefault();
    });

    const infrasService = this.infrasService;
    map.getContainer().addEventListener("drop", function (e: any) {
      e.preventDefault();
      const [className, type] = e.dataTransfer.getData("text/plain").split(",");

      const mapPos = map.getContainer().getBoundingClientRect();
      const x = e.clientX - mapPos.left;
      const y = e.clientY - mapPos.top;

      const latlng = map.containerPointToLatLng([x, y]);

      const lat = parseFloat(latlng.lat.toFixed(6));
      const lng = parseFloat(latlng.lng.toFixed(6));

      infrasService.createInfra(className, type, lat, lng);
    });

    this.mapLineService.addLinesToMap(map);

    this._map = map;

    this.clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 70,
      disableClusteringAtZoom: 8,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction: (cluster) => createClusterIcon(cluster),
    });
    map.addLayer(this.clusterGroup);

    return map;
  }

  destroyMap() {
    if (!this.map)
      throw new Error('Map not created');

    this.map.remove();
    this._map = undefined;
    this.clusterGroup = undefined;
  }

  initMarkers() {
    if (!this.map) return;
    types.forEach(type => this.addMarkers(type, this.infrasService.getInfrasSignalByType(type)()));
  }

  destroyMarkers() {
    if (!this.map) return;
    types.forEach(type => this.removeMarkers(type));
  }

  reloadMarkers() {
    this.destroyMarkers();
    this.initMarkers();
  }

  addMarkers(type: string, infras: any[]) {
    infras.forEach(infra => this.addMarker(type, infra));
  }

  removeMarkers(type: string) {
    const markers = this.markers[type];
    for (const marker of Object.values(markers)) {
      const m = marker as L.Marker;
      if (this.clusterGroup) {
        this.clusterGroup.removeLayer(m);
      }
      m.remove();
    }
    this.markers[type] = {};
  }

  addMarker(type: string, data: any) {
    if (!this.map) return;
    const isActive = this.infrasService.isInfraSelected(type, data.id.toString());
    const iconName = !isActive ? `${type}gris` : type;
    const icon = map_icons[iconName];

    const marker = L.marker([data.latitude, data.longitude], {
      icon: icon,
      infraType: type,
      infraActive: isActive,
    } as any);

    // Open detail panel on marker click instead of popup
    marker.on('click', () => {
      this.infraDetailService.openDetail(type, data.id.toString());
    });

    if (this.clusterGroup) {
      this.clusterGroup.addLayer(marker);
    } else {
      marker.addTo(this.map);
    }

    this.markers[type][data.id] = marker;
  }

  showMarker(type: string, id: string) {
    this.infraDetailService.openDetail(type, id);
  }

  private updateMarker(type: string, id: string, isActive: boolean) {
    let infraId = parseInt(id);
    const marker = this.markers[type][infraId];

    if (!marker) return;
    marker.setIcon(!isActive ? map_icons[`${type}gris`] : map_icons[type]);
    (marker.options as any).infraActive = isActive;

    if (this.clusterGroup) {
      this.clusterGroup.refreshClusters();
    }
  }
}
