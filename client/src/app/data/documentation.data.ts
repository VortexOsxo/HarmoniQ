export interface Documentation {
    functionName: string;
    functionResume: string;
    params: string[];
    returns: string;
}

export const docsWind: Documentation[] = [
    {
        functionName: 'adjust_wind_speed',
        functionResume: 'Ajuste la vitesse du vent mesurée à la hauteur de référence vers la hauteur du moyeu en utilisant la loi de profil logarithmique.',
        params: [
            'v_meteo: Vitesse du vent mesurée (m/s).',
            'z_meteo: Hauteur de référence de la mesure (m).',
            "z_eolien: Hauteur du moyeu de l'éolienne (m).",
            'z0: Longueur de rugosité de surface (défaut 0.03).'
        ],
        returns: 'Vitesse du vent ajustée (m/s).'
    },
    {
        functionName: 'air_density',
        functionResume: "Calcule la densité de l'air selon la loi des gaz parfaits.",
        params: [
            'temperature: Température en Kelvin (K).',
            'pressure: Pression atmosphérique en Pascal (Pa).'
        ],
        returns: "La densité de l'air calculée (kg/m³)."
    },
    {
        functionName: 'piecewise_power_curve',
        functionResume: "Modèle par segment d'une courbe de puissance générique.",
        params: [
            'v: Vitesses du vent en m/s.',
            "cut_in_speed: Vitesse d'enclenchement minimum (m/s).",
            'rated_speed: Vitesse nominale évaluée (m/s).',
            'cut_out_speed: Vitesse de coupure maximum (m/s).',
            'rated_power: Puissance nominale brute (kW).',
            'power_shape_exponent: Exposant de forme de la montée en puissance.'
        ],
        returns: 'Puissance générée en Watts (W).'
    },
    {
        functionName: 'infer_rated_speed',
        functionResume: 'Déduit une vitesse nominale robuste pour le mode de calcul de repli.',
        params: [
            'turbine_data: Dictionnaire contenant les métadonnées de la turbine.',
            "cut_in_speed: Vitesse d'enclenchement (m/s).",
            'cut_out_speed: Vitesse de coupure (m/s).'
        ],
        returns: 'Vitesse nominale inférée de la turbine (m/s).'
    },
    {
        functionName: 'power_from_real_curve',
        functionResume: 'Calcule la puissance de la turbine à partir de la courbe physique du fabricant.',
        params: [
            'v_ms: Série de vitesses du vent (m/s).',
            'turbine_data: Dictionnaire avec la table de courbe de puissance.',
            "cut_in_speed: Vitesse d'enclenchement (m/s).",
            'cut_out_speed: Vitesse de coupure (m/s).'
        ],
        returns: 'Série de puissance horaire (kW) ou None.'
    },
    {
        functionName: 'apply_directional_losses',
        functionResume: 'Calcule factoriellement la perte directionnelle du vent.',
        params: [
            'direction_series: Table des directions du vent.'
        ],
        returns: 'Facteur de pénalité directionnel (entre 0.7 et 1.0).'
    },
    {
        functionName: 'apply_wake_losses',
        functionResume: 'Estime de façon simplifiée la déperdition inter-éolienne due au sillage.',
        params: [
            'direction_series: Table des directions du vent.'
        ],
        returns: 'Facteur multiplicateur de sillage (0.9 ou 1.0).'
    },
    {
        functionName: 'ice_loss_factor',
        functionResume: 'Calcule le handicap de production lié au froid et givrage.',
        params: [
            'temperature_k: Tableau de température en Kelvin.',
            'stochastic: Booléen hérité.'
        ],
        returns: 'Tableau des facteurs de perte (0.6, 0.8 ou 1.0).'
    },
    {
        functionName: 'get_parc_power',
        functionResume: 'Interface centrale calculant la production absolue du parc éolien.',
        params: [
            'parc: Modèle entité du parc visé.',
            'meteo: Tableau de données météorologiques (vent, angle, temp).'
        ],
        returns: 'DataFrame combiné des données de production nette (kW).'
    }
];

