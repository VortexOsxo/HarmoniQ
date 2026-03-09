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
export const DEFAULT_SELECTED_LAYERS = new Set([17, 18, 19, 20]);
