export interface LayerNode {
    id: number;
    name: string;
    children?: LayerNode[];
    mapServerUrl?: string;
    serverLayerId?: number;
    serverLayerIds?: number[];
    layerDef?: string;
    color?: number[];
}

export const LAYER_TREE: LayerNode[] = [
    {
        id: 100,
        name: 'Aires protégées (Environnement & Parcs)',
        serverLayerIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
        color: [46, 204, 113, 200] // Green
    },
    {
        id: 101,
        name: 'Aires protégées (Milieux forestiers)',
        serverLayerIds: [15, 16],
        color: [241, 196, 15, 200] // Yellow
    },
    {
        id: 102,
        name: 'Aires protégées fédérales',
        serverLayerIds: [18, 19, 20],
        color: [231, 76, 60, 200] // Red
    },
    {
        id: 24,
        name: 'Territoires d\'importance pour la conservation',
        color: [52, 152, 219, 200] // Blue
    },
    {
        id: 25,
        name: 'Autres mesures de conservation efficaces',
        color: [90, 34, 139, 200] // Turquoise
    },
    {
        id: 52,
        name: 'Territoires Autochtones',
        mapServerUrl: 'https://servicescarto.mern.gouv.qc.ca/pes/rest/services/Forets/STF_WMS/MapServer',
        serverLayerId: 52,
        color: [168, 56, 0, 200] // Blue // Brown
    },
];

function collectAllIds(nodes: LayerNode[]): number[] {
    const ids: number[] = [];
    for (const node of nodes) {
        ids.push(node.id);
        if (node.children) ids.push(...collectAllIds(node.children));
    }
    return ids;
}

export const ALL_LAYER_IDS = collectAllIds(LAYER_TREE);

export const LAYER_NODE_MAP = new Map<number, LayerNode>();
function buildNodeMap(nodes: LayerNode[]) {
    for (const node of nodes) {
        LAYER_NODE_MAP.set(node.id, node);
        if (node.children) buildNodeMap(node.children);
    }
}
buildNodeMap(LAYER_TREE);

// Par défaut on selectionne tout
export const DEFAULT_SELECTED_LAYERS = new Set([100, 101, 102, 24, 25, 21, 52]);

export const BIOME_MAP: Record<string, string> = {
    'T': 'Milieu terrestre',
    'M': 'Milieu marin',
    'X': 'Milieu mixte (terrestre et marin)',
};

export const EMPTY_VALUES = new Set(['', 'Null', 'null', 'NaN', 'nan']);

export function getAttr(attrs: Record<string, any>, ...keys: string[]): string {
    for (const k of keys) {
        const v = attrs[k];
        if (v != null && !EMPTY_VALUES.has(String(v))) return String(v);
    }
    return '';
}

