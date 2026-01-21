import { Component, AfterViewInit, OnDestroy, OnInit, effect } from '@angular/core';
import { MapService } from '@app/services/map-service';
import * as L from 'leaflet';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { HydroelectricDamsService } from '@app/services/hydroelectric-dams-service';
import { WindFarmsService } from '@app/services/wind-farms-service';
import { ThermalPowerPlantsService } from '@app/services/thermal-power-plants-service';
import { NuclearPowerPlantsService } from '@app/services/nuclear-power-plants-service';
import { SolarFarmsService } from '@app/services/solar-farms-service';

@Component({
  selector: 'app-quebec-map',
  imports: [NgbTooltipModule],
  templateUrl: './quebec-map.html',
  styleUrl: './quebec-map.css',
})
export class QuebecMap implements AfterViewInit, OnDestroy, OnInit {
  private map!: L.Map;
  private sub: any;

  toolTipText = 'Glissez et déposez sur la carte pour ajouter une infrastructure';

  markers: any = {
    eolienneparc: {},
    solaire: {},
    thermique: {},
    hydro: {},
    nucleaire: {},
  }

  map_icons: any = {
    eolienneparc: L.icon({
      iconUrl: '/icons/eolienne.png',
      iconSize: [30, 30],
      iconAnchor: [20, 20]
    }),
    solaire: L.icon({
      iconUrl: '/icons/solaire.png',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    }),
    thermique: L.icon({
      iconUrl: '/icons/thermique.png',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    }),
    hydro: L.icon({
      iconUrl: '/icons/barrage.png',
      iconSize: [50, 50],
      iconAnchor: [20, 20]
    }),
    nucleaire: L.icon({
      iconUrl: '/icons/nucelaire.png',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    }),

    eolienneparcgris: L.icon({
      iconUrl: '/icons/eolienne_gris.png',
      iconSize: [30, 30],
      iconAnchor: [20, 20]
    }),
    solairegris: L.icon({
      iconUrl: '/icons/solaire_gris.png',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    }),
    thermiquegris: L.icon({
      iconUrl: '/icons/thermique_gris.png',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    }),
    hydrogris: L.icon({
      iconUrl: '/icons/barrage_gris.png',
      iconSize: [50, 50],
      iconAnchor: [20, 20]
    }),
    nucleairegris: L.icon({
      iconUrl: '/icons/nucelaire_gris.png',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    })
  };

  prettyNames: any = {
    eolienneparc: "Parc éolien",
    solaire: "Parc solaire",
    thermique: "Centale thermique",
    nucleaire: "Centrale nucléaire",
    hydro: "Barrage hydroélectrique"
  }

  constructor(
    private mapService: MapService,
    private hydroelectricDamnsService: HydroelectricDamsService,
    private windFarmsService: WindFarmsService,
    private solarFarmsService: SolarFarmsService,
    private thermalPowerPlantsService: ThermalPowerPlantsService,
    private nuclearPowerPlantsService: NuclearPowerPlantsService
  ) {
    this.addMarkers();
  }

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

    const draggableIcons = document.querySelectorAll(".icon-draggable");

    draggableIcons.forEach(iconEl => {
      iconEl.addEventListener("dragstart", function (e: any) {
        let type = e.target.getAttribute('type');
        let route = e.target.getAttribute('route');

        e.dataTransfer.setData("text/plain", `${type},${route}`);
      });
    });

    this.map.getContainer().addEventListener("dragover", function (e) {
      e.preventDefault();
    });

    const map = this.map;
    this.map.getContainer().addEventListener("drop", function (e: any) {
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

  }

  private addMarkers() {
    // TODO: Set up proper reactivity once we fix this mess :)
    // I know how ugly it is but its 1 am and I'm too lazy to fix it
    effect(() => {
      const infras = this.hydroelectricDamnsService.infras();
      infras.forEach((dam: any) => {
        this.addMarker(dam.latitude, dam.longitude, 'hydro', dam);
      });
    });

    effect(() => {
      const infras = this.windFarmsService.infras();
      infras.forEach((farm: any) => {
        this.addMarker(farm.latitude, farm.longitude, 'eolienneparc', farm);
      });
    });

    effect(() => {
      const infras = this.solarFarmsService.infras();
      infras.forEach((farm: any) => {
        this.addMarker(farm.latitude, farm.longitude, 'solaire', farm);
      });
    });

    effect(() => {
      const infras = this.thermalPowerPlantsService.infras();
      infras.forEach((plant: any) => {
        this.addMarker(plant.latitude, plant.longitude, 'thermique', plant);
      });
    });

    effect(() => {
      const infras = this.nuclearPowerPlantsService.infras();
      infras.forEach((plant: any) => {
        this.addMarker(plant.latitude, plant.longitude, 'nucleaire', plant);
      });
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  addMarker(lat: number, lon: number, type: string, data: any) {
    const icon = this.map_icons[type];

    // Construire le contenu du popup en fonction du type
    let popupContent = `<b>${data.nom}</b><br>Catégorie: ${this.prettyNames[type]}<br>`;

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

    // Ajouter le marqueur à la carte avec le popup
    const marker = L.marker([lat, lon], { icon: icon })
      .addTo(this.map)
      .bindPopup(popupContent);

    this.markers[type][data.id] = marker;
  }
}
