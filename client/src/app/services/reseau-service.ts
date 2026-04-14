import { Injectable, signal, computed } from '@angular/core';
import * as L from 'leaflet';
import { environment } from 'environments/environment';
import { InfrastruturesService, PendingInfra } from './infrastrutures-service';

export interface NewConnection {
  fromName: string;
  toDisplayName: string;
  distKm: number;
  lat: number;
  lng: number;
}

interface NetworkNode {
  name: string;
  lat: number;
  lng: number;
}

const NEW_CONNECTION_COLOR = '#27ae60';

export interface ReseauBus {
  id: number;
  name: string;
  display_name: string | null;
  v_nom: number;
  type: string;
  x: number;  // longitude
  y: number;  // latitude
  control: string;
  reseau_type: string | null;
}

export interface ReseauLine {
  id: number;
  name: string;
  bus0: string;
  bus1: string;
  type: string;
  capital_cost: number;
  length: number;
  s_nom: number;
  reseau_type: string | null;
}

export interface ReseauCategory {
  key: string;
  label: string;
  color: string;
}

export const BUS_CATEGORIES: ReseauCategory[] = [
  { key: 'Transport', label: 'Bus - Transport', color: '#4ad97cff' },
  { key: 'Éoliennes', label: 'Bus - Éoliennes', color: '#70b2c1' },
  { key: 'Solaire', label: 'Bus - Solaire', color: '#de8c28' },
  { key: 'Thermique', label: 'Bus - Thermique', color: '#698c77' },
  { key: 'Hydroélectrique', label: 'Bus - Hydroélectrique', color: '#1d6799' },
  { key: 'Consommation', label: 'Bus - Consommation', color: '#8E44AD' },
];

export const LINE_CATEGORIES: ReseauCategory[] = [
  { key: 'Transport', label: 'Lignes - Transport', color: '#4ad97cff' },
  { key: 'Éoliennes', label: 'Lignes - Éoliennes', color: '#70b2c1' },
  { key: 'Solaire', label: 'Lignes - Solaires', color: '#de8c28' },
  { key: 'Thermique', label: 'Lignes - Thermiques', color: '#698c77' },
  { key: 'Hydroélectrique', label: 'Lignes - Hydroélectriques', color: '#1d6799' },
  { key: 'Consommation', label: 'Lignes - Consommation', color: '#8E44AD' },
];

const COLOR_MAP: Record<string, string> = {
  'Transport': '#4ad97cff',
  'Éoliennes': '#70b2c1',
  'Solaire': '#de8c28',
  'Thermique': '#698c77',
  'Hydroélectrique': '#1d6799',
  'Consommation': '#8E44AD',
};

const GREY = '#AAAAAA';

@Injectable({
  providedIn: 'root',
})
export class ReseauService {
  legendOpen = signal(false);

  selectedBusTypes = signal<Set<string>>(new Set());
  selectedLineTypes = signal<Set<string>>(new Set());
  hasSelection = computed(() => this.selectedBusTypes().size > 0 || this.selectedLineTypes().size > 0);

  private lastBusSelection: Set<string> = new Set(BUS_CATEGORIES.map(c => c.key));
  private lastLineSelection: Set<string> = new Set(LINE_CATEGORIES.map(c => c.key));

  pendingInfras = signal<PendingInfra[]>([]);
  newConnections = signal<NewConnection[]>([]);
  summaryOpen = signal(false);
  hasPendingInfras = computed(() => this.pendingInfras().length > 0);

  private map?: L.Map;
  private buses: ReseauBus[] = [];
  private lines: ReseauLine[] = [];
  private busMarkers: L.CircleMarker[] = [];
  private linePolylines: L.Polyline[] = [];
  private newBusMarkers: L.CircleMarker[] = [];
  private newLinePolylines: L.Polyline[] = [];
  private dataLoaded = false;
  private loadPromise?: Promise<void>;