export function buildIdentifyHtml(attrs: Record<string, any>): string {
    const get = (...keys: string[]) => getAttr(attrs, ...keys);

    const biomeRaw = get('Biome', 'BIOME', 'PA_BIOME');
    const toponyme = get('Toponyme', 'TOPONYME', 'NOM_ID_MGE', 'Nom_identification', 'NAME_F', 'NAME_E', 'FNAME', 'Nom de la réserve indienne ou de la terre indienne');
    const isAuto = get('GEOCODE', 'Identifiant_unique', 'DOMANIALIT', 'Domanialité', 'NOM_ID_MGE', 'Nom_identification') !== '';

    let html = `<div style="max-width:340px;font-size:0.85rem;">`;
    const fallbackTitle = isAuto ? 'Communauté autochtone' : 'Aire protégée';
    const title = (isAuto && toponyme) ? `Communauté autochtone de ${toponyme}` : (toponyme || fallbackTitle);
    html += `<b style="font-size:0.95rem;">${title}</b><br>`;

    const fields: [string, string][] = [
        ['Identifiant unique', get('Identifiant_unique', 'GEOCODE', 'MACODE', 'ADMIN_LAND_ID', 'Numéro de la réserve indienne ou de la terre indienne')],
        ['Superficie (ha)', get('Superficie_ha', 'SUPERFICIE')],
        ['Numéro UG', get('Numéro_UG', 'NO_UG')],
        ['Mode de gestion', get('Mode_gestion', 'MODE_GEST')],
        ['Description', get('Description', 'DESCR_MGE')],
        ['Indicateur projet', get('Indicateur_projet', 'IN_PRJ_MGE')],
        ['Domanialité', get('Domanialité', 'DOMANIALIT')],
        ['Organisme responsable', get('Organisme_responsable', 'ORG_RS_MGE', 'Responsable', 'RESPONSABL', 'OWNER_F')],
        ['Numéro d\'identification', get('Numéro_identification', 'NO_ID_MGE')],
        ['Numéro gestionnaire', get('Numéro_gestionnaire', 'NO_GES_MGE')],
        ['Nom gestionnaire', get('Nom_gestionnaire', 'NOM_GES', 'MGMT_F')],
        ['Numéro TDA', get('Numéro_territoire_droits_consentis_autre', 'NO_TDA')],
        ['Numéro UA', get('Numéro_UA', 'NO_UA')],
        ['Numéro périmètre UA', get('Numéro_périmètre_UA', 'NO_PER_UA')],
        ['Numéro RGA', get('Numéro_RGA', 'NO_RGA')],
        ['Analyse BFEC', get('Numéro_territoire_analyse_BFEC', 'AUT_COAD')],
        ['Aire de trappe', get('Numéro_aire_trappe', 'AIR_TRAP')],
        ['Zone de tarification', get('Numéro_zone_tarification', 'NO_ZON_TAR')],
        ['Région administrative', get('Numéro_région_administrative', 'NO_REG_ADM')],
        ['MRC', get('Numéro_MRC', 'NO_MRC')],
        ['Agence forêt privée', get('Numéro_agence_forêt_privée', 'NO_AGENCE')],
        ['Date de publication', get('Date_publication', 'DATE_PUBLI')],
        ['Numéro légal', get('Numéro_légal_aire_protégée', 'NO_LEGAL')],
        ['Syndicat ou office', get('Nom_syndicat_ou_office_producteurs_forestiers', 'NM_SYN_OPF')],
        ['Groupement forestier', get('Nom_groupement_forestier', 'NM_GR_FOR')],
        ['Étiquette', get('Étiquette')],
        ['Premières Nations', get('FIRST_NATIONS', 'Premières Nations')],
        ['Localisation', get('LOCATION_DESC', 'Localisation')],
        ['Groupe', get('Groupe', 'DESIG_GR')],
        ['Nom du groupe', get('Nom du groupe', 'DESIGNOM')],
        ['Coresponsable', get('Coresponsable', 'CORESPONSA')],
        ['Type', get('TYPE_F', 'PA_OECM_DF', 'ADMIN_LAND_TYPE', 'Type de la réserve indienne ou de la terre indienne')],
        ['Biome', BIOME_MAP[biomeRaw] || biomeRaw],
        ['Catégorie UICN', get('Catégorie UICN', 'UICN', 'IUCN_CAT')],
        ['Date de création', get('Date de création', 'DA_CREATIO', 'ESTYEAR', 'QUALYEAR')],
        ['Durée de la reconnaissance', get('Durée de la reconnaissance', 'DURE_RECON')],
        ['Longitude', get('Longitude (degrés minutes secondes)', 'LONDMS')],
        ['Latitude', get('Latitude (degrés minutes secondes)', 'LATDMS')],
        ['Numéro de désignation', get('Numéro de désignation', 'DESIG_NO')],
        ['Aire protégée autochtone', get('IPCA') === '1' ? 'Oui' : (get('IPCA') === '0' ? 'Non' : get('IPCA'))],
    ];


    for (const [label, value] of fields) {
        if (value) {
            html += `<b>${label}:</b> ${value}<br>`;
        }
    }

    const lien = get('Lien internet', 'LIEN', 'PROFILE_URL_FR', 'Profils des Premières Nations');
    if (lien) {
        html += `<a href="${lien}" target="_blank">Plus d'infos</a>`;
    }

    const note = get('Note', 'note');
    if (note) {
        html += `<br><small><i>${note}</i></small>`;
    }

    html += `</div>`;
    return html;
}
