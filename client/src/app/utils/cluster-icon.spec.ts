vi.mock('leaflet', () => ({
    default: {
        divIcon: vi.fn().mockReturnValue({ options: {} }),
        point: vi.fn((x: number, y: number) => ({ x, y })),
        icon: vi.fn().mockReturnValue({}),
        map: vi.fn().mockReturnValue({}),
        circleMarker: vi.fn().mockReturnValue({ bindPopup: vi.fn().mockReturnThis(), addTo: vi.fn().mockReturnThis(), setStyle: vi.fn().mockReturnThis() }),
        polyline: vi.fn().mockReturnValue({ bindPopup: vi.fn().mockReturnThis(), addTo: vi.fn().mockReturnThis(), setStyle: vi.fn().mockReturnThis() }),
    },
    divIcon: vi.fn().mockReturnValue({ options: {} }),
    point: vi.fn((x: number, y: number) => ({ x, y })),
    icon: vi.fn().mockReturnValue({}),
    map: vi.fn().mockReturnValue({}),
    circleMarker: vi.fn().mockReturnValue({ bindPopup: vi.fn().mockReturnThis(), addTo: vi.fn().mockReturnThis(), setStyle: vi.fn().mockReturnThis() }),
    polyline: vi.fn().mockReturnValue({ bindPopup: vi.fn().mockReturnThis(), addTo: vi.fn().mockReturnThis(), setStyle: vi.fn().mockReturnThis() }),
}));

import { createClusterIcon } from './cluster-icon';
import * as L from 'leaflet';

function makeCluster(markers: { infraType: string; infraActive: boolean }[]) {
    return {
        getAllChildMarkers: () =>
            markers.map((m) => ({
                options: { infraType: m.infraType, infraActive: m.infraActive },
            })),
    };
}

describe('createClusterIcon', () => {
    afterEach(() => vi.clearAllMocks());

    it('should call L.divIcon to create an icon', () => {
        const cluster = makeCluster([{ infraType: 'hydro', infraActive: true }]);
        createClusterIcon(cluster);
        expect(L.divIcon).toHaveBeenCalled();
    });

    it('should include the cluster-pill wrapper in the HTML', () => {
        const cluster = makeCluster([{ infraType: 'hydro', infraActive: true }]);
        createClusterIcon(cluster);
        const html = (L.divIcon as any).mock.calls[0][0].html;
        expect(html).toContain('cluster-pill');
    });

    it('should show the total count of markers per type', () => {
        const cluster = makeCluster([
            { infraType: 'hydro', infraActive: true },
            { infraType: 'hydro', infraActive: false },
        ]);
        createClusterIcon(cluster);
        const html = (L.divIcon as any).mock.calls[0][0].html;
        expect(html).toContain('2');
    });

    it('should show the active icon URL when active >= inactive', () => {
        const cluster = makeCluster([
            { infraType: 'hydro', infraActive: true },
            { infraType: 'hydro', infraActive: true },
            { infraType: 'hydro', infraActive: false },
        ]);
        createClusterIcon(cluster);
        const html = (L.divIcon as any).mock.calls[0][0].html;
        expect(html).toContain('/icons/barrage.png');
    });

    it('should show the grey icon URL when inactive > active', () => {
        const cluster = makeCluster([
            { infraType: 'hydro', infraActive: false },
            { infraType: 'hydro', infraActive: false },
            { infraType: 'hydro', infraActive: true },
        ]);
        createClusterIcon(cluster);
        const html = (L.divIcon as any).mock.calls[0][0].html;
        expect(html).toContain('/icons/barrage_gris.png');
    });

    it('should handle multiple infrastructure types in the same cluster', () => {
        const cluster = makeCluster([
            { infraType: 'hydro', infraActive: true },
            { infraType: 'solaire', infraActive: true },
            { infraType: 'eolienneparc', infraActive: false },
        ]);
        createClusterIcon(cluster);
        const html = (L.divIcon as any).mock.calls[0][0].html;
        expect(html).toContain('/icons/barrage.png');
        expect(html).toContain('/icons/solaire.png');
        expect(html).toContain('/icons/eolienne_gris.png');
    });

    it('should place types into two rows when there are more than 4 types', () => {
        const cluster = makeCluster([
            { infraType: 'hydro', infraActive: true },
            { infraType: 'solaire', infraActive: true },
            { infraType: 'eolienneparc', infraActive: true },
            { infraType: 'thermique', infraActive: true },
            { infraType: 'nucleaire', infraActive: true },
        ]);
        createClusterIcon(cluster);
        const html = (L.divIcon as any).mock.calls[0][0].html;
        const rowCount = (html.match(/cluster-row/g) || []).length;
        expect(rowCount).toBe(2);
    });

    it('should put all types in a single row when 4 or fewer types', () => {
        const cluster = makeCluster([
            { infraType: 'hydro', infraActive: true },
            { infraType: 'solaire', infraActive: true },
            { infraType: 'eolienneparc', infraActive: true },
        ]);
        createClusterIcon(cluster);
        const html = (L.divIcon as any).mock.calls[0][0].html;
        const rowCount = (html.match(/cluster-row/g) || []).length;
        expect(rowCount).toBe(1);
    });

    it('should call L.point for iconSize and iconAnchor', () => {
        const cluster = makeCluster([{ infraType: 'hydro', infraActive: true }]);
        createClusterIcon(cluster);
        expect(L.point).toHaveBeenCalledTimes(2);
    });
});