  constructor(private infrasService: InfrastruturesService) {
    this.infrasService.newUserInfra$.subscribe(infra => {
      this.pendingInfras.update(list => [...list, infra]);
    });
    this.infrasService.deletedUserInfraId$.subscribe(id => {
      this.pendingInfras.update(list => list.filter(i => i.id !== id));
      if (!this.hasPendingInfras()) this.clearNewConnections();
    });
  }

  initLayer(map: L.Map): void {
    this.map = map;
    this.loadPromise = this.loadData();
    this.loadPromise.then(() => {
      this.createStaticLayers();
      this.rebuildLayers();
      this._loadExistingUserInfras();
    });
  }

  private _loadExistingUserInfras(): void {
    const types = ['hydro', 'eolienneparc', 'solaire', 'thermique', 'nucleaire'];
    const existing: PendingInfra[] = [];
    for (const type of types) {
      const infras = this.infrasService.getInfrasSignalByType(type)();
      for (const infra of infras) {
        if ((infra as any).isUserCreated) {
          existing.push({ id: infra.id, lat: infra.latitude, lng: infra.longitude, name: infra.nom, type });
        }
      }
    }
    if (existing.length > 0) this.pendingInfras.set(existing);
  }

  connectNewInfras(): void {
    if (!this.map || !this.dataLoaded || !this.hasPendingInfras()) return;
    this._clearGreenLayers();

    const connectedNodes: NetworkNode[] = this.buses.map(b => ({
      name: b.display_name || b.name,
      lat: b.y,
      lng: b.x,
    }));

    const unconnected = [...this.pendingInfras()];
    const connections: NewConnection[] = [];

    while (unconnected.length > 0) {
      let bestDist = Infinity;
      let bestIdx = -1;
      let bestNode: NetworkNode | null = null;

      for (let i = 0; i < unconnected.length; i++) {
        const infra = unconnected[i];
        for (const node of connectedNodes) {
          const dist = this.haversineKm(infra.lat, infra.lng, node.lat, node.lng);
          if (dist < bestDist) { bestDist = dist; bestIdx = i; bestNode = node; }
        }
      }

      if (bestIdx === -1 || !bestNode) break;
      const [infra] = unconnected.splice(bestIdx, 1);
      const nearest = bestNode;
      const minDist = bestDist;

      const busMarker = L.circleMarker([infra.lat, infra.lng], {
        radius: 7, color: NEW_CONNECTION_COLOR, fillColor: NEW_CONNECTION_COLOR, fillOpacity: 0.9, weight: 2, interactive: true,
      }).addTo(this.map!);
      busMarker.bindPopup(`<div style="min-width:160px"><b>${infra.name}</b><br><span style="color:${NEW_CONNECTION_COLOR}">● Nouvelle infrastructure</span><br><b>Type :</b> ${infra.type}</div>`);
      this.newBusMarkers.push(busMarker);

      const line = L.polyline([[infra.lat, infra.lng], [nearest.lat, nearest.lng]],
        { color: NEW_CONNECTION_COLOR, weight: 3, opacity: 0.9, dashArray: '10, 6', interactive: true },
      ).addTo(this.map!);
      line.bindPopup(`<div style="min-width:180px"><b style="color:${NEW_CONNECTION_COLOR}">Nouvelle connexion</b><br><b>De :</b> ${infra.name}<br><b>À :</b> ${nearest.name}<br><b>Distance :</b> ${minDist.toFixed(1)} km</div>`);
      this.newLinePolylines.push(line);

      connections.push({ fromName: infra.name, toDisplayName: nearest.name, distKm: minDist, lat: infra.lat, lng: infra.lng });
      connectedNodes.push({ name: infra.name, lat: infra.lat, lng: infra.lng });
    }

    this.newConnections.set(connections);
    this.summaryOpen.set(true);
  }

