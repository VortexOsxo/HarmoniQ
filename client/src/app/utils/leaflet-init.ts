import * as L from 'leaflet';

// Fix for Leaflet plugins (like markercluster) to work with Angular's bundling
(window as any).L = L;

export { L };