export const docsHydro: Documentation[] = [
    {
        functionName: 'estimer_qualite_ecosysteme_futur',
        functionResume: "Estime l'impact futur sur la qualité des écosystèmes en fonction du facteur de charge d'un nouveau barrage hydroélectrique.",
        params: [
            'facteur_charge: Facteur de charge du nouveau barrage (valeur entre 0 et 1).'
        ],
        returns: "Estimation de l'impact futur sur la qualité des écosystèmes (PDF*m²*yr/kWh)."
    },
    {
        functionName: 'estimer_daly_futur',
        functionResume: "Estime le DALY futur en fonction du facteur de charge d'un nouveau barrage hydroélectrique.",
        params: [
            'facteur_charge: Facteur de charge du nouveau barrage (valeur entre 0 et 1).'
        ],
        returns: 'Estimation du DALY futur (DALY/kWh).'
    },
    {
        functionName: 'get_reservoir_volumes_timeline',
        functionResume: "Simule le volume d'eau en mètre cube de chaque barrage-réservoir de la région, étape par étape.",
        params: [
            'delta_t: Scalaire pour la fréquence temporelle à analyser.',
            'start_date: Heure/Date de départ (Timestamp).',
            'end_date: Heure/Date de fin (Timestamp).',
            'power_required_mw: Charge imposée.',
            "initial_levels: Niveau d'eau de départ injecté."
        ],
        returns: "DataFrame combinant l'état chronologique des barrages."
    },
    {
        functionName: 'charger_apport_reservoir',
        functionResume: "Charge et interpole les données d'apport hydrique d'un réservoir.",
        params: [
            'start_date: Début temporel analysable.',
            'end_date: Fin temporelle récupérable.'
        ],
        returns: "Matrice comportant l'apport des bassins à la maille donnée."
    },
    {
        functionName: 'get_run_of_river_dam_power',
        functionResume: "Calcule l'influx net apporté par les ouvrages au fil de l'eau.",
        params: [
            "barrage: L'instance et objet du barrage analysé."
        ],
        returns: 'Le tracé de la puissance temporelle en MW générée.'
    },
    {
        functionName: 'get_facteur_de_charge',
        functionResume: "Détermine virtuellement le facteur de charge global d'opération.",
        params: [
            'barrage: Entité matérielle hydro-évaluée.',
            'production: La grille horaire de production effective.'
        ],
        returns: 'Le facteur de charge sous forme de scalaire (entre 0 et 1).'
    },
    {
        functionName: 'energy_loss',
        functionResume: 'Quantifie la masse ou énergie jetée par surplus dans les évacuations excédentaires.',
        params: [
            'Volume_evacue: Accumulation relâchée (m³/h).',
            'Debits_nom_m3s: Calibre hydro (m³/s).',
            'type_turb: Classification turbine.',
            'nb_turbines: Compte mécanique actif effectif.',
            'head: Chute relative en mètre de haut.',
            'nb_turbine_maintenance: Entités momentanément immobilisées.'
        ],
        returns: 'La quantité énergétique MWh de ruissellement sacrifiée/perdue.'
    },
    {
        functionName: 'estimation_cout_barrage',
        functionResume: "Génère un profil de coûts standard pour bâtir l'infrastructure complète.",
        params: [
            'barrage: Profil en objet du site de production étudié.'
        ],
        returns: "L'enveloppe budgétaire globale de développement en dollar canadien."
    },
    {
        functionName: 'calculer_emissions_et_ressources',
        functionResume: 'Calcule les indicateurs environnementaux et évalue les réserves minérales mobilisées.',
        params: [
            'barrage: Entité matérielle et spatiale.',
            'energie: Récolte électrique estimée du contexte évalué.',
            "facteur_charge: La fréquence moyenne d'utilisation attendue."
        ],
        returns: "Tableau analytique tabulaire (DataFrame) de l'empreinte environnementale du barrage."
    }
];