  flyToInfra(c: NewConnection): void {
    this.map?.setView([c.lat, c.lng], 9, { animate: true, duration: 0.5 });
  }

  closeSummary(): void { this.summaryOpen.set(false); }

  clearNewConnections(): void {
    this._clearGreenLayers();
    this.newConnections.set([]);
    this.summaryOpen.set(false);
  }

  private _clearGreenLayers(): void {
    if (this.map) {
      for (const m of this.newBusMarkers) this.map.removeLayer(m);
      for (const p of this.newLinePolylines) this.map.removeLayer(p);
    }
    this.newBusMarkers = [];
    this.newLinePolylines = [];
  }

  private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const toRad = (v: number) => v * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private async loadData(): Promise<void> {
    try {
      const [busRes, lineRes] = await Promise.all([
        fetch(`${environment.apiUrl}/bus`),
        fetch(`${environment.apiUrl}/line`),
      ]);
      this.buses = await busRes.json();
      this.lines = await lineRes.json();

      this.busLookup = {};
      for (const bus of this.buses) {
        this.busLookup[bus.name] = bus;
      }

      this.dataLoaded = true;
    } catch (err) {
      console.error('Failed to load réseau data:', err);
    }
  }

  private busLookup: Record<string, ReseauBus> = {};

  toggleVisibility(): void {
    if (this.hasSelection()) {
      this.lastBusSelection = new Set(this.selectedBusTypes());
      this.lastLineSelection = new Set(this.selectedLineTypes());
      this.deselectAll();
      this.legendOpen.set(false);
    } else {
      if (this.lastBusSelection.size === 0 && this.lastLineSelection.size === 0) {
        this.selectAll();
      } else {
        this.selectedBusTypes.set(new Set(this.lastBusSelection));
        this.selectedLineTypes.set(new Set(this.lastLineSelection));
      }
    }
    this.rebuildLayers();
  }

  private createStaticLayers(): void {
    if (!this.map || !this.dataLoaded) return;

    for (const line of this.lines) {
      const busFrom = this.busLookup[line.bus0];
      const busTo = this.busLookup[line.bus1];
      if (!busFrom || !busTo) continue;

      const polyline = L.polyline(
        [[busFrom.y, busFrom.x], [busTo.y, busTo.x]],
        {
          interactive: true,
          pane: 'overlayPane'
        }
      );

      polyline.bindPopup(() => {
        const rt = line.reseau_type || 'Transport';
        return `
          <div style="min-width:180px">
            <b>${line.name}</b><br>
            <b>Type:</b> ${rt}<br>
            <b>De:</b> ${line.bus0}<br>
            <b>À:</b> ${line.bus1}<br>
            <b>Longueur:</b> ${line.length?.toFixed(1) || 'N/A'} km<br>
            <b>Capacité:</b> ${line.s_nom || 'N/A'} MW
          </div>
        `;
      });

      this.linePolylines.push(polyline);
      polyline.addTo(this.map);
    }

    for (const bus of this.buses) {
      const marker = L.circleMarker([bus.y, bus.x], {
        interactive: true,
        weight: 1,
      });

      marker.bindPopup(() => {
        const rt = bus.reseau_type || 'Transport';
        return `
          <div style="min-width:180px">
            <b>${bus.display_name || bus.name}</b><br>
            <b>Type:</b> ${rt}<br>
            <b>Tension:</b> ${bus.v_nom} kV<br>
            <b>Contrôle:</b> ${bus.control}
          </div>
        `;
      });

      this.busMarkers.push(marker);
      marker.addTo(this.map);
    }
  }

  toggleBusType(key: string): void {
    const current = new Set(this.selectedBusTypes());
    if (current.has(key)) current.delete(key);
    else current.add(key);
    this.selectedBusTypes.set(current);
    this.rebuildLayers();
  }

