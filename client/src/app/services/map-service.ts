import { Injectable, effect, signal, WritableSignal } from '@angular/core';
import * as L from 'leaflet';
import { map_icons, prettyNames } from '@app/utils/map-utils';
import { NuclearPowerPlantsService } from './nuclear-power-plants-service';
import { ThermalPowerPlantsService } from './thermal-power-plants-service';
import { SolarFarmsService } from './solar-farms-service';
import { WindFarmsService } from './wind-farms-service';
import { HydroelectricDamsService } from './hydroelectric-dams-service';
import { InfrastruturesService } from './infrastrutures-service';

const types = ['hydro', 'eolienneparc', 'solaire', 'thermique', 'nucleaire'];

@Injectable({
  providedIn: 'root',
})
export class MapService {
  get map() { return this._map; }

  private _map?: L.Map;

  private markers: any = {
    eolienneparc: {},
    solaire: {},
    thermique: {},
    hydro: {},
    nucleaire: {},
  }

  constructor(
    private hydroelectricDamnsService: HydroelectricDamsService,
    private windFarmsService: WindFarmsService,
    private solarFarmsService: SolarFarmsService,
    private thermalPowerPlantsService: ThermalPowerPlantsService,
    private nuclearPowerPlantsService: NuclearPowerPlantsService,
    private infrasService: InfrastruturesService,
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
        this.getInfrasSignalByType(type)();
        this.reloadMarkers();
      });
    });
  }

  getInfrasSignalByType(type: string): WritableSignal<any[]> {
    switch (type) {
      case 'hydro':
        return this.hydroelectricDamnsService.infras;
      case 'eolienneparc':
        return this.windFarmsService.infras;
      case 'solaire':
        return this.solarFarmsService.infras;
      case 'thermique':
        return this.thermalPowerPlantsService.infras;
      case 'nucleaire':
        return this.nuclearPowerPlantsService.infras;
    }
    return signal([]);
  }

  onMapLoaded() { setTimeout(() => this.map?.invalidateSize(), 250); }

  createMap() {
    if (this.map)
      throw new Error('Map already created');

    const map = L.map('map', {
      zoomControl: true,
      attributionControl: true,
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

    map.getContainer().addEventListener("drop", function (e: any) {
      e.preventDefault();
      const [type, route] = e.dataTransfer.getData("text/plain").split(",");

      const mapPos = map.getContainer().getBoundingClientRect();
      const x = e.clientX - mapPos.left;
      const y = e.clientY - mapPos.top;

      const latlng = map.containerPointToLatLng([x, y]);

      const lat = parseFloat(latlng.lat.toFixed(6));
      const lng = parseFloat(latlng.lng.toFixed(6));

      console.log('Drag: ', { type, route, lat, lng });
    });

    this._map = map;
    return map;
  }

  destroyMap() {
    if (!this.map)
      throw new Error('Map not created');

    this.map.remove();
    this._map = undefined;
  }

  initMarkers() {
    if (!this.map) return;
    types.forEach(type => this.addMarkers(type, this.getInfrasSignalByType(type)()));
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
      (marker as L.Marker).remove();
    }
    this.markers[type] = {};
  }

  addMarker(type: string, data: any) {
    if (!this.map) return;
    const isActive = this.infrasService.isInfraSelected(type, data.id.toString());
    const iconName = !isActive ? `${type}gris` : type;
    const icon = map_icons[iconName];

    // Construire le contenu du popup en fonction du type
    let popupContent = `<b>${data.nom}</b><br>Catégorie: ${prettyNames[type]}<br>`;

    if (type === 'eolienneparc') {
      popupContent += `
            Nombre d'éoliennes: ${data.nombre_eoliennes || 'N/A'}<br>
            Puissance nominale: ${data.puissance_nominal || 'N/A'} MW<br>
            Capacité totale: ${data.capacite_total || 'N/A'} MW
        `;
    } else if (type === 'hydro') {
      popupContent += `
            type de barrage: ${data.type_barrage || 'N/A'} <br>
            Débit nominal: ${data.debits_nominal ? parseFloat(data.debits_nominal).toFixed(1) : 'N/A'} m³/s<br>
            Puissance nominale: ${data.puissance_nominal || 'N/A'} MW<br>
            Volume du réservoir: ${data.volume_reservoir
          ? data.volume_reservoir >= 1e9
            ? (data.volume_reservoir / 1e9).toFixed(1) + ' Gm³' // Milliards de m³
            : data.volume_reservoir >= 1e6
              ? (data.volume_reservoir / 1e6).toFixed(1) + ' Mm³' // Millions de m³
              : (data.volume_reservoir / 1e3).toFixed(1) + ' km³' // Milliers de m³
          : 'N/A'
        }<br>
        `;
    } else if (type === 'solaire') {
      popupContent += `
            Nombre de panneaux: ${data.nombre_panneau || 'N/A'}<br>
            Orientation des panneaux: ${data.orientation_panneau || 'N/A'}<br>
            Puissance nominale: ${data.puissance_nominal || 'N/A'} MW
        `;
    } else if (type === 'thermique') {
      popupContent += `
            Puissance nominale: ${data.puissance_nominal || 'N/A'} MW<br>
            Type d'intrant: ${data.type_intrant || 'N/A'}
        `;
    } else if (type === 'nucleaire') { // Ajout pour la catégorie nucléaire
      popupContent += `
            Puissance nominale: ${data.puissance_nominal || 'N/A'} MW<br>
            Type d'intrant: ${data.type_intrant || 'N/A'}
        `;
    }

    const marker = L.marker([data.latitude, data.longitude], { icon: icon })
      .addTo(this.map)
      .bindPopup(popupContent);

    this.markers[type][data.id] = marker;
  }

  showMarker(type: string, id: string) {
    let infraId = parseInt(id);
    const dict = this.markers[type];
    const marker = dict[infraId];

    if (marker && this.map) {
      this.map.setView(marker.getLatLng(), 8);
      marker.openPopup();
    }
  }

  private updateMarker(type: string, id: string, isActive: boolean) {
    let infraId = parseInt(id);
    const marker = this.markers[type][infraId];

    if (!marker) return;
    marker.setIcon(!isActive ? map_icons[`${type}gris`] : map_icons[type]);
  }
}