export const docsNuclear: Documentation[] = [
    {
        functionName: 'calculate_nuclear_production',
        functionResume: "Calcule la production annuelle d'une centrale nucléaire en mWh.",
        params: [
            'power_mw: Puissance nominale de la centrale en kW.',
            'maintenance_week: Semaine attribuée pour la maintenance.',
            "date_start: Date de début d'évaluation.",
            "date_end: Date de fin d'évaluation."
        ],
        returns: 'DataFrame des résultats nets en production continue horaire.'
    },
    {
        functionName: 'co2_emissions_nuclear',
        functionResume: 'Calcule les émissions totales de CO₂ équivalent pour une centrale nucléaire.',
        params: [
            'annual_nuclear_production: Quantité nette énergétique du site (kWh).',
            "facteur_emission: Constante d'empreinte atmosphérique standardisée (g d'eq. CO2)."
        ],
        returns: 'Tableau complet de rejet net calculé au niveau du bâtiment en équivalent masse.'
    },
    {
        functionName: 'cost_nuclear_powerplant',
        functionResume: "Estime l'engagement monétaire direct pour déployer une centrale structurale selon les coûts du Québec.",
        params: [
            'power_mw: Valeur électrique crête estimée du bloc et des turbines.'
        ],
        returns: 'Total du coût du chantier en fraction dollars canadiens (CAD).'
    }
];

