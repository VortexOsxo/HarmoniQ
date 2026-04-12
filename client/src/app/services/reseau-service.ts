import { Injectable, signal, computed } from '@angular/core';
import * as L from 'leaflet';
import { environment } from 'environments/environment';

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

  private map?: L.Map;
  private buses: ReseauBus[] = [];
  private lines: ReseauLine[] = [];
  private busMarkers: L.CircleMarker[] = [];
  private linePolylines: L.Polyline[] = [];
  private dataLoaded = false;
  private loadPromise?: Promise<void>;

  initLayer(map: L.Map): void {
    this.map = map;
    this.loadPromise = this.loadData();
    this.loadPromise.then(() => {
      this.createStaticLayers();
      this.rebuildLayers();
    });
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
    }
    this.busMarkers = [];
    this.linePolylines = [];
    this.map = undefined;
    this.legendOpen.set(false);
  }
}
