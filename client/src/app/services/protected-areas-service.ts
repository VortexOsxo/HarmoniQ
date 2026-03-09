import { Injectable, signal } from '@angular/core';
import * as L from 'leaflet';
import { LayerNode, LAYER_TREE, ALL_LAYER_IDS, DEFAULT_SELECTED_LAYERS, buildIdentifyHtml } from './protected-areas-utils';

@Injectable({
    providedIn: 'root',
})
export class ProtectedAreasService {
    private readonly MAP_SERVER_URL = 'https://geo.environnement.gouv.qc.ca/donnees/rest/services/Biodiversite/Aires_protegees/MapServer';
    readonly layerTree = LAYER_TREE;

    isVisible = signal(false);
    legendOpen = signal(false);
    selectedLayers = signal<Set<number>>(new Set(DEFAULT_SELECTED_LAYERS));

    private tiledLayer?: L.TileLayer;
    private map?: L.Map;
    private clickHandler?: (e: L.LeafletMouseEvent) => void;

    initLayer(map: L.Map): void {
        this.map = map;
        this.rebuildTileLayer();
    }

    private rebuildTileLayer(): void {
        if (!this.map) return;

        if (this.tiledLayer) {
            this.map.removeLayer(this.tiledLayer);
            this.tiledLayer = undefined;
        }

        const selected = this.selectedLayers();
        if (selected.size === 0) return;

        const layerIds = Array.from(selected).sort((a, b) => a - b).join(',');

        this.tiledLayer = L.tileLayer('');

        this.tiledLayer.getTileUrl = (coords: L.Coords) => {
            const tileSize = 256;
            const nwPoint = coords.scaleBy(new L.Point(tileSize, tileSize));
            const sePoint = nwPoint.add(new L.Point(tileSize, tileSize));

            const nw = this.map!.unproject(nwPoint, coords.z);
            const se = this.map!.unproject(sePoint, coords.z);

            const nwMerc = this.latLngToWebMercator(nw);
            const seMerc = this.latLngToWebMercator(se);

            const bbox = `${nwMerc.x},${seMerc.y},${seMerc.x},${nwMerc.y}`;

            const dynamicLayers = Array.from(selected).map(id => ({
                id,
                source: { type: 'mapLayer', mapLayerId: id },
                drawingInfo: { showLabels: false }, // enlever si on veux montrer le nom des territoires quand on zoom
            }));

            return `${this.MAP_SERVER_URL}/export?` +
                `dpi=96&transparent=true&format=png32&` +
                `layers=show:${layerIds}&` +
                `dynamicLayers=${encodeURIComponent(JSON.stringify(dynamicLayers))}&` +
                `bbox=${bbox}&` +
                `bboxSR=3857&imageSR=3857&` +
                `size=${tileSize},${tileSize}&f=image`;
        };

        if (this.isVisible()) {
            this.tiledLayer.addTo(this.map);
        }
    }

    private latLngToWebMercator(latlng: L.LatLng): { x: number; y: number } {
        const R = 6378137;
        const x = R * latlng.lng * Math.PI / 180;
        const y = R * Math.log(Math.tan(Math.PI / 4 + latlng.lat * Math.PI / 360));
        return { x, y };
    }

    private getDescendantIds(node: LayerNode): number[] {
        const ids: number[] = [];
        if (node.children) {
            for (const child of node.children) {
                ids.push(child.id);
                ids.push(...this.getDescendantIds(child));
            }
        }
        return ids;
    }

    private buildParentMap(nodes: LayerNode[], parent?: LayerNode): Map<number, number> {
        const map = new Map<number, number>();
        for (const node of nodes) {
            if (parent) map.set(node.id, parent.id);
            if (node.children) {
                for (const [k, v] of this.buildParentMap(node.children, node)) {
                    map.set(k, v);
                }
            }
        }
        return map;
    }

    private readonly parentMap = this.buildParentMap(LAYER_TREE);

    private getAncestorIds(id: number): number[] {
        const ancestors: number[] = [];
        let current = this.parentMap.get(id);
        while (current !== undefined) {
            ancestors.push(current);
            current = this.parentMap.get(current);
        }
        return ancestors;
    }

    toggleNode(node: LayerNode): void {
        const current = new Set(this.selectedLayers());
        const allIds = [node.id, ...this.getDescendantIds(node)];

        if (this.isGroupFullySelected(node)) {
            for (const id of allIds) current.delete(id);
            for (const id of this.getAncestorIds(node.id)) current.delete(id);
        } else {
            for (const id of allIds) current.add(id);
        }

        this.selectedLayers.set(current);
        this.map?.closePopup();
        this.rebuildTileLayer();
    }

    isLayerSelected(id: number): boolean {
        return this.selectedLayers().has(id);
    }

    isGroupFullySelected(node: LayerNode): boolean {
        const selected = this.selectedLayers();
        if (!selected.has(node.id)) return false;
        if (!node.children) return selected.has(node.id);
        return node.children.every(child => this.isGroupFullySelected(child));
    }

    isGroupPartiallySelected(node: LayerNode): boolean {
        if (!node.children) return false;
        const allIds = [node.id, ...this.getDescendantIds(node)];
        const selected = this.selectedLayers();
        const selectedCount = allIds.filter(id => selected.has(id)).length;
        return selectedCount > 0 && selectedCount < allIds.length;
    }

