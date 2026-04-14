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
    hydro_reservoir: [
        {
            icon: 'fa-solid fa-cloud',
            title: 'Émissions moyennes',
            value: 'Faibles à modérées',
            colorClass: 'impact-blue',
            description: 'Les émissions (dont méthane et CO₂) proviennent surtout de la décomposition végétale initiale et de la machinerie de construction.'
        },
        {
            icon: 'fa-solid fa-map-location-dot',
            title: 'Impact sur le territoire',
            value: 'Impact élevé',
            colorClass: 'impact-orange',
            description: 'Inondation de grandes surfaces et fragmentation du territoire.'
        },
        {
            icon: 'fa-solid fa-fish',
            title: 'Impact sur la faune',
            value: 'Impact très important',
            colorClass: 'impact-teal',
            description: 'Poissons très touchés, habitats perturbés.'
        },
        {
            icon: 'fa-solid fa-leaf',
            title: 'Impact sur la flore',
            value: 'Impact majeur',
            colorClass: 'impact-green',
            description: 'Végétation inondée et milieux naturels modifiés.'
        },
        {
            icon: 'fa-solid fa-water',
            title: 'Qualité des eaux et sols',
            value: 'Impact fort et durable',
            colorClass: 'impact-blue',
            description: 'Qualité de l’eau modifiée, érosion et contamination possibles.'
        }
    ],
    hydro_fil_eau: [
        {
            icon: 'fa-solid fa-cloud',
            title: 'Émissions moyennes',
            value: 'Faibles à modérées',
            colorClass: 'impact-blue',
            description: 'Les émissions (dont méthane et CO₂) proviennent surtout de la décomposition végétale initiale et de la machinerie de construction.'
        },
        {
            icon: 'fa-solid fa-map-location-dot',
            title: 'Impact sur le territoire',
            value: 'Impact faible',
            colorClass: 'impact-orange',
            description: 'Modification locale du cours d’eau.'
        },
        {
            icon: 'fa-solid fa-fish',
            title: 'Impact sur la faune',
            value: 'Surtout sur les poissons',
            colorClass: 'impact-teal',
            description: 'Effets plus limités sur les autres espèces.'
        },
        {
            icon: 'fa-solid fa-leaf',
            title: 'Impact sur la flore',
            value: 'Impact local',
            colorClass: 'impact-green',
            description: 'Coupe d’arbres et baisse possible de la végétation aquatique.'
        },
        {
            icon: 'fa-solid fa-water',
            title: 'Qualité des eaux et sols',
            value: 'Impact modéré et localisé',
            colorClass: 'impact-blue',
            description: 'Sédiments, transparence et stabilité des rives affectés.'
        }
    ],
    eolienneparc: [
        {
            icon: 'fa-solid fa-cloud',
            title: 'Émissions moyennes',
            value: 'Très faibles',
            colorClass: 'impact-blue',
            description: 'Presque nulles en opération. Les émissions sont associées à la fabrication (acier, béton) et au transport.'
        },
        {
            icon: 'fa-solid fa-map-location-dot',
            title: 'Impact sur le territoire',
            value: 'Emprise visuelle',
            colorClass: 'impact-orange',
            description: 'Modification importante du paysage visuel, bien que l\'emprise réelle affectant le sol par éolienne soit relativement faible.'
        },
        {
            icon: 'fa-solid fa-crow',
            title: 'Impact sur la faune',
            value: 'Risque de collisions',
            colorClass: 'impact-teal',
            description: 'Mortalité possible chez les oiseaux et les chauves-souris. Effet potentiellement d\'effarouchement sur certaines espèces terrestres.'
        },
        {
            icon: 'fa-solid fa-leaf',
            title: 'Impact sur la flore',
            value: 'Très localisé',
            colorClass: 'impact-green',
            description: 'Déboisement et altération mineure de la végétation limités à l\'aménagement des chemins d\'accès et des fondations.'
        },
        {
            icon: 'fa-solid fa-water',
            title: 'Qualité des eaux et sols',
            value: 'Négligeable',
            colorClass: 'impact-blue',
            description: 'Aucun impact sur l\'eau en opération. Risque minime pour les sols lié d\'éventuelles petites fuites de lubrifiants.'
        }
    ],
    nucleaire: [
        {
            icon: 'fa-solid fa-cloud',
            title: 'Émissions moyennes',
            value: 'Très faibles',
            colorClass: 'impact-blue',
            description: 'Émissions de GES extrêmement faibles en opération, comparables à celles des énergies renouvelables sur le cycle de vie.'
        },
        {
            icon: 'fa-solid fa-map-location-dot',
            title: 'Impact sur le territoire',
            value: 'Gestion des sites',
            colorClass: 'impact-orange',
            description: 'Peu d\'espace pour l\'usine même, mais l\'enfouissement des déchets demande des structures géologiques adaptées à long terme.'
        },
        {
            icon: 'fa-solid fa-fish',
            title: 'Impact sur la faune',
            value: 'Milieu aquatique',
            colorClass: 'impact-teal',
            description: 'Aspiration potentielle d\'organismes (poissons, plancton) par les systèmes de pompage d\'eau de refroidissement.'
        },
        {
            icon: 'fa-solid fa-leaf',
            title: 'Impact sur la flore',
            value: 'Stress thermique',
            colorClass: 'impact-green',
            description: 'Le réchauffement local des cours d\'eau peut altérer les herbiers aquatiques. Impact terrestre direct très minime.'
        },
        {
            icon: 'fa-solid fa-water',
            title: 'Qualité des eaux et sols',
            value: 'Rejets thermiques',
            colorClass: 'impact-blue',
            description: 'Réchauffement des eaux de surface. Les sols et eaux souterraines peuvent être contaminés gravement en cas d\'accident radiologique.'
        }
    ],
    solaire: [
        {
            icon: 'fa-solid fa-cloud',
            title: 'Émissions moyennes',
            value: 'Faibles',
            colorClass: 'impact-blue',
            description: 'Aucune émission directe en opération. La dette carbone liée à la fabrication (extraction du silicium) est remboursée en 1 à 3 ans.'
        },
        {
            icon: 'fa-solid fa-map-location-dot',
            title: 'Impact sur le territoire',
            value: 'Artificialisation',
            colorClass: 'impact-orange',
            description: 'Les parcs utilitaires requièrent d\'immenses surfaces au sol, créant des conflits d\'usage avec l\'agriculture (agrivoltaïsme).'
        },
        {
            icon: 'fa-solid fa-bug',
            title: 'Impact sur la faune',
            value: 'Perte d\'habitat',
            colorClass: 'impact-teal',
            description: 'Déplacement de la faune terrestre et modification de ses parcours migratoires à cause des clôtures de sécurité du parc.'
        },
        {
            icon: 'fa-solid fa-leaf',
            title: 'Impact sur la flore',
            value: 'Ombrage',
            colorClass: 'impact-green',
            description: 'L\'ombre continuelle créée par les panneaux modifie le microclimat et restreint la croissance de la flore spécifique au site.'
        },
        {
            icon: 'fa-solid fa-water',
            title: 'Qualité des eaux et sols',
            value: 'Risques miniers',
            colorClass: 'impact-blue',
            description: 'Pas d\'impact aqueux local. La pollution chimique des sols et des eaux se situe surtout en amont, lors de l\'extraction minière des métaux.'
        }
    ],
    thermique: [
        {
            icon: 'fa-solid fa-smog',
            title: 'Émissions moyennes',
            value: 'Extrêmement élevées',
            colorClass: 'impact-orange',
            description: 'Source massive de gaz à effet de serre (CO₂, dioxyde de soufre, oxydes d\'azote) responsable des changements climatiques.'
        },
        {
            icon: 'fa-solid fa-map-location-dot',
            title: 'Impact sur le territoire',
            value: 'Destructeur',
            colorClass: 'impact-orange',
            description: 'Modification sévère du paysage initial pour l\'extraction du combustible (ex: mines de charbon, bassins de sables bitumineux).'
        },
        {
            icon: 'fa-solid fa-crow',
            title: 'Impact sur la faune',
            value: 'Pollution toxique',
            colorClass: 'impact-teal',
            description: 'Perte d\'habitats en amont (mines) et potentielle intoxication par les gaz et métaux lourds (mercure) relâchés dans l\'air.'
        },
        {
            icon: 'fa-solid fa-leaf',
            title: 'Impact sur la flore',
            value: 'Pluies acides',
            colorClass: 'impact-green',
            description: 'Les rejets atmosphériques polluants engendrent des pluies acides qui détériorent directement le feuillage et les forêts mondiales.'
        },
        {
            icon: 'fa-solid fa-water',
            title: 'Qualité des eaux et sols',
            value: 'Contaminations multiples',
            colorClass: 'impact-blue',
            description: 'Acidification des lacs, contamination des nappes (exploitation par fracturation, bassins cendres) avec d\'importantes pollutions des sols.'
        }
    ]
};
