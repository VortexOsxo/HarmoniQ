import * as L from 'leaflet';

const TYPE_ICON_URLS: Record<string, string> = {
    hydro: '/icons/barrage.png',
    eolienneparc: '/icons/eolienne.png',
    solaire: '/icons/solaire.png',
    thermique: '/icons/thermique.png',
    nucleaire: '/icons/nucelaire.png',
};

const TYPE_ICON_URLS_GRIS: Record<string, string> = {
    hydro: '/icons/barrage_gris.png',
    eolienneparc: '/icons/eolienne_gris.png',
    solaire: '/icons/solaire_gris.png',
    thermique: '/icons/thermique_gris.png',
    nucleaire: '/icons/nucelaire_gris.png',
};

export function createClusterIcon(cluster: any): L.DivIcon {
    const childMarkers = cluster.getAllChildMarkers();

    const counts: Record<string, { active: number; inactive: number }> = {};

    for (const marker of childMarkers) {
        const opts = marker.options as any;
        const type: string = opts.infraType || 'unknown';
        const isActive: boolean = opts.infraActive || false;

        if (!counts[type]) counts[type] = { active: 0, inactive: 0 };
        if (isActive) {
            counts[type].active++;
        } else {
            counts[type].inactive++;
        }
    }

    const typeEntries = Object.entries(counts);

    let iconsHtml = '';
    for (const [type, c] of typeEntries) {
        const total = c.active + c.inactive;
        const iconUrl = c.active >= c.inactive ? TYPE_ICON_URLS[type] : TYPE_ICON_URLS_GRIS[type];

        iconsHtml += `
            <div class="cluster-type-item">
                <img src="${iconUrl}" class="cluster-type-img" />
                <span class="cluster-type-count">${total}</span>
            </div>
        `;
    }

    const html = `<div class="cluster-pill">${iconsHtml}</div>`;

    const width = typeEntries.length * 54 + 24;
    const height = 50;

    return L.divIcon({
        html,
        className: 'cluster-wrapper',
        iconSize: L.point(width, height),
        iconAnchor: L.point(width / 2, height / 2),
    });
}
