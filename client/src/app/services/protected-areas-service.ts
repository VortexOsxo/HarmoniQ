import { Injectable, signal, computed } from '@angular/core';
import * as L from 'leaflet';
import { LayerNode, LAYER_TREE, ALL_LAYER_IDS, DEFAULT_SELECTED_LAYERS, buildIdentifyHtml, LAYER_NODE_MAP } from './protected-areas-utils';

@Injectable({
    providedIn: 'root',
})
export class ProtectedAreasService {
    private readonly MAP_SERVER_URL = 'https://geo.environnement.gouv.qc.ca/donnees/rest/services/Biodiversite/Aires_protegees/MapServer';
    readonly layerTree = LAYER_TREE;


    legendOpen = signal(false);
    selectedLayers = signal<Set<number>>(new Set(DEFAULT_SELECTED_LAYERS));
    hasSelection = computed(() => this.selectedLayers().size > 0);
    private lastSelection: Set<number> = new Set(ALL_LAYER_IDS);

    private tileLayers: L.TileLayer[] = [];
    private map?: L.Map;
    private clickHandler?: (e: L.LeafletMouseEvent) => void;

    initLayer(map: L.Map): void {
        this.map = map;
        this.registerClickHandler();
        this.rebuildTileLayer();
    }

    private rebuildTileLayer(): void {
        if (!this.map) return;

        if (this.tileLayers.length > 0) {
            this.tileLayers.forEach(layer => this.map!.removeLayer(layer));
            this.tileLayers = [];
        }

        const selected = this.selectedLayers();
        if (selected.size === 0) return;

        const serverGroups = new Map<string, number[]>();

        for (const id of selected) {
            const node = LAYER_NODE_MAP.get(id);
            const url = node?.mapServerUrl || this.MAP_SERVER_URL;
            if (!serverGroups.has(url)) serverGroups.set(url, []);
            serverGroups.get(url)!.push(id);
        }

        for (const [url, ids] of serverGroups.entries()) {
            const tiledLayer = L.tileLayer('');

            tiledLayer.getTileUrl = (coords: L.Coords) => {
                const tileSize = 256;
                const nwPoint = coords.scaleBy(new L.Point(tileSize, tileSize));
                const sePoint = nwPoint.add(new L.Point(tileSize, tileSize));

                const nw = this.map!.unproject(nwPoint, coords.z);
                const se = this.map!.unproject(sePoint, coords.z);

                const nwMerc = this.latLngToWebMercator(nw);
                const seMerc = this.latLngToWebMercator(se);

                const bbox = `${nwMerc.x},${seMerc.y},${seMerc.x},${nwMerc.y}`;

                const isAuto = url.includes('STF_WMS');
                const zoom = this.map!.getZoom();

                const actualServerIds: { id: number, serverId: number, color?: number[] }[] = [];
                ids.forEach(id => {
                    const node = LAYER_NODE_MAP.get(id);
                    if (node?.serverLayerIds) {
                        node.serverLayerIds.forEach(sid => {
                            actualServerIds.push({ id, serverId: sid, color: node.color });
                        });
                    } else {
                        actualServerIds.push({ id, serverId: node?.serverLayerId !== undefined ? node.serverLayerId : id, color: node?.color });
                    }
                });

                const dynamicLayers = actualServerIds.map(item => {
                    let drawingInfo: any = { showLabels: false };

                    if (item.color) {
                        drawingInfo = {
                            showLabels: false,
                            renderer: {
                                type: "simple",
                                symbol: {
                                    type: "esriSFS",
                                    style: "esriSFSSolid",
                                    color: item.color,
                                    outline: {
                                        type: "esriSLS",
                                        style: "esriSLSSolid",
                                        color: item.color.map((c, i) => i === 3 ? 255 : Math.max(0, c - 50)),
                                        width: 1
                                    }
                                }
                            }
                        };
                    }
                    return {
                        id: item.serverId,
                        source: { type: 'mapLayer', mapLayerId: item.serverId },
                        drawingInfo: drawingInfo
                    };
                });

                const layerIds = actualServerIds.map(i => i.serverId).sort((a, b) => a - b).join(',');

                const layerDefsObj: Record<number, string> = {};
                actualServerIds.forEach(item => {
                    const node = LAYER_NODE_MAP.get(item.id);
                    if (node?.layerDef) {
                        layerDefsObj[item.serverId] = node.layerDef;
                    }
                });
                const layerDefsParam = Object.keys(layerDefsObj).length > 0 ? `&layerDefs=${encodeURIComponent(JSON.stringify(layerDefsObj))}` : '';

                const useDynamicLayers = url === this.MAP_SERVER_URL;
                const dynamicLayersParam = useDynamicLayers
                    ? `&dynamicLayers=${encodeURIComponent(JSON.stringify(dynamicLayers))}`
                    : '';

                const reqDpi = isAuto && zoom < 10 ? 5 : 96;

                const finalUrl = `${url}/export?` +
                    `dpi=${reqDpi}&transparent=true&format=png32&` +
                    `layers=show:${layerIds}` +
                    dynamicLayersParam +
                    `&bbox=${bbox}&` +
                    `bboxSR=3857&imageSR=3857&` +
                    `size=${tileSize},${tileSize}&f=image` + layerDefsParam;

                return finalUrl;
            };
            tiledLayer.addTo(this.map);
            this.tileLayers.push(tiledLayer);
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
        if (this.hasSelection()) {
            this.lastSelection = new Set(this.selectedLayers());
            this.deselectAll();
        } else {
            if (!this.lastSelection || this.lastSelection.size === 0) {
                this.selectAll();
            } else {
                this.selectedLayers.set(new Set(this.lastSelection));
                this.rebuildTileLayer();
            }
        }
    }

    show(): void {
        if (this.hasSelection()) return;
        this.selectAll();
    }

    hide(): void {
        this.deselectAll();
    }

    private registerClickHandler(): void {
        if (!this.map || this.clickHandler) return;

        this.clickHandler = (e: L.LeafletMouseEvent) => {
            if (!this.map || !this.hasSelection()) return;
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

        const point = this.map.latLngToContainerPoint(latlng);
        const size = this.map.getSize();
        const bounds = this.map.getBounds();

        const sw = this.latLngToWebMercator(bounds.getSouthWest());
        const ne = this.latLngToWebMercator(bounds.getNorthEast());
        const envelope = `${sw.x},${sw.y},${ne.x},${ne.y}`;

        const serverGroups = new Map<string, number[]>();
        for (const id of selected) {
            const node = LAYER_NODE_MAP.get(id);
            if (!node) continue;
            const url = node.mapServerUrl || this.MAP_SERVER_URL;
            if (!serverGroups.has(url)) serverGroups.set(url, []);

            if (node.serverLayerIds) {
                serverGroups.get(url)!.push(...node.serverLayerIds);
            } else {
                serverGroups.get(url)!.push(node.serverLayerId !== undefined ? node.serverLayerId : id);
            }
        }

        const zoom = this.map.getZoom();
        for (const [url, serverIds] of serverGroups.entries()) {
            const isAuto = url.includes('STF_WMS');
            const reqDpi = isAuto && zoom < 10 ? 5 : 96;

            const layerIds = serverIds.sort((a, b) => a - b).join(',');

            const layerDefsObj: Record<number, string> = {};
            for (const id of selected) {
                const node = LAYER_NODE_MAP.get(id);
                const nodeUrl = node?.mapServerUrl || this.MAP_SERVER_URL;
                if (nodeUrl !== url) continue;
                if (node?.layerDef) {
                    if (node.serverLayerIds) {
                        node.serverLayerIds.forEach(sid => layerDefsObj[sid] = node.layerDef!);
                    } else {
                        layerDefsObj[node.serverLayerId !== undefined ? node.serverLayerId : id] = node.layerDef;
                    }
                }
            }
            const layerDefsParam = Object.keys(layerDefsObj).length > 0 ? `&layerDefs=${encodeURIComponent(JSON.stringify(layerDefsObj))}` : '';

            const reqUrl = `${url}/identify?` +
                `geometry=${this.latLngToWebMercator(latlng).x},${this.latLngToWebMercator(latlng).y}&` +
                `geometryType=esriGeometryPoint&` +
                `sr=3857&` +
                `layers=visible:${layerIds}&` +
                `tolerance=5&` +
                `mapExtent=${envelope}&` +
                `imageDisplay=${size.x},${size.y},${reqDpi}&` +
                `returnGeometry=false&` +
                `f=json` + layerDefsParam;

            try {
                const response = await fetch(reqUrl);
                const data = await response.json();

                if (data.results && data.results.length > 0) {
                    return buildIdentifyHtml(data.results[0].attributes);
                }
            } catch (err) {
                console.error('Protected areas identify failed:', err);
            }
        }
        return null;
    }

    private protectedAreaDetailsCache = new Map<string, Promise<{ name: string, categoryId: number } | null>>();

    checkProtectedArea(lat: number, lng: number): Promise<string | null> {
        return this.checkProtectedAreaWithDetails(lat, lng).then(res => res ? res.name : null);
    }

    checkProtectedAreaWithDetails(lat: number, lng: number): Promise<{ name: string, categoryId: number } | null> {
        const cacheKey = `${lat},${lng}`;
        if (this.protectedAreaDetailsCache.has(cacheKey)) {
            return this.protectedAreaDetailsCache.get(cacheKey)!;
        }
        const promise = this.fetchProtectedAreaWithDetails(lat, lng);
        this.protectedAreaDetailsCache.set(cacheKey, promise);
        return promise;
    }

    private async fetchProtectedAreaWithDetails(lat: number, lng: number): Promise<{ name: string, categoryId: number } | null> {
        const R = 6378137;
        const x = R * lng * Math.PI / 180;
        const y = R * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));

        const delta = 100;
        const imgSize = 256;
        const envelope = `${x - delta},${y - delta},${x + delta},${y + delta}`;

        const serverGroups = new Map<string, number[]>();
        for (const id of ALL_LAYER_IDS) {
            const node = LAYER_NODE_MAP.get(id);
            if (!node) continue;
            const url = node.mapServerUrl || this.MAP_SERVER_URL;
            if (!serverGroups.has(url)) serverGroups.set(url, []);

            if (node.serverLayerIds) {
                serverGroups.get(url)!.push(...node.serverLayerIds);
            } else {
                serverGroups.get(url)!.push(node.serverLayerId !== undefined ? node.serverLayerId : id);
            }
        }

        for (const [url, serverIds] of serverGroups.entries()) {
            const layerIds = serverIds.sort((a, b) => a - b).join(',');

            const layerDefsObj: Record<number, string> = {};
            for (const id of ALL_LAYER_IDS) {
                const node = LAYER_NODE_MAP.get(id);
                const nodeUrl = node?.mapServerUrl || this.MAP_SERVER_URL;
                if (nodeUrl !== url) continue;
                if (node?.layerDef) {
                    if (node.serverLayerIds) {
                        node.serverLayerIds.forEach(sid => layerDefsObj[sid] = node.layerDef!);
                    } else {
                        layerDefsObj[node.serverLayerId !== undefined ? node.serverLayerId : id] = node.layerDef;
                    }
                }
            }
            const layerDefsParam = Object.keys(layerDefsObj).length > 0 ? `&layerDefs=${encodeURIComponent(JSON.stringify(layerDefsObj))}` : '';

            const reqUrl = `${url}/identify?` +
                `geometry=${x},${y}&` +
                `geometryType=esriGeometryPoint&` +
                `sr=3857&` +
                `layers=all:${layerIds}&` +
                `tolerance=1&` +
                `mapExtent=${envelope}&` +
                `imageDisplay=${imgSize},${imgSize},96&` +
                `returnGeometry=false&` +
                `f=json` + layerDefsParam;

            try {
                const response = await fetch(reqUrl);
                const data = await response.json();
                if (data.results && data.results.length > 0) {
                    const result = data.results[0];
                    const attrs = result.attributes;
                    let title = attrs['Toponyme'] || attrs['TOPONYME'] || attrs['NOM_ID_MGE'] || attrs['Nom_identification'] || attrs['NAME_F'] || attrs['NAME_E'] || attrs['FNAME'] || attrs['Nom de la réserve indienne ou de la terre indienne'];
                    const isAuto = attrs['GEOCODE'] || attrs['Identifiant_unique'] || attrs['DOMANIALIT'] || attrs['Domanialité'] || attrs['NOM_ID_MGE'] || attrs['Nom_identification'];

                    let finalName = title || 'Aire protégée';
                    if (isAuto && title) finalName = `Communauté autochtone de ${title}`;
                    else if (isAuto) finalName = 'Communauté autochtone';

                    let matchedCategoryId = -1;
                    const resultLayerId = result.layerId;
                    for (const id of ALL_LAYER_IDS) {
                        const node = LAYER_NODE_MAP.get(id);
                        if (!node) continue;
                        const nodeUrl = node.mapServerUrl || this.MAP_SERVER_URL;
                        if (nodeUrl !== url) continue;
                        
                        if (node.serverLayerIds && node.serverLayerIds.includes(resultLayerId)) {
                            matchedCategoryId = node.id;
                            break;
                        } else if (node.serverLayerId === resultLayerId || (node.serverLayerId === undefined && id === resultLayerId)) {
                            matchedCategoryId = node.id;
                            break;
                        }
                    }

                    return { name: finalName, categoryId: matchedCategoryId };
                }
            } catch {
            }
        }
        return null;
    }

    destroy(): void {
        this.unregisterClickHandler();
        this.tileLayers.forEach(layer => {
            layer.off('loading');
            layer.off('load');
            if (this.map) this.map.removeLayer(layer);
        });
        this.tileLayers = [];
        this.map = undefined;
        this.legendOpen.set(false);
    }
}
