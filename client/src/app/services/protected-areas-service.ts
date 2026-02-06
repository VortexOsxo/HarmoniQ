import { Injectable, signal } from '@angular/core';
import * as L from 'leaflet';

@Injectable({
    providedIn: 'root',
})
export class ProtectedAreasService {
    // REST endpoint for protected areas in Quebec
    private readonly MAP_SERVER_URL = 'https://geo.environnement.gouv.qc.ca/donnees/rest/services/Biodiversite/Aires_protegees/MapServer';

    isVisible = signal(false);
    isLoading = signal(false);

    private tiledLayer?: L.TileLayer;
    private map?: L.Map;


    initLayer(map: L.Map): void {
        this.map = map;

        this.tiledLayer = L.tileLayer('');

        this.tiledLayer.getTileUrl = (coords: L.Coords) => {
            const tileSize = 256;
            const nwPoint = coords.scaleBy(new L.Point(tileSize, tileSize));
            const sePoint = nwPoint.add(new L.Point(tileSize, tileSize));

            const nw = map.unproject(nwPoint, coords.z);
            const se = map.unproject(sePoint, coords.z);

            const nwMerc = this.latLngToWebMercator(nw);
            const seMerc = this.latLngToWebMercator(se);

            const bbox = `${nwMerc.x},${seMerc.y},${seMerc.x},${nwMerc.y}`;

            return `${this.MAP_SERVER_URL}/export?` +
                `dpi=96&transparent=true&format=png32&` +
                `layers=show:23&` + // 23 to show all protected areas : TODO Change that later for specific area types
                `bbox=${bbox}&` +
                `bboxSR=3857&imageSR=3857&` +
                `size=${tileSize},${tileSize}&f=image`;
        };

        this.tiledLayer.on('loading', () => this.isLoading.set(true));
        this.tiledLayer.on('load', () => this.isLoading.set(false));
        this.tiledLayer.on('tileerror', (e) => {
            console.error('Tile error:', e);
            this.isLoading.set(false);
        });
    }

    private latLngToWebMercator(latlng: L.LatLng): { x: number; y: number } {
        const R = 6378137;
        const x = R * latlng.lng * Math.PI / 180;
        const y = R * Math.log(Math.tan(Math.PI / 4 + latlng.lat * Math.PI / 360));
        return { x, y };
    }

    toggleVisibility(): void {
        if (!this.tiledLayer || !this.map) return;

        if (this.isVisible()) {
            this.map.removeLayer(this.tiledLayer);
            this.isVisible.set(false);
        } else {
            this.tiledLayer.addTo(this.map);
            this.isVisible.set(true);
        }
    }

    show(): void {
        if (!this.tiledLayer || !this.map || this.isVisible()) return;
        this.tiledLayer.addTo(this.map);
        this.isVisible.set(true);
    }

    hide(): void {
        if (!this.tiledLayer || !this.map || !this.isVisible()) return;
        this.map.removeLayer(this.tiledLayer);
        this.isVisible.set(false);
    }

    destroy(): void {
        if (this.tiledLayer) {
            this.tiledLayer.off('loading');
            this.tiledLayer.off('load');
            this.tiledLayer.off('tileerror');

            if (this.map) {
                this.map.removeLayer(this.tiledLayer);
            }
        }
        this.tiledLayer = undefined;
        this.map = undefined;
        this.isVisible.set(false);
        this.isLoading.set(false);
    }
}
