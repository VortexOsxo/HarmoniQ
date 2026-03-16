export interface ImpactItem {
    icon: string;
    title: string;
    value: string;
    colorClass: string;
    description: string;
}

export interface CycleDeVieData {
    conception: string;
    construction: string;
    exploitation: string;
    demantelement: string;
}

export const CYCLE_DE_VIE_DATA: Record<string, CycleDeVieData> = {
    hydro: {
        conception: "Études préliminaires, choix du site selon la géologie, analyses hydrologiques et environnementales (1 à 2 ans).",
        construction: "Édification du barrage, de la centrale, installation des turbines (4 à 6 ans). Coûts élevés.",
        exploitation: "Régulation du débit, stockage, et production d'électricité propre (50 à 100+ ans).",
        demantelement: "Peu fréquent, concerne la modernisation de l'installation ou la restauration de la continuité écologique."
    },
    eolienneparc: {
        conception: "Modélisation aérodynamique, études de l'acceptabilité locale et des vents.",
        construction: "Fabrication des pales en matériaux composites, du mât en acier, transport et installation (quelques semaines/mois par éolienne).",
        exploitation: "Production d'électricité avec maintenance régulière (durée de vie 20 à 25 ans).",
        demantelement: "Démontage, recyclage progressif des matériaux incluant d'importants défis pour les pales composites."
    },
    nucleaire: {
        conception: "Évaluation très rigoureuse du site et conception poussée sur la sûreté.",
        construction: "Travaux de génie civil majeurs, assemblage du réacteur (5 à 10+ ans).",
        exploitation: "Production continue et gestion du combustible avec des réexamens décennaux (60 à 70 ans).",
        demantelement: "Processus très complexe long de plusieurs décennies pour abaisser la radioactivité et restaurer le site."
    },
    solaire: {
        conception: "Évaluation du potentiel solaire du site et disposition des panneaux.",
        construction: "Extraction du silicium (très énergivore), fabrication des cellules et assemblage des modules.",
        exploitation: "Production sans émission (25 à 30 ans+). Rendement perdant environ 20% au bout de 25 ans.",
        demantelement: "Recyclage des panneaux à plus de 85-95% (verre, aluminium, silicium, argent)."
    },
    thermique: {
        conception: "Planification logistique pour l'apport continu de combustibles (gaz, charbon).",
        construction: "Mise en place de chaudières géantes et de turbines à vapeur.",
        exploitation: "Combustion générant de la chaleur qui entraîne des turbines (30 à 40 ans). Hautes émissions.",
        demantelement: "Fermeture, démolition, et très souvent dépollution à long terme des sols du site."
    }
};

export const IMPACTS_ENVIRONNEMENTAUX_DATA: Record<string, ImpactItem[]> = {
    hydro: [
        {
            icon: 'fa-solid fa-wind',
            title: 'Émissions de CO₂',
            value: '18 000 tonnes',
            colorClass: 'impact-blue',
            description: 'La construction génère des GES (béton, acier). Équivalent aux émissions annuelles d\'environ 3900 voitures.'
        },
        {
            icon: 'fa-solid fa-tree',
            title: 'Habitats naturels',
            value: '12 km² inondés',
            colorClass: 'impact-green',
            description: 'Submerge une surface importante, affectant la faune locale et les migrations (poissons, nidification).'
        },
        {
            icon: 'fa-solid fa-water',
            title: 'Qualité de l\'eau',
            value: 'Changements en aval',
            colorClass: 'impact-teal',
            description: 'L\'eau peut être moins oxygénée (-30%) ou plus chaude, altérant les sédiments naturels.'
        },
        {
            icon: 'fa-solid fa-mountain',
            title: 'Impact sur les terres',
            value: 'Définitif',
            colorClass: 'impact-orange',
            description: 'Les zones riveraines perdent de nombreux nutriments naturels à cause de l\'érosion et l\'immersion.'
        }
    ],
    eolienneparc: [
        {
            icon: 'fa-solid fa-wind',
            title: 'Émissions de CO₂',
            value: 'Faibles en opération',
            colorClass: 'impact-blue',
            description: 'La fabrication et le transport demandent de l\'énergie, mais l\'opération évite d\'énormes quantités de GES.'
        },
        {
            icon: 'fa-solid fa-crow',
            title: 'Faune volante',
            value: 'Risque de collisions',
            colorClass: 'impact-orange',
            description: 'Impact potentiel sur les oiseaux et chauves-souris. Choix du site crucial pour minimiser ce risque.'
        },
        {
            icon: 'fa-solid fa-volume-high',
            title: 'Nuisances sonores et visuelles',
            value: 'Modérées',
            colorClass: 'impact-teal',
            description: 'Le souffle des pales crée un léger bruit continu et l\'installation modifie le paysage visible.'
        }
    ],
    nucleaire: [
        {
            icon: 'fa-solid fa-wind',
            title: 'Émissions de CO₂',
            value: 'Très faibles',
            colorClass: 'impact-blue',
            description: 'Émissions proches de celles des renouvelables sur l\'ensemble du cycle de vie.'
        },
        {
            icon: 'fa-solid fa-radiation',
            title: 'Déchets radioactifs',
            value: 'Longue vie',
            colorClass: 'impact-orange',
            description: 'Production de déchets dangereux nécessitant un enfouissement ou confinement complexe sur des millénaires.'
        },
        {
            icon: 'fa-solid fa-temperature-arrow-up',
            title: 'Impact thermique',
            value: 'Rejets d\'eau chaude',
            colorClass: 'impact-teal',
            description: 'Les eaux de refroidissement rejetées réchauffent localement les rivières ou mers environnantes.'
        }
    ],
    solaire: [
        {
            icon: 'fa-solid fa-industry',
            title: 'Extraction minière',
            value: 'Forte',
            colorClass: 'impact-orange',
            description: 'Extraction énergivore de terres rares, silicium, avec possibles pollutions chimiques aux sites miniers.'
        },
        {
            icon: 'fa-solid fa-solar-panel',
            title: 'Artificialisation des sols',
            value: 'Importante',
            colorClass: 'impact-green',
            description: 'Les grands parcs solaires utilisent d\'énormes surfaces au sol, parfois au détriment de l\'agriculture.'
        },
        {
            icon: 'fa-solid fa-wind',
            title: 'Émissions de CO₂',
            value: 'Dette remboursée',
            colorClass: 'impact-blue',
            description: 'Malgré les GES de fabrication (silicium), la "dette carbone" est remboursée en 1 à 2 ans.'
        }
    ],
    thermique: [
        {
            icon: 'fa-solid fa-smog',
            title: 'Émissions de CO₂',
            value: 'Massives',
            colorClass: 'impact-orange',
            description: 'La plus grande source de gaz à effet de serre par MWh produit au monde (gaz, fioul, charbon).'
        },
        {
            icon: 'fa-solid fa-mask-ventilator',
            title: 'Polluants de l\'air',
            value: 'NOx, SOx, PM',
            colorClass: 'impact-teal',
            description: 'Rejets importants de dioxyde de soufre, oxydes d\'azote et particules fines, lourd impact sur la santé.'
        },
        {
            icon: 'fa-solid fa-hill-rockslide',
            title: 'Impacts extractifs',
            value: 'Élevés',
            colorClass: 'impact-blue',
            description: 'L\'extraction (mines de charbon, forage gazier) dévaste des écosystèmes entiers (forages, marées noires).'
        }
    ]
};