  toggleLineType(key: string): void {
    const current = new Set(this.selectedLineTypes());
    if (current.has(key)) current.delete(key);
    else current.add(key);
    this.selectedLineTypes.set(current);
    this.rebuildLayers();
  }

  isBusTypeSelected(key: string): boolean {
    return this.selectedBusTypes().has(key);
  }

  isLineTypeSelected(key: string): boolean {
    return this.selectedLineTypes().has(key);
  }

  selectAll(): void {
    this.selectedBusTypes.set(new Set(BUS_CATEGORIES.map(c => c.key)));
    this.selectedLineTypes.set(new Set(LINE_CATEGORIES.map(c => c.key)));
    this.rebuildLayers();
  }

  deselectAll(): void {
    this.selectedBusTypes.set(new Set());
    this.selectedLineTypes.set(new Set());
    this.rebuildLayers();
  }

  isBusGroupSelected(): boolean {
    return BUS_CATEGORIES.every(cat => this.selectedBusTypes().has(cat.key));
  }

  toggleBusGroup(): void {
    const allSelected = this.isBusGroupSelected();
    if (allSelected) {
      this.selectedBusTypes.set(new Set());
    } else {
      this.selectedBusTypes.set(new Set(BUS_CATEGORIES.map(c => c.key)));
    }
    this.rebuildLayers();
  }

  isLineGroupSelected(): boolean {
    return LINE_CATEGORIES.every(cat => this.selectedLineTypes().has(cat.key));
  }

  toggleLineGroup(): void {
    const allSelected = this.isLineGroupSelected();
    if (allSelected) {
      this.selectedLineTypes.set(new Set());
    } else {
      this.selectedLineTypes.set(new Set(LINE_CATEGORIES.map(c => c.key)));
    }
    this.rebuildLayers();
  }

  rebuildLayers(): void {
    if (!this.map || !this.dataLoaded) return;

    const highlight = true; // Any selection is highlighted
    const selectedBus = this.selectedBusTypes();
    const selectedLine = this.selectedLineTypes();

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const poly = this.linePolylines[i];
      if (!poly) continue;

      const rt = line.reseau_type || 'Transport';
      const isTypeShown = selectedLine.has(rt);

      if (!isTypeShown) {
        poly.setStyle({ opacity: 0, fillOpacity: 0, interactive: false });
        continue;
      }

      const color = highlight ? (COLOR_MAP[rt] || GREY) : GREY;
      const opacity = highlight ? 0.8 : 0.4;
      const weight = highlight ? 2.5 : 1.5;

      poly.setStyle({
        color: color,
        opacity: opacity,
        weight: weight,
        interactive: true
      });
    }

    for (let i = 0; i < this.buses.length; i++) {
      const bus = this.buses[i];
      const marker = this.busMarkers[i];
      if (!marker) continue;

      const rt = bus.reseau_type || 'Transport';
      const isTypeShown = selectedBus.has(rt);

      if (!isTypeShown) {
        marker.setStyle({ opacity: 0, fillOpacity: 0, interactive: false });
        continue;
      }

      const color = highlight ? (COLOR_MAP[rt] || GREY) : GREY;
      const opacity = highlight ? 0.9 : 0.5;
      const radius = highlight ? 4.5 : 3;

      marker.setStyle({
        color: color,
        fillColor: color,
        fillOpacity: opacity,
        radius: radius,
        opacity: opacity,
        interactive: true
      });
    }
  }

  destroy(): void {
    if (this.map) {
      for (const m of this.busMarkers) this.map.removeLayer(m);
      for (const p of this.linePolylines) this.map.removeLayer(p);
      for (const m of this.newBusMarkers) this.map.removeLayer(m);
      for (const p of this.newLinePolylines) this.map.removeLayer(p);
    }
    this.busMarkers = [];
    this.linePolylines = [];
    this.newBusMarkers = [];
    this.newLinePolylines = [];
    this.map = undefined;
    this.legendOpen.set(false);
  }
}
