export interface LayerNode {
    id: number;
    name: string;
    children?: LayerNode[];
}

export const LAYER_TREE: LayerNode[] = [
    {
        id: 23, name: 'Ensemble des aires protégées et autres mesures de conservation efficaces',
        children: [
            { id: 24, name: 'Territoires d\'importance pour la conservation' },
            {
                id: 0, name: 'Aires protégées du MELCCFP',
                children: [
                    { id: 1, name: 'Habitats espèces floristiques men. ou vuln.' },
                    { id: 2, name: 'Habitats fauniques' },
                    { id: 3, name: 'Parc marin du Saguenay–Saint-Laurent' },
                    { id: 4, name: 'Parcs nationaux du Québec' },
                    { id: 5, name: 'Paysages humanisés' },
                    { id: 6, name: 'Refuges fauniques' },
                    { id: 7, name: 'Réserves aquatiques' },
                    { id: 8, name: 'Réserves de biodiversité' },
                    { id: 9, name: 'Réserves de territoire aux fins d\'aire protégée' },
                    { id: 10, name: 'Réserves écologiques' },
                    { id: 11, name: 'Réserves marines' },
                    { id: 12, name: 'Réserves naturelles reconnues' },
                    { id: 13, name: 'Territoires mis en réserve' },
                ],
            },
            {
                id: 14, name: 'Aires protégées du MRNF Forêts',
                children: [
                    { id: 15, name: 'Écosystèmes forestiers exceptionnels' },
                    { id: 16, name: 'Refuges biologiques' },
                ],
            },
            {
                id: 17, name: 'Aires protégées fédérales',
                children: [
                    { id: 18, name: 'Parcs fédéraux' },
                    { id: 19, name: 'Refuges d\'oiseaux migrateurs' },
                    { id: 20, name: 'Réserves nationales de faune' },
                ],
            },
            {
                id: 21, name: 'Autres aires protégées',
                // children: [
                //     { id: 22, name: 'Autres aires protégées (détail)' },
                // ],
            },
            { id: 25, name: 'Autres mesures de conservation efficaces (AMCE)' },
        ],
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
export const DEFAULT_SELECTED_LAYERS = new Set([17, 18, 19, 20]); // On peut mettre d'autres areas par defaut, a discuter avec meca

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

    const biomeRaw = get('Biome', 'BIOME');
    const superficie = get('Superficie (ha)', 'HA_LEGAL');
    const toponyme = get('Toponyme', 'TOPONYME');

    const fields: [string, string][] = [
        ['Groupe', get('Groupe', 'DESIG_GR')],
        ['Nom du groupe', get('Nom du groupe', 'DESIGNOM')],
        ['Responsable', get('Responsable', 'RESPONSABL')],
        ['Coresponsable', get('Coresponsable', 'CORESPONSA')],
        ['Biome', BIOME_MAP[biomeRaw] || biomeRaw],
        ['Catégorie UICN', get('Catégorie UICN', 'UICN')],
        ['Superficie (ha)', superficie],
        ['Date de création', get('Date de création', 'DA_CREATIO')],
        ['Durée de la reconnaissance', get('Durée de la reconnaissance', 'DURE_RECON')],
        ['Longitude', get('Longitude (degrés minutes secondes)', 'LONDMS')],
        ['Latitude', get('Latitude (degrés minutes secondes)', 'LATDMS')],
        ['Identifiant unique', get('Identifiant unique', 'MACODE')],
        ['Numéro de désignation', get('Numéro de désignation', 'DESIG_NO')],
    ];

    let html = `<div style="max-width:340px;font-size:0.85rem;">`;
    html += `<b style="font-size:0.95rem;">${toponyme || 'Aire protégée'}</b><br>`;

    for (const [label, value] of fields) {
        if (value) {
            html += `<b>${label}:</b> ${value}<br>`;
        }
    }

    const lien = get('Lien internet', 'LIEN');
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
