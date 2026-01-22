import L from 'leaflet';

export const map_icons: any = {
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

export const prettyNames: any = {
    eolienneparc: "Parc éolien",
    solaire: "Parc solaire",
    thermique: "Centale thermique",
    nucleaire: "Centrale nucléaire",
    hydro: "Barrage hydroélectrique"
}