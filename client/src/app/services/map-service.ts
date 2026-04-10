import { Injectable, NgZone, effect, signal } from '@angular/core';
import * as L from 'leaflet';
import 'leaflet.markercluster';
import { map_icons, prettyNames } from '@app/utils/map-utils';
import { createClusterIcon } from '@app/utils/cluster-icon';
import { InfrastruturesService } from './infrastrutures-service';
import { MapLineService } from './map-line-service';
import { ProtectedAreasService } from './protected-areas-service';
import { InfraDetailService } from './infra-detail-service';

const types = ['hydro', 'eolienneparc', 'solaire', 'thermique', 'nucleaire'];

// Water color on the CartoDB light basemap
const WATER_COLOR = { r: 212, g: 218, b: 220 }; // #d4dadc
const WATER_COLOR_TOLERANCE = 12;

// Types that are NOT allowed on water
const WATER_BLOCKED_TYPES: Record<string, string> = {
  'thermique': 'centrales thermiques',
  'solaire': 'parcs solaires',
  'nucleaire': 'centrales nucléaires',
};

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

  // Filter Signals
  mapFilterName = signal('');
  mapFilterTypes = signal<Set<string>>(new Set(types));
  mapFilterMinPower = signal<number | null>(null);
  mapFilterMaxPower = signal<number | null>(null);

  private previousSelectedType: string | null = null;
  private previousSelectedId: string | null = null;

  constructor(
    private infrasService: InfrastruturesService,
    private mapLineService: MapLineService,
    private protectedAreasService: ProtectedAreasService,
    private infraDetailService: InfraDetailService,
    private ngZone: NgZone
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

    // Auto-reload markers when any filter changes
    effect(() => {
      this.mapFilterName();
      this.mapFilterTypes();
      this.mapFilterMinPower();
      this.mapFilterMaxPower();
      this.reloadMarkers();
    });

    // Watch for selected infra changes to highlight the marker in blue
    effect(() => {
      const selected = this.infraDetailService.selectedInfra();

      // Restore previously selected marker to its normal icon
      if (this.previousSelectedType && this.previousSelectedId) {
        const prevMarker = this.markers[this.previousSelectedType]?.[parseInt(this.previousSelectedId)];
        if (prevMarker) {
          const isActive = this.infrasService.isInfraSelected(this.previousSelectedType, this.previousSelectedId);
          const iconName = !isActive ? `${this.previousSelectedType}gris` : this.previousSelectedType;
          prevMarker.setIcon(map_icons[iconName]);
          (prevMarker.options as any).infraActive = isActive;
          if (this.clusterGroup) {
            this.clusterGroup.refreshClusters();
          }
        }
        this.previousSelectedType = null;
        this.previousSelectedId = null;
      }

      // Highlight the newly selected marker in blue
      if (selected) {
        const marker = this.markers[selected.type]?.[parseInt(selected.id)];
        if (marker) {
          marker.setIcon(map_icons[`${selected.type}bleu`]);
          if (this.clusterGroup) {
            this.clusterGroup.refreshClusters();
          }
          this.previousSelectedType = selected.type;
          this.previousSelectedId = selected.id;
        }
      }
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
      crossOrigin: 'anonymous',
    } as any).addTo(map);

    var bounds: L.LatLngBoundsExpression = [
      [40.0, -90.0],
      [65.0, -50.0]
    ];
    map.setMaxBounds(bounds);

    map.getContainer().addEventListener("dragover", function (e) {
      e.preventDefault();
    });

    const infrasService = this.infrasService;
    const self = this;
    map.getContainer().addEventListener("drop", function (e: any) {
      e.preventDefault();
      const [className, type] = e.dataTransfer.getData("text/plain").split(",");

      const mapPos = map.getContainer().getBoundingClientRect();
      const x = e.clientX - mapPos.left;
      const y = e.clientY - mapPos.top;

      if (type === 'hydro') {
        return;
      }

      // Check if drop is on water and type is blocked
      const isOnWater = self.isPixelWater(map, x, y);
      const blockedLabel = WATER_BLOCKED_TYPES[type];

      if (isOnWater && blockedLabel) {
        self.showWaterBlockedToast(`Impossible d'ajouter des ${blockedLabel} dans une zone d'eau.`);
        return;
      }

      const latlng = map.containerPointToLatLng([x, y]);

      const lat = parseFloat(latlng.lat.toFixed(6));
      const lng = parseFloat(latlng.lng.toFixed(6));

      infrasService.createInfra(className, type, lat, lng);
    });

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

    const searchTerm = this.mapFilterName().trim().toLowerCase();
    const allowedTypes = this.mapFilterTypes();
    const minPower = this.mapFilterMinPower();
    const maxPower = this.mapFilterMaxPower();

    types.forEach(type => {
      if (!allowedTypes.has(type)) return;

      let infras = this.infrasService.getInfrasSignalByType(type)();

      // Apply Name filter
      if (searchTerm) {
        infras = infras.filter(i => (i.nom || '').toLowerCase().includes(searchTerm));
      }

      // Apply Power filters
      if (minPower !== null || maxPower !== null) {
        infras = infras.filter(i => {
          const p = (i as any).puissance_nominal;
          if (typeof p !== 'number') return true; // fallback if missing
          if (minPower !== null && p < minPower) return false;
          if (maxPower !== null && p > maxPower) return false;
          return true;
        });
      }

      this.addMarkers(type, infras);
    });
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

  /**
   * Check if a pixel on the map corresponds to water by reading the tile color.
   */
  private isPixelWater(map: L.Map, containerX: number, containerY: number): boolean {
    try {
      const container = map.getContainer();
      const tilePane = container.querySelector('.leaflet-tile-pane') as HTMLElement;
      if (!tilePane) return false;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;

      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;

      // Get all visible tile images
      const tileImages = tilePane.querySelectorAll('img.leaflet-tile') as NodeListOf<HTMLImageElement>;

      for (const img of Array.from(tileImages)) {
        if (!img.complete || img.naturalWidth === 0) continue;

        // Get the tile's rendered position relative to the container
        const imgRect = img.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        const dx = imgRect.left - containerRect.left;
        const dy = imgRect.top - containerRect.top;

        try {
          ctx.drawImage(img, dx, dy, imgRect.width, imgRect.height);
        } catch {
          // CORS or other drawing errors — skip this tile
        }
      }

      const pixel = ctx.getImageData(containerX, containerY, 1, 1).data;
      const [r, g, b] = [pixel[0], pixel[1], pixel[2]];

      const dr = Math.abs(r - WATER_COLOR.r);
      const dg = Math.abs(g - WATER_COLOR.g);
      const db = Math.abs(b - WATER_COLOR.b);

      return dr <= WATER_COLOR_TOLERANCE && dg <= WATER_COLOR_TOLERANCE && db <= WATER_COLOR_TOLERANCE;
    } catch {
      return false;
    }
  }

  /**
   * Show a temporary toast notification on the map.
   */
  private showWaterBlockedToast(message: string): void {
    // Remove any existing toast
    const existing = document.querySelector('.hq-water-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'hq-water-toast';
    toast.innerHTML = `
      <span>${message}</span>
    `;

    document.body.appendChild(toast);

    // trigger enter animation
    requestAnimationFrame(() => {
      toast.classList.add('hq-water-toast--visible');
    });

    setTimeout(() => {
      toast.classList.remove('hq-water-toast--visible');
      toast.classList.add('hq-water-toast--exit');
      toast.addEventListener('transitionend', () => toast.remove());
      // fallback removal
      setTimeout(() => toast.remove(), 600);
    }, 3500);
  }
}