export const docsSolar: Documentation[] = [
    {
        functionName: 'calculate_energy_solar_plants',
        functionResume: "Calcule un profil horaire d'énergie produite par une centrale solaire via pvlib ModelChain.",
        params: [
            'nom: Identifiant ou appellation unique du champ solaire simulé.',
            "latitude, longitude: Orientations géospatiales complètes de l'édifice.",
            'angle_panneau: Élévation, inclinaison zénithale modélisée (degrés).',
            'orientation_panneau: Azimut de pointage des récepteurs PV.',
            'puissance_nominal: Constante de conception et taille nominale des engins récepteurs.',
            "nombre_panneau: Totalité des actifs agrégés dans l'échelle d'investissement.",
            "date_start, date_end: Segment délimitant du calendrier d'action."
        ],
        returns: "Registre DataFrame temporel retraçant point par point l'extraction énergétique (kW)."
    },
    {
        functionName: 'calculate_energy_solar_plants_old',
        functionResume: 'Méthode mathématique rétrograde statique pour le photovoltaïque.',
        params: [
            'nom: Le parc identifié en mémoire de programme.',
            'latitude, longitude: Géo-coordonnées absolues fixes géographiques du lieu.',
            "date_start, date_end: Plage d'extrapolation en date cible des mesures."
        ],
        returns: 'DataFrame décrivant uniquement la production brute statique du lieu énergétique.'
    },
    {
        functionName: 'distribute_base_to_mrc',
        functionResume: 'Distribue le profil unitaire en densité lumineuse extraite (W/m²) vers les communautés.',
        params: [
            'ra_base_df: Base du profil vectoriel initial sur grille territoriale élargie.',
            "mrc_to_ra_mapping: Base comparative et croisement localisant des secteurs d'arrondissement spécifiques."
        ],
        returns: 'Registre restructuré descendant du grand niveau vers le micro-niveau (par MRC).'
    },
    {
        functionName: 'calculate_base_production_per_m2',
        functionResume: "Reconstruit la maquette urbaine comme une zone virtuelle concentrant ses toits solaires unitaires pour analyser l'efficacité brute.",
        params: [
            'coordinates: Regroupement physique spatial et géo-localisation des repères modélisés.',
            'surface_tilt, surface_orientation: Orientation physique uniforme du bâti.'
        ],
        returns: 'Tableau TMY horaire avec le calibrage (W/m²) typique de cet environnement de ville.'
    },
    {
        functionName: 'compute_facteur_densite',
        functionResume: "Pondère ou contraint le potentiel d'hébergement électrique du maillage des toits en ville.",
        params: [
            "population: État d'occupation et recensement absolu des personnes actives du milieu.",
            'superficie_km2: Enveloppe physique globale du territoire régional ou unifié en zone résidentielle.',
            "m2_par_client: Attribution ciblée de superficie projetée d'implantation au citoyen par scénario macro."
        ],
        returns: "Échelle limitante (0-1) refrénant ou maximisant l'ambition technologique face à l'urbanisme."
    },
    {
        functionName: 'apply_residential_scenario',
        functionResume: "Applique temporellement des profils d'équipement hypothétiques aux habitants pour la prospection énergétique.",
        params: [
            'base_df: Modèle W/m² local générant la ressource énergétique brute mesurée pour la zone globale donnée.',
            'm2_par_client: Scénario de dotation technologique résidentiel de capteurs en panneaux en toiture par client.',
            "mrc_data_df: Tableau des attributions démographiques des MRC, permettant d'affecter les quantités appropriées de citoyens impactés.",
            "total_clients: Ambition politique (ex. 125,000 clients à conquérir selon l'objectif en cible annuelle)."
        ],
        returns: 'Profil total et final injecté [kW] résidentiel pour chaque arrondissement.'
    },
    {
        functionName: 'cost_solar_powerplant',
        functionResume: "Fournit la donnée numéraire permettant l'acceptation budgétaire de chaque déploiement (CAPEX de ferme rurale par exemple).",
        params: [
            'puissance_mw: Étendue en bloc ou tranche énergétique fixée au grand compte du projet sur place.'
        ],
        returns: 'Constante ou somme des couts bruts prévisibles à affecter au rapport.'
    },
    {
        functionName: 'calculate_installation_cost',
        functionResume: "Détermine une fourchette complète modulant les montages d'OPEX et frais techniques cachés.",
        params: [
            "puissance_mw: Appui majeur d'ingénierie dimensionnement modélisant ce qu'on installe en terrain lourd."
        ],
        returns: 'Tableau compilant géographiquement la balance spécifique des couts raccordements.'
    },
    {
        functionName: 'calculate_lifetime',
        functionResume: 'Inscrit le plafond ou cycle de remplacement obligatoire en ingénierie de cette ressource.',
        params: [
            'puissance_mw: Renseignement qui impacte les prévisions de longévité des installations colossales.'
        ],
        returns: "Durée en cycle annuel comptable avant que tout le réseau matériel n'expire complétement."
    },
    {
        functionName: 'co2_emissions_solar',
        functionResume: 'Cumul la dette de CO2 en amont lors de la fabrication logistique chinoise et manufacturière du silicone.',
        params: [
            "coordinates_centrales: Dénombrement et registre officiel d'opération de tous ces points solaires industriels.",
            'resultats_centrales: Les performances agrégées que vont générer tout ce parc sous le climat précis.',
            'facteur_emission: Dette résiduelle environnementale de pénalité de fabrication en ACV.'
        ],
        returns: 'Comptabilité nette des dettes ou des fuites écologiques directes attribuables pour ces objets (kg).'
    }
];

export const docsThermal: Documentation[] = [
    {
        functionName: 'assign_maintenance_weeks',
        functionResume: "Répartit harmonieusement l'arrêt productif de sécurité ou maintenance des infrastructures thermiques sans surcharger le déficit commun.",
        params: [
            "n_centrales: Algorithme recevant l'intrant global de sites disponibles planifiés."
        ],
        returns: 'Tableau temporel de semaines ciblées par site de base évalué.'
    },
    {
        functionName: 'calculate_thermique_production',
        functionResume: 'Détermine le soutien en électricité thermique projetée des stations insulaires (énergies fossiles en général).',
        params: [
            'power_mw: Potentiel crête des brûleurs modulés de cet espace évalué.',
            'maintenance_week: Jalonnement contraignant soumettant les génératrices.',
            'date_start, date_end: Plage mathématique et limite évaluative pour la simulation en interne.',
            'fuel_type: Déterminant sur les ratios de gaz, biogaz, mazout ou autre.',
            "use_efficiency: Ration de rentabilité d'efficience calorique transformée en volt."
        ],
        returns: 'Profil synthétisant le calendrier de MWh accompli heure par heure sur toute la ligne du temps.'
    }
];