    selectAll(): void {
        this.selectedLayers.set(new Set(ALL_LAYER_IDS));
        this.rebuildTileLayer();
    }

    deselectAll(): void {
        this.selectedLayers.set(new Set());
        this.map?.closePopup();
        this.rebuildTileLayer();
    }

    toggleVisibility(): void {
        if (!this.tiledLayer || !this.map) {
            this.rebuildTileLayer();
        }

        if (this.isVisible()) {
            if (this.tiledLayer && this.map) {
                this.map.removeLayer(this.tiledLayer);
            }
            this.map?.closePopup();
            this.isVisible.set(false);
            this.legendOpen.set(false);
            this.unregisterClickHandler();
        } else {
            if (this.tiledLayer && this.map) {
                this.tiledLayer.addTo(this.map);
            }
            this.isVisible.set(true);
            this.legendOpen.set(true);
            this.registerClickHandler();
        }
    }

    show(): void {
        if (!this.tiledLayer || !this.map || this.isVisible()) return;
        this.tiledLayer.addTo(this.map);
        this.isVisible.set(true);
        this.registerClickHandler();
    }

    hide(): void {
        if (!this.tiledLayer || !this.map || !this.isVisible()) return;
        this.map.removeLayer(this.tiledLayer);
        this.isVisible.set(false);
        this.legendOpen.set(false);
        this.unregisterClickHandler();
    }

    private registerClickHandler(): void {
        if (!this.map || this.clickHandler) return;

        this.clickHandler = (e: L.LeafletMouseEvent) => {
            if (!this.map || !this.isVisible()) return;
            if (this.map.getZoom() < 6) return;

            this.identify(e.latlng).then(html => {
                if (html && this.map) {
                    L.popup()
                        .setLatLng(e.latlng)
                        .setContent(html)
                        .openOn(this.map);
                }
            });
        };

        this.map.on('click', this.clickHandler);
    }

    private unregisterClickHandler(): void {
        if (this.map && this.clickHandler) {
            this.map.off('click', this.clickHandler);
            this.clickHandler = undefined;
        }
    }

    async identify(latlng: L.LatLng): Promise<string | null> {
        if (!this.map) return null;

        const selected = this.selectedLayers();
        if (selected.size === 0) return null;

        const layerIds = Array.from(selected).sort((a, b) => a - b).join(',');
        const point = this.map.latLngToContainerPoint(latlng);
        const size = this.map.getSize();
        const bounds = this.map.getBounds();

        const sw = this.latLngToWebMercator(bounds.getSouthWest());
        const ne = this.latLngToWebMercator(bounds.getNorthEast());
        const envelope = `${sw.x},${sw.y},${ne.x},${ne.y}`;

        const url = `${this.MAP_SERVER_URL}/identify?` +
            `geometry=${this.latLngToWebMercator(latlng).x},${this.latLngToWebMercator(latlng).y}&` +
            `geometryType=esriGeometryPoint&` +
            `sr=3857&` +
            `layers=visible:${layerIds}&` +
            `tolerance=5&` +
            `mapExtent=${envelope}&` +
            `imageDisplay=${size.x},${size.y},96&` +
            `returnGeometry=false&` +
            `f=json`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (!data.results || data.results.length === 0) return null;

            const result = data.results[0];
            return buildIdentifyHtml(result.attributes);
        } catch (err) {
            console.error('Protected areas identify failed:', err);
            return null;
        }
    }

    private protectedAreaCache = new Map<string, Promise<string | null>>();

    checkProtectedArea(lat: number, lng: number): Promise<string | null> {
        const cacheKey = `${lat},${lng}`;
        if (this.protectedAreaCache.has(cacheKey)) {
            return this.protectedAreaCache.get(cacheKey)!;
        }
        const promise = this.fetchProtectedArea(lat, lng);
        this.protectedAreaCache.set(cacheKey, promise);
        return promise;
    }

    private async fetchProtectedArea(lat: number, lng: number): Promise<string | null> {
        const R = 6378137;
        const x = R * lng * Math.PI / 180;
        const y = R * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));

        const delta = 100;
        const imgSize = 256;
        const envelope = `${x - delta},${y - delta},${x + delta},${y + delta}`;

        const allIds = ALL_LAYER_IDS.join(',');

        const url = `${this.MAP_SERVER_URL}/identify?` +
            `geometry=${x},${y}&` +
            `geometryType=esriGeometryPoint&` +
            `sr=3857&` +
            `layers=all:${allIds}&` +
            `tolerance=1&` +
            `mapExtent=${envelope}&` +
            `imageDisplay=${imgSize},${imgSize},96&` +
            `returnGeometry=false&` +
            `f=json`;

        try {
            const response = await fetch(url);
            const data = await response.json();
            if (!data.results || data.results.length === 0) return null;

            const attrs = data.results[0].attributes;
            return attrs['Toponyme'] || attrs['TOPONYME'] || 'Aire protégée';
        } catch {
            return null;
        }
    }

    destroy(): void {
        this.unregisterClickHandler();
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
        this.legendOpen.set(false);
    }
}
